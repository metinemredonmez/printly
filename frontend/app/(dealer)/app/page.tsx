'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Wallet, ShoppingCart, Crown, Percent, PlusCircle, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/stat-card';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { StatCardsSkeleton, TableSkeleton } from '@/components/skeletons';
import { money, shortDate } from '@/lib/format';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  category: string;
  createdAt: string;
  clientName?: string;
}

export default function DealerHome() {
  const t = useTranslations('dash');
  const td = useTranslations('dealerHome');
  const nav = useTranslations('nav');

  const credits = useQuery({
    queryKey: ['credits', 'me'],
    queryFn: () => api<{ balance: number; hasDiscount40: boolean }>('/credits/me'),
  });
  const tier = useQuery({
    queryKey: ['memberships', 'tier'],
    queryFn: () => api<{ tier: { name: string } }>('/memberships/tier'),
  });
  const orders = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => api<Order[]>('/orders?take=6'),
  });

  const recent = orders.data ?? [];
  const active = recent.filter((o) => !['SHIPPED', 'CANCELLED'].includes(o.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">{td('welcome')}</h1>
          <p className="text-slate-500">{td('subtitle')}</p>
        </div>
        <Link
          href="/app/orders/new"
          className="inline-flex items-center gap-2 px-5 h-11 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          {nav('newOrder')}
        </Link>
      </div>

      {credits.isLoading || orders.isLoading || tier.isLoading ? (
        <StatCardsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t('balance')}
            value={money(credits.data?.balance)}
            icon={Wallet}
            accent="primary"
          />
          <StatCard
            label={t('activeOrders')}
            value={active}
            icon={ShoppingCart}
            accent="emerald"
          />
          <StatCard
            label={t('membership')}
            value={tier.data?.tier?.name ?? '—'}
            icon={Crown}
            accent="amber"
          />
          <StatCard
            label={t('discount')}
            value={credits.data?.hasDiscount40 ? t('discountActive') : t('discountInactive')}
            icon={Percent}
            accent={credits.data?.hasDiscount40 ? 'emerald' : 'navy'}
          />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-navy">{t('recentOrders')}</h2>
          <Link href="/app/orders" className="text-sm text-primary hover:underline flex items-center gap-1">
            {t('viewAll')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {orders.isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : recent.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">{t('noOrders')}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/app/orders/${o.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-navy text-sm">{o.orderNumber}</div>
                  <div className="text-[11px] text-slate-400">
                    {o.category} · {shortDate(o.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-navy text-sm">{money(o.total)}</span>
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
