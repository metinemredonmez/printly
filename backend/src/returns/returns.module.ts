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
    const open = await this.prisma.returnRequest.findFirst({
      where: {
        orderId: dto.orderId,
        status: { in: [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.RECEIVED] },
      },
    });
    if (open) throw new BadRequestException('Bu sipariş için açık bir iade talebi var');

    const rr = await this.prisma.returnRequest.create({
      data: {
        orderId: dto.orderId,
        userId: order.userId,
        reason: dto.reason ?? ReturnReason.OTHER,
        details: dto.details,
      },
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

  list(user: AuthUser, status?: ReturnStatus) {
    return this.prisma.returnRequest.findMany({
      where: {
        status,
        ...(isStaff(user.role) ? {} : { userId: user.userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        order: { select: { id: true, orderNumber: true, total: true, category: true } },
        ...(isStaff(user.role)
          ? { user: { select: { id: true, fullName: true, email: true } } }
          : {}),
      },
    });
  }

  async get(user: AuthUser, id: string) {
    const rr = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!rr) throw new NotFoundException('İade talebi bulunamadı');
    if (!isStaff(user.role) && rr.userId !== user.userId) {
      throw new ForbiddenException('Bu talebe erişiminiz yok');
    }
    return rr;
  }

  // Staff: durum/çözüm; REFUNDED + refundAmount → cüzdana atomik iade
  async update(user: AuthUser, id: string, dto: UpdateReturnDto) {
    if (!isStaff(user.role)) throw new ForbiddenException('Yalnız personel güncelleyebilir');

    const result = await this.prisma.$transaction(async (tx) => {
      const rr = await tx.returnRequest.findUnique({ where: { id } });
      if (!rr) throw new NotFoundException('İade talebi bulunamadı');

      // Para iadesi: REFUNDED'a geçerken ve daha önce iade edilmemişse cüzdana ekle
      const becomingRefunded =
        dto.status === ReturnStatus.REFUNDED && rr.status !== ReturnStatus.REFUNDED;
      const amount = dto.refundAmount ?? Number(rr.refundAmount ?? 0);

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
      }

      return tx.returnRequest.update({
        where: { id },
        data: {
          status: dto.status,
          resolution: dto.resolution,
          adminNote: dto.adminNote,
          refundAmount:
            dto.refundAmount !== undefined
              ? new Prisma.Decimal(dto.refundAmount)
              : undefined,
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
