import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';

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

  // Bakiyeyi gerçekten artıran ÇEKİRDEK işlem (tx içinde). $250+ → %40 indirim hakkı.
  // SADECE güvenilir çağrılardan kullanılır: admin direkt yükleme veya onaylı ödeme.
  private async applyCredit(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ): Promise<{ balance: number; hasDiscount40: boolean }> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { balance: true, hasDiscount40: true },
    });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');

    const next = Number((Number(user.balance) + amount).toFixed(2));
    // Bakiye $100+ → indirim aktif (kademe 100/200/300 → %20/30/40; oran pricing'de mevcut bakiyeye göre)
    const grantDiscount = next >= 100 || user.hasDiscount40;

    await tx.user.update({
      where: { id: userId },
      data: { balance: new Prisma.Decimal(next), hasDiscount40: grantDiscount },
    });
    await tx.creditLedger.create({
      data: {
        userId,
        delta: new Prisma.Decimal(amount),
        balanceAfter: new Prisma.Decimal(next),
        reason: `Bakiye yükleme${next >= 100 ? ' (+indirim)' : ''}`,
      },
    });
    return { balance: next, hasDiscount40: grantDiscount };
  }

  /**
   * ADMIN/güvenilir: bakiyeyi ANINDA yükle (tahsilatın yapıldığı varsayılır).
   * Self-servis için kullanılmaz — bunun yerine requestTopUp + confirmTopUp.
   */
  async topUp(
    userId: string,
    amount: number,
    method: PaymentMethod = PaymentMethod.CARD,
    actorUserId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Tutar 0’dan büyük olmalı');

    const result = await this.prisma.$transaction(async (tx) => {
      const r = await this.applyCredit(tx, userId, amount);
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.BALANCE_LOAD,
          amount: new Prisma.Decimal(amount),
          status: TransactionStatus.SUCCESS,
          method,
          note: 'Bakiye yükleme (admin)',
        },
      });
      return r;
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

  /**
   * SELF-SERVİS: bakiye yükleme TALEBİ oluştur (PENDING). Bakiye/indirim DEĞİŞMEZ.
   * Gerçek tahsilat sonrası confirmTopUp ile (admin onayı / ödeme webhook'u) bakiyeye işlenir.
   * Bu, ödemesiz sınırsız bakiye + kalıcı %40 indirim açığını (K1) kapatır.
   */
  async requestTopUp(userId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Tutar 0’dan büyük olmalı');
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.BALANCE_LOAD,
        amount: new Prisma.Decimal(amount),
        status: TransactionStatus.PENDING,
        method: PaymentMethod.CARD,
        note: 'Bakiye yükleme talebi (ödeme onayı bekliyor)',
      },
    });
    await this.audit.log({
      actorUserId: userId,
      action: 'CREDIT_TOPUP_REQUEST',
      entityType: 'Transaction',
      entityId: tx.id,
      meta: { amount },
    });
    return {
      status: 'PENDING',
      transactionId: tx.id,
      message: 'Talep alındı. Ödeme onaylandığında bakiyenize eklenecek.',
    };
  }

  /**
   * ADMIN / ödeme webhook'u: PENDING bir yükleme talebini onaylar → bakiyeyi atomik işler.
   * İdempotent: zaten SUCCESS ise tekrar işlemez.
   */
  async confirmTopUp(actorUserId: string, transactionId: string) {
    const res = await this.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!t || t.type !== TransactionType.BALANCE_LOAD) {
        throw new NotFoundException('Yükleme talebi bulunamadı');
      }
      if (t.status === TransactionStatus.SUCCESS) {
        return { alreadyConfirmed: true, transactionId };
      }
      if (t.status !== TransactionStatus.PENDING) {
        throw new BadRequestException('Talep onaylanabilir durumda değil');
      }
      const r = await this.applyCredit(tx, t.userId, Number(t.amount));
      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.SUCCESS, note: 'Bakiye yükleme onaylandı' },
      });
      return { ...r, transactionId };
    });
    await this.audit.log({
      actorUserId,
      action: 'CREDIT_TOPUP_CONFIRM',
      entityType: 'Transaction',
      entityId: transactionId,
      meta: res,
    });
    return res;
  }
}
