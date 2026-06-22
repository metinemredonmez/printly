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
    const groups = await this.prisma.order.groupBy({
      by: ['userId'],
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { _count: { userId: 'desc' } },
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
}

@Module({
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
