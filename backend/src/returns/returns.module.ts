import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  MinLength,
} from 'class-validator';
import {
  Prisma,
  Role,
  ReturnStatus,
  ReturnReason,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

function isStaff(role: Role) {
  return role === Role.ADMIN || role === Role.PRODUCTION;
}

class CreateReturnDto {
  @IsString() orderId: string;
  @IsOptional() @IsEnum(ReturnReason) reason?: ReturnReason;
  @IsString() @MinLength(3) details: string;
}

class UpdateReturnDto {
  @IsOptional() @IsEnum(ReturnStatus) status?: ReturnStatus;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsNumber() @Min(0) refundAmount?: number;
  @IsOptional() @IsString() adminNote?: string;
}

@Injectable()
export class ReturnsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Bayi: kendi siparişi için iade talebi
  async create(user: AuthUser, dto: CreateReturnDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    if (!isStaff(user.role) && order.userId !== user.userId) {
      throw new ForbiddenException('Bu sipariş size ait değil');
    }
    // Sipariş satırını kilitle → aynı sipariş için eşzamanlı çift açık talep serileşir
    const rr = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${dto.orderId} FOR UPDATE`;
      const open = await tx.returnRequest.findFirst({
        where: {
          orderId: dto.orderId,
          status: {
            in: [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.RECEIVED],
          },
        },
      });
      if (open) throw new BadRequestException('Bu sipariş için açık bir iade talebi var');
      return tx.returnRequest.create({
        data: {
          orderId: dto.orderId,
          userId: order.userId,
          reason: dto.reason ?? ReturnReason.OTHER,
          details: dto.details,
        },
      });
    });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'RETURN_REQUEST',
      entityType: 'ReturnRequest',
      entityId: rr.id,
      meta: { orderId: dto.orderId, reason: rr.reason },
    });
    return rr;
  }

  async list(user: AuthUser, status?: ReturnStatus) {
    const staff = isStaff(user.role);
    const rows = await this.prisma.returnRequest.findMany({
      where: {
        status,
        ...(staff ? {} : { userId: user.userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        order: { select: { id: true, orderNumber: true, total: true, category: true } },
        ...(staff
          ? { user: { select: { id: true, fullName: true, email: true } } }
          : {}),
      },
    });
    // İç alanları (admin notu / çözüm) bayiye sızdırma
    if (!staff) for (const r of rows) {
      delete (r as Partial<typeof r>).adminNote;
      delete (r as Partial<typeof r>).resolution;
    }
    return rows;
  }

  async get(user: AuthUser, id: string) {
    const staff = isStaff(user.role);
    const rr = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!rr) throw new NotFoundException('İade talebi bulunamadı');
    if (!staff && rr.userId !== user.userId) {
      throw new ForbiddenException('Bu talebe erişiminiz yok');
    }
    if (!staff) {
      delete (rr as Partial<typeof rr>).adminNote;
      delete (rr as Partial<typeof rr>).resolution;
    }
    return rr;
  }

  // Staff: durum/çözüm; REFUNDED + refundAmount → cüzdana atomik iade
  async update(user: AuthUser, id: string, dto: UpdateReturnDto) {
    if (!isStaff(user.role)) throw new ForbiddenException('Yalnız personel güncelleyebilir');

    const result = await this.prisma.$transaction(async (tx) => {
      const rr = await tx.returnRequest.findUnique({
        where: { id },
        include: { order: { select: { total: true } } },
      });
      if (!rr) throw new NotFoundException('İade talebi bulunamadı');

      // Para iadesi YALNIZCA bir kez: refundedAt null ise (terminal idempotency kilidi).
      // Böylece REFUNDED→başka→REFUNDED döngüsüyle cüzdana tekrar para yatırılamaz.
      const becomingRefunded =
        dto.status === ReturnStatus.REFUNDED && rr.refundedAt == null;

      // Tutar sipariş bedeline clamp'lenir (sipariş tutarından fazla iade edilemez).
      const orderTotal = Number(rr.order?.total ?? 0);
      let amount = dto.refundAmount ?? Number(rr.refundAmount ?? 0);
      if (amount < 0) amount = 0;
      if (amount > orderTotal) amount = orderTotal;

      let refundedAt: Date | undefined;
      if (becomingRefunded && amount > 0) {
        const u = await tx.user.findUnique({
          where: { id: rr.userId },
          select: { balance: true },
        });
        const next = Number((Number(u?.balance ?? 0) + amount).toFixed(2));
        await tx.user.update({
          where: { id: rr.userId },
          data: { balance: new Prisma.Decimal(next) },
        });
        await tx.creditLedger.create({
          data: {
            userId: rr.userId,
            delta: new Prisma.Decimal(amount),
            balanceAfter: new Prisma.Decimal(next),
            reason: `İade (cüzdan): ${rr.orderId}`,
          },
        });
        refundedAt = new Date(); // iade yapıldı → bir daha kredilenmez
      }

      return tx.returnRequest.update({
        where: { id },
        data: {
          status: dto.status,
          resolution: dto.resolution,
          adminNote: dto.adminNote,
          refundAmount:
            dto.refundAmount !== undefined
              ? new Prisma.Decimal(amount)
              : undefined,
          refundedAt,
        },
      });
    });

    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'RETURN_UPDATE',
      entityType: 'ReturnRequest',
      entityId: id,
      meta: { ...dto },
    });
    return result;
  }
}

@Controller('returns')
export class ReturnsController {
  constructor(private readonly svc: ReturnsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReturnDto) {
    return this.svc.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: ReturnStatus) {
    return this.svc.list(user, status);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Roles(Role.ADMIN, Role.PRODUCTION)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReturnDto,
  ) {
    return this.svc.update(user, id, dto);
  }
}

@Module({
  providers: [ReturnsService],
  controllers: [ReturnsController],
})
export class ReturnsModule {}
