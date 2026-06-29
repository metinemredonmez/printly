'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  MapPin,
  Activity,
  Package,
  Globe,
  Clock,
  CircleDot,
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/skeletons';
import { money, shortDate } from '@/lib/format';

type ActiveOrder = {
  id: string;
  orderNumber: string;
  status: string;
  clientName: string | null;
  clientCity: string | null;
  clientCountry: string | null;
  total: number | null;
  createdAt: string;
};

type ActiveOrdersResponse = {
  count: number;
  orders: ActiveOrder[];
};

type ActivityEvent = {
  id: string;
  action: string;
  entityType: string;
  actorUserId: string | null;
  createdAt: string;
};

type ActivityResponse = {
  count: number;
  events: ActivityEvent[];
};

export default function MapPage() {
  const t = useTranslations('map');

  const orders = useQuery({
    queryKey: ['map', 'active-orders'],
    queryFn: () => api<ActiveOrdersResponse>('/map/active-orders'),
  });

  const activity = useQuery({
    queryKey: ['map', 'activity'],
    queryFn: () => api<ActivityResponse>('/map/activity'),
  });

  const orderList = orders.data?.orders ?? [];
  const eventList = activity.data?.events ?? [];

  const countries = new Set(
    orderList.map((o) => o.clientCountry).filter(Boolean) as string[],
  ).size;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-navy dark:text-white">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('statActiveOrders')}
          value={orders.isLoading ? '…' : orders.data?.count ?? 0}
          icon={Package}
          accent="primary"
        />
        <StatCard
          label={t('statCountries')}
          value={orders.isLoading ? '…' : countries}
          icon={Globe}
          accent="navy"
        />
        <StatCard
          label={t('statEvents')}
          value={activity.isLoading ? '…' : activity.data?.count ?? 0}
          icon={Activity}
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-navy dark:text-white">{t('ordersHeading')}</h2>
          </div>

          {orders.isLoading ? (
            <ListSkeleton rows={4} />
          ) : orderList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-10 text-center">
              <MapPin className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('ordersEmpty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {orderList.map((o) => (
                <div
                  key={o.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-navy dark:text-white text-sm truncate">
                        {o.orderNumber}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {o.clientName ?? t('unknownClient')}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {o.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500 dark:text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="truncate">
                      {[o.clientCity, o.clientCountry]
                        .filter(Boolean)
                        .join(', ') || t('unknownLocation')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-semibold text-navy dark:text-white">
                      {money(o.total)}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {shortDate(o.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-navy dark:text-white">
              {t('activityHeading')}
            </h2>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
            {activity.isLoading ? (
              <ListSkeleton rows={4} />
            ) : eventList.length === 0 ? (
              <div className="py-6 text-center">
                <Activity className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('activityEmpty')}</p>
              </div>
            ) : (
              <ol className="space-y-4">
                {eventList.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <CircleDot className="h-3.5 w-3.5 text-primary shrink-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-navy dark:text-white">
                        {e.action}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {e.entityType}
                        {e.actorUserId
                          ? ` · ${t('byUser', { user: e.actorUserId })}`
                          : ''}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        <Clock className="h-3 w-3" />
                        {shortDate(e.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
