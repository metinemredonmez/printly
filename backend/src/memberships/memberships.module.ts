import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Prisma, Role, TransactionType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MEMBERSHIP_FEE } from '../common/pricing.util';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class UpgradeDto {
  // Sadece TEAM_MEMBER / TEAM_LEADER seçilebilir
  @IsEnum(Role) tier: Role;
  @IsOptional() @IsString() leaderId?: string; // TEAM_MEMBER için zorunlu
}

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  getMine(userId: string) {
    return this.prisma.membership.findUnique({ where: { userId } });
  }

  // Lider seçimi için: tüm Ekip Liderleri
  listLeaders() {
    return this.prisma.user.findMany({
      where: { role: Role.TEAM_LEADER, active: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async upgrade(userId: string, dto: UpgradeDto) {
    if (dto.tier !== Role.TEAM_MEMBER && dto.tier !== Role.TEAM_LEADER) {
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
      return this.prisma.$transaction(async (tx) => {
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
    }

    // Ekip Lideri: ücretsiz
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.TEAM_LEADER, priceMultiplier: 1, leaderId: null },
    });
    return this.prisma.membership.upsert({
      where: { userId },
      create: { userId, tier: Role.TEAM_LEADER, monthlyFee: new Prisma.Decimal(0) },
      update: { tier: Role.TEAM_LEADER, monthlyFee: new Prisma.Decimal(0), active: true },
    });
  }
}

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.memberships.getMine(user.userId);
  }

  @Get('leaders')
  leaders() {
    return this.memberships.listLeaders();
  }

  @Post('upgrade')
  upgrade(@CurrentUser() user: AuthUser, @Body() dto: UpgradeDto) {
    return this.memberships.upgrade(user.userId, dto);
  }
}

@Module({
  providers: [MembershipsService],
  controllers: [MembershipsController],
})
export class MembershipsModule {}
