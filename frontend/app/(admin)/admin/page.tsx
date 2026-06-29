'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ShoppingCart, DollarSign, Users, Layers, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/stat-card';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { StatCardsSkeleton, TableSkeleton } from '@/components/skeletons';
import { money, num, shortDate } from '@/lib/format';

interface Dashboard {
  orders: { total: number; last30d: number; byStatus: Record<string, number> };
  revenue: { paid: number; pending: number; last30dPaid: number };
  users: { total: number; byRole: Record<string, number> };
  production: { totalSqm: number };
}
interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  category: string;
  createdAt: string;
  clientName?: string;
}

const STATUS_BAR: Record<string, string> = {
  RECEIVED: 'bg-slate-400',
  IN_PRODUCTION: 'bg-primary',
  AWAITING_APPROVAL: 'bg-amber-500',
  READY: 'bg-emerald-500',
  SHIPPED: 'bg-emerald-700',
  CANCELLED: 'bg-rose-500',
};

export default function AdminHome() {
  const t = useTranslations('dash');
  const tos = useTranslations('orderStatus');

  const dash = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => api<Dashboard>('/reports/dashboard'),
  });
  const revenue = useQuery({
    queryKey: ['reports', 'revenue'],
    queryFn: () => api<{ month: string; total: number }[]>('/reports/revenue'),
  });
  const orders = useQuery({
    queryKey: ['orders', 'admin-recent'],
    queryFn: () => api<Order[]>('/orders?take=6'),
  });

  const d = dash.data;
  const byStatus = d?.orders.byStatus ?? {};
  const statusTotal = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1;
  const rev = revenue.data ?? [];
  const maxRev = Math.max(...rev.map((r) => r.total), 1);

  const statusOrder = ['RECEIVED', 'IN_PRODUCTION', 'AWAITING_APPROVAL', 'READY', 'SHIPPED', 'CANCELLED'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy dark:text-white">{t('totalOrders')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('last30d')}</p>
      </div>

      {dash.isLoading ? (
        <StatCardsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('totalOrders')} value={num(d?.orders.total)} icon={ShoppingCart} accent="primary" sub={`${d?.orders.last30d ?? 0} ${t('last30d')}`} />
          <StatCard label={t('paidRevenue')} value={money(d?.revenue.paid)} icon={DollarSign} accent="emerald" sub={`${money(d?.revenue.pending)} ${t('pendingRevenue')}`} />
          <StatCard label={t('activeDealers')} value={num(d?.users.total)} icon={Users} accent="amber" />
          <StatCard label={t('producedSqm')} value={`${(d?.production.totalSqm ?? 0).toFixed(1)} m²`} icon={Layers} accent="navy" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Durum dağılımı */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
          <h2 className="font-semibold text-navy dark:text-white mb-4">{t('statusBreakdown')}</h2>
          <div className="space-y-3">
            {statusOrder
              .filter((s) => byStatus[s] != null)
              .map((s) => {
                const v = byStatus[s] ?? 0;
                const pct = Math.round((v / statusTotal) * 100);
                return (
                  <div key={s}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-300">{tos(s)}</span>
                      <span className="font-semibold text-navy dark:text-white">{v}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${STATUS_BAR[s] ?? 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Aylık gelir */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
          <h2 className="font-semibold text-navy dark:text-white mb-4">{t('monthlyRevenue')}</h2>
          <div className="flex items-end gap-3 h-40">
            {rev.length === 0 ? (
              <div className="text-slate-400 dark:text-slate-500 text-sm m-auto">—</div>
            ) : (
              rev.slice(-8).map((r) => (
                <div key={r.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="text-[10px] font-semibold text-navy dark:text-white">{money(r.total)}</div>
                  <div
                    className="w-full bg-primary/80 rounded-t-md"
                    style={{ height: `${Math.max((r.total / maxRev) * 120, 6)}px` }}
                  />
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">{r.month.slice(5)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Son siparişler */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold text-navy dark:text-white">{t('recentOrders')}</h2>
          <Link href="/admin/orders" className="text-sm text-primary hover:underline flex items-center gap-1">
            {t('viewAll')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {orders.isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {(orders.data ?? []).map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-semibold text-navy dark:text-white text-sm">{o.orderNumber}</div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                  {o.clientName ?? o.category} · {shortDate(o.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold text-navy dark:text-white text-sm">{money(o.total)}</span>
                <OrderStatusBadge status={o.status} />
              </div>
            </Link>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
