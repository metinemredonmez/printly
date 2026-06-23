import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
  TransactionType,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { AuditService } from '../audit/audit.module';
import { SettingsService } from '../settings/settings.module';
import { WebhooksService } from '../webhooks/webhooks.module';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { refundOnCancel } from '../common/refund.util';
import { CreateOrderDto } from './dto';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
  IN_PRODUCTION: [OrderStatus.AWAITING_APPROVAL, OrderStatus.READY, OrderStatus.CANCELLED],
  AWAITING_APPROVAL: [OrderStatus.IN_PRODUCTION, OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private audit: AuditService,
    private settings: SettingsService,
    private webhooks: WebhooksService,
  ) {}

  // Üretim-öncesi onay (H2/#33) — staff onaylar; gate updateStatus'ta uygulanır
  async approve(authUser: AuthUser, id: string) {
    if (authUser.role !== Role.ADMIN && authUser.role !== Role.PRODUCTION) {
      throw new ForbiddenException('Yalnız personel onaylayabilir');
    }
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const updated = await this.prisma.order.update({
      where: { id },
      data: { approvedAt: new Date(), approvedByUserId: authUser.userId },
    });
    await this.audit.log({
      actorUserId: authUser.userId,
      actorRole: authUser.role,
      action: 'ORDER_APPROVE',
      entityType: 'Order',
      entityId: id,
    });
    return updated;
  }

  async create(authUser: AuthUser, dto: CreateOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.userId },
    });
    if (!user) throw new ForbiddenException('Kullanıcı bulunamadı');

    // Ürün doğrulama (M1): geçerli + aktif + kategori sipariş kategorisiyle uyumlu olmalı.
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
      select: { id: true, category: true, active: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      const p = byId.get(item.productId);
      if (!p) throw new BadRequestException(`Ürün bulunamadı: ${item.productId}`);
      if (!p.active) throw new BadRequestException(`Ürün pasif: ${item.productId}`);
      if (p.category !== dto.category) {
        throw new BadRequestException(
          `Ürün kategorisi sipariş kategorisiyle uyuşmuyor (${p.category} ≠ ${dto.category})`,
        );
      }
    }

    const quote = await this.pricing.quoteOrder(
      dto.items,
      dto.extras ?? [],
      user.priceMultiplier,
      user.hasDiscount40,
    );

    const isBalance = dto.paymentMethod === PaymentMethod.BALANCE;
    // BALANCE → ödeme atomik düşümle alınır (PAID). CARD → gerçek gateway gelene dek PENDING.
    const paymentStatus = isBalance ? PaymentStatus.PAID : PaymentStatus.PENDING;

    const created = await this.prisma.$transaction(async (tx) => {
      // Bakiye: yarış-koşulsuz ATOMİK düşüm — yalnız yeterliyse düşer.
      let newBalance = 0;
      if (isBalance) {
        const affected = await tx.$executeRaw`UPDATE "User" SET balance = balance - ${quote.total}::numeric WHERE id = ${user.id} AND balance >= ${quote.total}::numeric`;
        if (affected === 0) {
          throw new BadRequestException(
            `Yetersiz bakiye. Gerekli: $${quote.total}, Mevcut: $${Number(user.balance)}`,
          );
        }
        const u = await tx.user.findUnique({
          where: { id: user.id },
          select: { balance: true },
        });
        newBalance = Number(u?.balance ?? 0);
      }

      const order = await tx.order.create({
        data: {
          userId: user.id,
          createdByUserId: authUser.userId,
          organizationId: user.organizationId ?? undefined,
          category: dto.category,
          productType: dto.productType,
          paymentMethod: dto.paymentMethod,
          paymentStatus,
          status: OrderStatus.RECEIVED,
          subtotal: quote.subtotal,
          extrasTotal: quote.extrasTotal,
          discount40: quote.discount40,
          total: quote.total,
          totalSqm: quote.totalSqm,
          etsyStoreId: dto.etsyStoreId,
          etsyOrderNo: dto.etsyOrderNo,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          clientName: dto.clientName,
          clientAddress: dto.clientAddress,
          clientCountry: dto.clientCountry,
          clientCity: dto.clientCity,
          clientState: dto.clientState,
          clientZip: dto.clientZip,
          clientPhone: dto.clientPhone,
          clientNote: dto.clientNote,
          items: {
            create: quote.items.map((it, idx) => ({
              productId: it.productId,
              widthInch: it.widthInch,
              heightInch: it.heightInch,
              widthCm: it.widthCm,
              heightCm: it.heightCm,
              sqft: it.sqft,
              sqm: it.sqm,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              lineTotal: it.lineTotal,
              notes: dto.items[idx]?.notes,
            })),
          },
          extras: {
            create: quote.extras.map((e) => ({
              name: e.name,
              price: e.price,
              quantity: e.quantity,
              extraOptionId: e.extraOptionId,
            })),
          },
          statusEvents: {
            create: { toStatus: OrderStatus.RECEIVED, byUserId: authUser.userId },
          },
        },
        include: { items: true, extras: true },
      });

      // Bakiye düştüyse defter kaydı (düşüm yukarıda atomik yapıldı)
      if (isBalance) {
        await tx.creditLedger.create({
          data: {
            userId: user.id,
            delta: new Prisma.Decimal(-quote.total),
            balanceAfter: new Prisma.Decimal(newBalance),
            reason: `Sipariş ödemesi #${order.orderNumber}`,
            orderId: order.id,
          },
        });
      }

      await tx.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.ORDER_PAYMENT,
          amount: new Prisma.Decimal(quote.total),
          status: isBalance ? TransactionStatus.SUCCESS : TransactionStatus.PENDING,
          method: dto.paymentMethod,
          orderId: order.id,
          note: `Sipariş #${order.orderNumber}`,
        },
      });

      return order;
    });

    await this.audit.log({
      actorUserId: authUser.userId,
      actorRole: authUser.role,
      action: 'ORDER_CREATE',
      entityType: 'Order',
      entityId: created.id,
      meta: {
        total: quote.total,
        category: dto.category,
        paymentMethod: dto.paymentMethod,
      },
    });
    return created;
  }

  // Arşivlenmemiş varsayılan + pagination (P1). archived=true ile arşiv listelenir.
  findAll(
    authUser: AuthUser,
    opts: { archived?: boolean; skip?: number; take?: number } = {},
  ) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
    return this.prisma.order.findMany({
      where: {
        ...this.scopeFilter(authUser),
        archivedAt: opts.archived ? { not: null } : null,
      },
      orderBy: { createdAt: 'desc' },
      skip: opts.skip && opts.skip > 0 ? opts.skip : undefined,
      take,
      include: {
        items: true,
        extras: true,
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  // Arşivle / arşivden çıkar (yalnız personel) — #13
  async setArchived(authUser: AuthUser, id: string, archived: boolean) {
    if (authUser.role !== Role.ADMIN && authUser.role !== Role.PRODUCTION) {
      throw new ForbiddenException('Yalnız personel arşivleyebilir');
    }
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const updated = await this.prisma.order.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await this.audit.log({
      actorUserId: authUser.userId,
      actorRole: authUser.role,
      action: archived ? 'ORDER_ARCHIVE' : 'ORDER_UNARCHIVE',
      entityType: 'Order',
      entityId: id,
    });
    return updated;
  }

  async findOne(authUser: AuthUser, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        extras: true,
        assets: true,
        statusEvents: { orderBy: { createdAt: 'asc' } },
        etsyStore: true,
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    this.assertAccess(authUser, order.userId);
    return order;
  }

  async updateStatus(
    authUser: AuthUser,
    id: string,
    newStatus: OrderStatus,
    note?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');

    const allowed = TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Geçersiz geçiş: ${order.status} → ${newStatus}`);
    }

    // H2 (#33): RECEIVED→IN_PRODUCTION onay gerektirir (ayardan kapatılabilir).
    // Pahalı m²/CNC siparişinde hatalı dosya/ölçüyle üretime düşmeyi engeller.
    if (newStatus === OrderStatus.IN_PRODUCTION && order.status === OrderStatus.RECEIVED) {
      const requireApproval = await this.settings.get<boolean>(
        'requireProductionApproval',
        true,
      );
      if (requireApproval && !order.approvedAt) {
        throw new BadRequestException(
          'Üretime geçmeden önce sipariş onaylanmalı (POST /orders/:id/approve)',
        );
      }
    }

    const { updated, refunded } = await this.prisma.$transaction(async (tx) => {
      // İptalde BALANCE+PAID siparişte atomik bakiye iadesi
      const didRefund = await refundOnCancel(tx, order, newStatus);
      const o = await tx.order.update({
        where: { id },
        data: {
          status: newStatus,
          ...(didRefund ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
          statusEvents: {
            create: {
              fromStatus: order.status,
              toStatus: newStatus,
              note,
              byUserId: authUser.userId,
            },
          },
        },
        include: { statusEvents: { orderBy: { createdAt: 'asc' } } },
      });
      return { updated: o, refunded: didRefund };
    });
    await this.audit.log({
      actorUserId: authUser.userId,
      actorRole: authUser.role,
      action: 'ORDER_STATUS_CHANGE',
      entityType: 'Order',
      entityId: id,
      meta: { from: order.status, to: newStatus, note, refunded },
    });
    // Partner webhook (O2/#37): bayinin aboneliklerine imzalı bildirim
    await this.webhooks.dispatch(
      'order.status_changed',
      { userId: order.userId, organizationId: order.organizationId },
      {
        orderId: id,
        orderNumber: order.orderNumber,
        from: order.status,
        to: newStatus,
      },
    );
    return updated;
  }

  // Bayi sadece kendi siparişlerini; ADMIN/PRODUCTION hepsini görür.
  private scopeFilter(authUser: AuthUser) {
    if (authUser.role === Role.ADMIN || authUser.role === Role.PRODUCTION) return {};
    return { userId: authUser.userId };
  }

  private assertAccess(authUser: AuthUser, ownerId: string) {
    if (authUser.role === Role.ADMIN || authUser.role === Role.PRODUCTION) return;
    if (authUser.userId !== ownerId) {
      throw new ForbiddenException('Bu siparişe erişiminiz yok');
    }
  }
}
