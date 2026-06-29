import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsDateString,
  Min,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

// Ekip Üyesi → etkinliklerde %50 (PDF)
const MEMBER_RATE = 0.5;
function isMember(role: Role) {
  return role === Role.TEAM_MEMBER || role === Role.TEAM_LEADER;
}

class UpsertEventDto {
  @IsString() @MinLength(2) title: string;
  @IsOptional() @IsString() titleEn?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() type?: string;
  @IsDateString() startsAt: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsBoolean() isOnline?: boolean;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// Güncellemede tüm alanlar opsiyonel (partial PATCH; title/startsAt zorunlu olmasın)
class UpdateEventDto extends PartialType(UpsertEventDto) {}

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private withPricing(e: any, role: Role, registeredCount?: number) {
    const price = Number(e.price);
    const member = isMember(role);
    return {
      ...e,
      price,
      memberPrice: Number((price * MEMBER_RATE).toFixed(2)),
      yourPrice: Number((price * (member ? MEMBER_RATE : 1)).toFixed(2)),
      isMember: member,
      registeredCount,
      spotsLeft:
        e.capacity != null && registeredCount != null
          ? Math.max(0, e.capacity - registeredCount)
          : null,
    };
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.event.findMany({
      where: { active: true },
      orderBy: { startsAt: 'asc' },
      include: { _count: { select: { registrations: true } } },
    });
    const mine = new Set(
      (
        await this.prisma.eventRegistration.findMany({
          where: { userId: user.userId },
          select: { eventId: true },
        })
      ).map((r) => r.eventId),
    );
    return rows.map((e) => ({
      ...this.withPricing(e, user.role, e._count.registrations),
      registered: mine.has(e.id),
    }));
  }

  async get(user: AuthUser, id: string) {
    const e = await this.prisma.event.findUnique({
      where: { id },
      include: { _count: { select: { registrations: true } } },
    });
    if (!e || !e.active) throw new NotFoundException('Etkinlik bulunamadı');
    const registered = !!(await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: id, userId: user.userId } },
    }));
    return { ...this.withPricing(e, user.role, e._count.registrations), registered };
  }

  myRegistrations(user: AuthUser) {
    return this.prisma.eventRegistration.findMany({
      where: { userId: user.userId },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async register(user: AuthUser, eventId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Etkinlik satırını kilitle → aynı etkinliğe eşzamanlı kayıtlar serileşir
      // (kontenjan TOCTOU / overbooking yarış durumu kapanır).
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { _count: { select: { registrations: true } } },
      });
      if (!event || !event.active)
        throw new NotFoundException('Etkinlik bulunamadı');
      if (event.startsAt < new Date())
        throw new BadRequestException('Bu etkinlik başlamış/sona ermiş');
      if (event.capacity != null && event._count.registrations >= event.capacity)
        throw new BadRequestException('Kontenjan dolu');

      const existing = await tx.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId: user.userId } },
      });
      if (existing) throw new BadRequestException('Bu etkinliğe zaten kayıtlısınız');

      const member = isMember(user.role);
      const price = Number((Number(event.price) * (member ? MEMBER_RATE : 1)).toFixed(2));

      if (price > 0) {
        // Atomik koşullu düşüm (race/lost-update yok)
        const upd = await tx.user.updateMany({
          where: { id: user.userId, balance: { gte: new Prisma.Decimal(price) } },
          data: { balance: { decrement: new Prisma.Decimal(price) } },
        });
        if (upd.count === 0) {
          const cur = Number(
            (await tx.user.findUnique({ where: { id: user.userId }, select: { balance: true } }))
              ?.balance ?? 0,
          );
          throw new BadRequestException(
            `Yetersiz bakiye. Gerekli: $${price.toFixed(2)}, mevcut: $${cur.toFixed(2)}`,
          );
        }
        const next = Number(
          (await tx.user.findUnique({ where: { id: user.userId }, select: { balance: true } }))
            ?.balance ?? 0,
        );
        await tx.creditLedger.create({
          data: {
            userId: user.userId,
            delta: new Prisma.Decimal(-price),
            balanceAfter: new Prisma.Decimal(next),
            reason: `Etkinlik kaydı: ${event.title}`,
          },
        });
      }

      return tx.eventRegistration.create({
        data: {
          eventId,
          userId: user.userId,
          paidPrice: new Prisma.Decimal(price),
          isMember: member,
        },
        include: { event: true },
      });
    });

    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'EVENT_REGISTER',
      entityType: 'Event',
      entityId: eventId,
      meta: { paidPrice: Number(result.paidPrice) },
    });
    return result;
  }

  // ── Admin ──
  adminList() {
    return this.prisma.event.findMany({
      orderBy: { startsAt: 'desc' },
      include: { _count: { select: { registrations: true } } },
    });
  }

  async create(actor: AuthUser, dto: UpsertEventDto) {
    const e = await this.prisma.event.create({
      data: {
        title: dto.title,
        titleEn: dto.titleEn,
        description: dto.description,
        type: dto.type,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        isOnline: dto.isOnline ?? true,
        location: dto.location,
        capacity: dto.capacity,
        price: new Prisma.Decimal(dto.price ?? 0),
        imageUrl: dto.imageUrl,
        active: dto.active ?? true,
      },
    });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'EVENT_CREATE',
      entityType: 'Event',
      entityId: e.id,
      meta: { title: e.title },
    });
    return e;
  }

  async update(actor: AuthUser, id: string, dto: UpdateEventDto) {
    const data: Prisma.EventUpdateInput = { ...dto } as any;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.startsAt) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) data.endsAt = new Date(dto.endsAt);
    const e = await this.prisma.event.update({ where: { id }, data });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'EVENT_UPDATE',
      entityType: 'Event',
      entityId: id,
      meta: { ...dto },
    });
    return e;
  }

  async remove(actor: AuthUser, id: string) {
    const count = await this.prisma.eventRegistration.count({ where: { eventId: id } });
    if (count > 0) {
      return this.prisma.event.update({ where: { id }, data: { active: false } });
    }
    await this.prisma.event.delete({ where: { id } });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'EVENT_DELETE',
      entityType: 'Event',
      entityId: id,
    });
    return { deleted: true };
  }
}

@Controller('events')
export class EventsController {
  constructor(private readonly svc: EventsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user);
  }

  @Get('me/registrations')
  mine(@CurrentUser() user: AuthUser) {
    return this.svc.myRegistrations(user);
  }

  @Roles(Role.ADMIN)
  @Get('admin/all')
  adminList() {
    return this.svc.adminList();
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Post(':id/register')
  register(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.register(user, id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertEventDto) {
    return this.svc.create(user, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.svc.update(user, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.remove(user, id);
  }
}

@Module({
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}
