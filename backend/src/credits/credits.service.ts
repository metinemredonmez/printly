import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, TransactionType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { BULK_LOAD_FOR_DISCOUNT } from '../common/pricing.util';

@Injectable()
export class CreditsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async balance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, hasDiscount40: true },
    });
    return {
      balance: Number(user?.balance ?? 0),
      hasDiscount40: user?.hasDiscount40 ?? false,
    };
  }

  ledger(userId: string) {
    return this.prisma.creditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Bakiye yükleme (+). $250 ve üzeri yükleme → %40 indirim hakkı (hasDiscount40).
   * method=CARD ödeme simüle edilir (gerçek gateway Faz 2).
   */
  async topUp(
    userId: string,
    amount: number,
    method: PaymentMethod = PaymentMethod.CARD,
    actorUserId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Tutar 0’dan büyük olmalı');

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true, hasDiscount40: true },
      });
      if (!user) throw new BadRequestException('Kullanıcı bulunamadı');

      const next = Number((Number(user.balance) + amount).toFixed(2));
      const grantDiscount = amount >= BULK_LOAD_FOR_DISCOUNT || user.hasDiscount40;

      await tx.user.update({
        where: { id: userId },
        data: {
          balance: new Prisma.Decimal(next),
          hasDiscount40: grantDiscount,
        },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          delta: new Prisma.Decimal(amount),
          balanceAfter: new Prisma.Decimal(next),
          reason: `Bakiye yükleme${amount >= BULK_LOAD_FOR_DISCOUNT ? ' (+%40 indirim)' : ''}`,
        },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.BALANCE_LOAD,
          amount: new Prisma.Decimal(amount),
          method,
          note: 'Bakiye yükleme',
        },
      });

      return { balance: next, hasDiscount40: grantDiscount };
    });

    await this.audit.log({
      actorUserId: actorUserId ?? userId,
      action: 'CREDIT_TOPUP',
      entityType: 'User',
      entityId: userId,
      meta: { amount, method, balanceAfter: result.balance },
    });
    return result;
  }
}
