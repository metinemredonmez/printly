import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Body,
  Param,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  Prisma,
  Role,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { SettingsService } from '../settings/settings.module';
import { MEMBERSHIP_FEE } from '../common/pricing.util';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

type Tier = { name: string; minLoad: number; discountRate: number; priority: boolean };

class UpgradeDto {
  // Sadece TEAM_MEMBER / TEAM_LEADER seçilebilir
  @IsEnum(Role) tier: Role;
  @IsOptional() @IsString() leaderId?: string; // TEAM_MEMBER için zorunlu
}

@Injectable()
export class MembershipsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private settings: SettingsService,
  ) {}

  getMine(userId: string) {
    return this.prisma.membership.findUnique({ where: { userId } });
  }

  // Kümülatif yüklemeye göre bayi planı/indirimi (D1/#40)
  async myTier(userId: string) {
    const loads = await this.prisma.transaction.aggregate({
      where: {
        userId,
        type: TransactionType.BALANCE_LOAD,
        status: TransactionStatus.SUCCESS,
      },
      _sum: { amount: true },
    });
    const cumulativeLoad = Number(loads._sum.amount ?? 0);
    const tiers = await this.settings.get<Tier[]>('membershipTiers', [
      { name: 'Standart', minLoad: 0, discountRate: 0.4, priority: false },
    ]);
    const tier =
      [...tiers]
        .sort((a, b) => b.minLoad - a.minLoad)
        .find((t) => cumulativeLoad >= t.minLoad) ?? tiers[0];
    return { cumulativeLoad, tier, allTiers: tiers };
  }

  // Lider seçimi için: tüm Ekip Liderleri (e-posta PII sızdırma — id+ad yeterli)
  listLeaders() {
    return this.prisma.user.findMany({
      where: { role: Role.TEAM_LEADER, active: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async upgrade(userId: string, dto: UpgradeDto) {
    // Self-servis yalnız Ekip Üyeliği (aidatlı). Ekip Lideri yükseltmesi yönetici onayı ister
    // (ücretsiz lider + fiyat çarpanı 1x suistimalini kapatır — K2/H3).
    if (dto.tier === Role.TEAM_LEADER) {
      throw new ForbiddenException(
        'Ekip Lideri yükseltmesi yönetici onayı gerektirir (self-servis kapalı)',
      );
    }
    if (dto.tier !== Role.TEAM_MEMBER) {
      throw new BadRequestException('Geçersiz üyelik tipi');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');

    // Ekip Üyesi: lider zorunlu + $30 aidat (bakiyeden tahsil)
    if (dto.tier === Role.TEAM_MEMBER) {
      if (!dto.leaderId) throw new BadRequestException('Ekip lideri seçilmeli');
      const leader = await this.prisma.user.findUnique({
        where: { id: dto.leaderId },
      });
      if (!leader || leader.role !== Role.TEAM_LEADER) {
        throw new BadRequestException('Geçerli bir ekip lideri seçin');
      }
      const membership = await this.prisma.$transaction(async (tx) => {
        // Aidatı atomik düş — yetersizse hiç düşmez (yarış-koşulsuz)
        const affected = await tx.$executeRaw`UPDATE "User" SET balance = balance - ${MEMBERSHIP_FEE}::numeric WHERE id = ${userId} AND balance >= ${MEMBERSHIP_FEE}::numeric`;
        if (affected === 0) {
          throw new BadRequestException(
            `Aidat için yetersiz bakiye ($${MEMBERSHIP_FEE}). Önce bakiye yükleyin.`,
          );
        }
        await tx.user.update({
          where: { id: userId },
          data: {
            role: Role.TEAM_MEMBER,
            priceMultiplier: 1,
            leaderId: dto.leaderId,
          },
        });
        const u = await tx.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });
        const newBalance = Number(u?.balance ?? 0);
        await tx.creditLedger.create({
          data: {
            userId,
            delta: new Prisma.Decimal(-MEMBERSHIP_FEE),
            balanceAfter: new Prisma.Decimal(newBalance),
            reason: 'Ekip Üyeliği aidatı',
          },
        });
        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.MEMBERSHIP_FEE,
            amount: new Prisma.Decimal(MEMBERSHIP_FEE),
            method: PaymentMethod.BALANCE,
            note: 'Ekip Üyeliği aidatı',
          },
        });
        return tx.membership.upsert({
          where: { userId },
          create: {
            userId,
            tier: Role.TEAM_MEMBER,
            monthlyFee: new Prisma.Decimal(MEMBERSHIP_FEE),
            leaderId: dto.leaderId,
            renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          update: {
            tier: Role.TEAM_MEMBER,
            monthlyFee: new Prisma.Decimal(MEMBERSHIP_FEE),
            leaderId: dto.leaderId,
            active: true,
            renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      });
      await this.audit.log({
        actorUserId: userId,
        action: 'MEMBERSHIP_UPGRADE',
        entityType: 'User',
        entityId: userId,
        meta: { tier: 'TEAM_MEMBER', leaderId: dto.leaderId, fee: MEMBERSHIP_FEE },
      });
      return membership;
    }

    // Buraya yalnız TEAM_MEMBER akışı gelir; TEAM_LEADER yukarıda reddedildi.
    throw new BadRequestException('Geçersiz üyelik tipi');
  }

  // ADMIN: bir kullanıcıyı Ekip Lideri yap (self-servis DEĞİL — fiyat çarpanı 1x'e düşer)
  async promoteToLeader(actorUserId: string, targetUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: Role.TEAM_LEADER, priceMultiplier: 1, leaderId: null },
    });
    const leaderMembership = await this.prisma.membership.upsert({
      where: { userId: targetUserId },
      create: { userId: targetUserId, tier: Role.TEAM_LEADER, monthlyFee: new Prisma.Decimal(0) },
      update: { tier: Role.TEAM_LEADER, monthlyFee: new Prisma.Decimal(0), active: true },
    });
    await this.audit.log({
      actorUserId,
      action: 'MEMBERSHIP_UPGRADE',
      entityType: 'User',
      entityId: targetUserId,
      meta: { tier: 'TEAM_LEADER', fee: 0, by: 'admin' },
    });
    return leaderMembership;
  }
}

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.memberships.getMine(user.userId);
  }

  // Kümülatif yüklemeye göre bayi planı + indirim/öncelik (D1/#40)
  @Get('tier')
  myTier(@CurrentUser() user: AuthUser) {
    return this.memberships.myTier(user.userId);
  }

  @Get('leaders')
  leaders() {
    return this.memberships.listLeaders();
  }

  @Post('upgrade')
  upgrade(@CurrentUser() user: AuthUser, @Body() dto: UpgradeDto) {
    return this.memberships.upgrade(user.userId, dto);
  }

  // ADMIN: bir kullanıcıyı Ekip Lideri yap (self-servis lider yükseltmesi kapalı)
  @Roles(Role.ADMIN)
  @Post('leader/:userId')
  promoteLeader(@CurrentUser() admin: AuthUser, @Param('userId') userId: string) {
    return this.memberships.promoteToLeader(admin.userId, userId);
  }
}

@Module({
  providers: [MembershipsService],
  controllers: [MembershipsController],
})
export class MembershipsModule {}
