import {
  Module,
  Injectable,
  Controller,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Role, TransactionType, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const since = new Date(Date.now() - 30 * 86400000);
    const [
      totalOrders,
      statusGroups,
      paidAgg,
      pendingAgg,
      sqmAgg,
      totalUsers,
      roleGroups,
      recentCount,
      recentRevenue,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: PaymentStatus.PAID } }),
      this.prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: PaymentStatus.PENDING } }),
      this.prisma.order.aggregate({ _sum: { totalSqm: true } }),
      this.prisma.user.count(),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.order.count({ where: { createdAt: { gte: since } } }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: since } },
      }),
    ]);

    return {
      orders: {
        total: totalOrders,
        last30d: recentCount,
        byStatus: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
      },
      revenue: {
        paid: Number(paidAgg._sum.total ?? 0),
        pending: Number(pendingAgg._sum.total ?? 0),
        last30dPaid: Number(recentRevenue._sum.total ?? 0),
      },
      users: {
        total: totalUsers,
        byRole: Object.fromEntries(roleGroups.map((g) => [g.role, g._count._all])),
      },
      production: { totalSqm: Number(sqmAgg._sum.totalSqm ?? 0) },
    };
  }

  // Aylık gelir (başarılı sipariş ödemeleri)
  async revenueMonthly() {
    const txns = await this.prisma.transaction.findMany({
      where: { type: TransactionType.ORDER_PAYMENT, status: TransactionStatus.SUCCESS },
      select: { amount: true, createdAt: true },
    });
    const map: Record<string, number> = {};
    for (const t of txns) {
      const k = t.createdAt.toISOString().slice(0, 7); // YYYY-MM
      map[k] = (map[k] ?? 0) + Number(t.amount);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));
  }

  // En çok sipariş veren bayiler
  async topDealers() {
    // Gelir = yalnız ÖDENMİŞ siparişler; sıralama gerçek gelire göre (L11).
    const groups = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { paymentStatus: PaymentStatus.PAID },
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: groups.map((g) => g.userId) } },
      select: { id: true, email: true, fullName: true },
    });
    const umap = Object.fromEntries(users.map((u) => [u.id, u]));
    return groups.map((g) => ({
      userId: g.userId,
      dealer: umap[g.userId]?.fullName || umap[g.userId]?.email,
      orders: g._count._all,
      revenue: Number(g._sum.total ?? 0),
    }));
  }

  // Dönem bazlı sipariş özeti
  async ordersRange(from?: string, to?: string) {
    // Geçersiz tarih → Prisma 500 yerine net 400 (M6)
    const parseDate = (s: string | undefined, label: string): Date | undefined => {
      if (!s) return undefined;
      const d = new Date(s);
      if (isNaN(d.getTime())) {
        throw new BadRequestException(`Geçersiz tarih (${label}): ${s}`);
      }
      return d;
    };
    const where = {
      createdAt: {
        gte: parseDate(from, 'from'),
        lte: parseDate(to, 'to'),
      },
    };
    const [count, byCategory, byStatus, revenue] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['category'], where, _count: { _all: true }, _sum: { total: true } }),
      this.prisma.order.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.order.aggregate({ _sum: { total: true }, where: { ...where, paymentStatus: PaymentStatus.PAID } }),
    ]);
    return {
      count,
      revenuePaid: Number(revenue._sum.total ?? 0),
      byCategory: byCategory.map((c) => ({ category: c.category, orders: c._count._all, total: Number(c._sum.total ?? 0) })),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    };
  }

  // Bayi net-kâr raporu: Etsy satış fiyatı girilmiş siparişlerde maliyet/kâr/marj.
  // Bayi yalnız kendi siparişlerini; ADMIN/PRODUCTION hepsini görür.
  async profit(user: AuthUser) {
    const staff = user.role === Role.ADMIN || user.role === Role.PRODUCTION;
    const orders = await this.prisma.order.findMany({
      where: {
        etsySalePrice: { not: null },
        ...(staff ? {} : { userId: user.userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        orderNumber: true,
        category: true,
        status: true,
        total: true,
        shippingCost: true,
        etsySalePrice: true,
        createdAt: true,
      },
    });
    let totalCost = 0;
    let totalSale = 0;
    const rows = orders.map((o) => {
      const cost = Number(o.total); // bayinin bize ödediği (maliyet)
      const sale = Number(o.etsySalePrice ?? 0);
      const profit = Number((sale - cost).toFixed(2));
      const margin = sale > 0 ? Number(((profit / sale) * 100).toFixed(1)) : 0;
      totalCost += cost;
      totalSale += sale;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        category: o.category,
        status: o.status,
        cost,
        sale,
        profit,
        margin,
        createdAt: o.createdAt,
      };
    });
    const totalProfit = Number((totalSale - totalCost).toFixed(2));
    return {
      summary: {
        count: rows.length,
        totalCost: Number(totalCost.toFixed(2)),
        totalSale: Number(totalSale.toFixed(2)),
        totalProfit,
        avgMargin: totalSale > 0 ? Number(((totalProfit / totalSale) * 100).toFixed(1)) : 0,
      },
      orders: rows,
    };
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Roles(Role.ADMIN)
  @Get('dashboard')
  dashboard() {
    return this.reports.dashboard();
  }

  @Roles(Role.ADMIN)
  @Get('revenue')
  revenue() {
    return this.reports.revenueMonthly();
  }

  @Roles(Role.ADMIN)
  @Get('dealers')
  dealers() {
    return this.reports.topDealers();
  }

  @Roles(Role.ADMIN)
  @Get('orders')
  ordersRange(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.ordersRange(from, to);
  }

  // Net-kâr raporu — bayi kendi siparişlerini, admin hepsini görür (rol bazlı scope)
  @Get('profit')
  profit(@CurrentUser() user: AuthUser) {
    return this.reports.profit(user);
  }
}

@Module({
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
