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
import { AuthUser } from '../common/decorators/current-user.decorator';
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
  ) {}

  async create(authUser: AuthUser, dto: CreateOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.userId },
    });
    if (!user) throw new ForbiddenException('Kullanıcı bulunamadı');

    const quote = await this.pricing.quoteOrder(
      dto.items,
      dto.extras ?? [],
      user.priceMultiplier,
      user.hasDiscount40,
    );

    const isBalance = dto.paymentMethod === PaymentMethod.BALANCE;
    // BALANCE → ödeme atomik düşümle alınır (PAID). CARD → gerçek gateway gelene dek PENDING.
    const paymentStatus = isBalance ? PaymentStatus.PAID : PaymentStatus.PENDING;

    return this.prisma.$transaction(async (tx) => {
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
  }

  findAll(authUser: AuthUser) {
    return this.prisma.order.findMany({
      where: this.scopeFilter(authUser),
      orderBy: { createdAt: 'desc' },
      include: { items: true, extras: true, user: { select: { id: true, email: true, fullName: true } } },
    });
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

    return this.prisma.order.update({
      where: { id },
      data: {
        status: newStatus,
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
