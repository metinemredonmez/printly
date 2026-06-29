'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  Wallet,
  ShoppingCart,
  Crown,
  Percent,
  PlusCircle,
  ArrowRight,
  GraduationCap,
  Headset,
  CalendarDays,
  Network,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
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

interface QuickLink {
  href: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  accent: string;
}

export default function DealerHome() {
  const t = useTranslations('dash');
  const td = useTranslations('dealerHome');
  const nav = useTranslations('nav');
  const tr = useLocale() === 'tr';

  const quickLinks: QuickLink[] = [
    {
      href: '/app/education',
      icon: GraduationCap,
      label: tr ? 'Eğitim' : 'Education',
      desc: tr ? 'Kurslar ve rehberler' : 'Courses and guides',
      accent: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
    },
    {
      href: '/app/consulting',
      icon: Headset,
      label: tr ? 'Danışmanlık' : 'Consulting',
      desc: tr ? 'Uzman desteği alın' : 'Get expert support',
      accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    },
    {
      href: '/app/events',
      icon: CalendarDays,
      label: tr ? 'Etkinlikler' : 'Events',
      desc: tr ? 'Yaklaşan buluşmalar' : 'Upcoming meetups',
      accent: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    },
    {
      href: '/app/network',
      icon: Network,
      label: tr ? 'Networking' : 'Networking',
      desc: tr ? 'Bayilerle bağlantı kurun' : 'Connect with dealers',
      accent: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    },
    {
      href: '/app/returns',
      icon: Undo2,
      label: tr ? 'İadeler' : 'Returns',
      desc: tr ? 'İade taleplerinizi yönetin' : 'Manage your returns',
      accent: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
    },
  ];

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
          <h1 className="text-xl font-semibold text-navy dark:text-white">{td('welcome')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{td('subtitle')}</p>
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

      {/* Quick Access */}
      <div className="space-y-3">
        <h2 className="font-semibold text-navy dark:text-white">
          {tr ? 'Hızlı Erişim' : 'Quick Access'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {quickLinks.map(({ href, icon: Icon, label, desc, accent }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 hover:shadow-lg hover:-translate-y-0.5 dark:hover:shadow-black/20 transition-all"
            >
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${accent}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 font-semibold text-navy dark:text-white text-sm">{label}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold text-navy dark:text-white">{t('recentOrders')}</h2>
          <Link href="/app/orders" className="text-sm text-primary hover:underline flex items-center gap-1">
            {t('viewAll')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {orders.isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : recent.length === 0 ? (
          <div className="p-10 text-center text-slate-400 dark:text-slate-500 text-sm">{t('noOrders')}</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/app/orders/${o.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-navy dark:text-white text-sm">{o.orderNumber}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    {o.category} · {shortDate(o.createdAt)}
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
