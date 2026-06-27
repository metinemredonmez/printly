'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Search, PlusCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/skeletons';
import type { Order } from '@/lib/orders';

export function OrdersList({
  basePath,
  staff = false,
}: {
  basePath: string;
  staff?: boolean;
}) {
  const t = useTranslations('orders');
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'list', archived],
    queryFn: () => api<Order[]>(`/orders?take=100${archived ? '&archived=true' : ''}`),
  });

  const rows = (data ?? []).filter((o) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(s) ||
      (o.clientName ?? '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-navy">
          {staff ? t('title') : t('myTitle')}
        </h1>
        {!staff && (
          <Link
            href="/app/orders/new"
            className="inline-flex items-center gap-2 px-5 h-11 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            {t('new')}
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search')}
            className="pl-9 bg-white"
          />
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button
            onClick={() => setArchived(false)}
            className={`px-4 py-2 ${!archived ? 'bg-primary text-white' : 'bg-white text-slate-500'}`}
          >
            {t('active')}
          </button>
          <button
            onClick={() => setArchived(true)}
            className={`px-4 py-2 ${archived ? 'bg-primary text-white' : 'bg-white text-slate-500'}`}
          >
            {t('archived')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400">
          <div className="col-span-3">{t('orderNo')}</div>
          <div className="col-span-2">{t('category')}</div>
          <div className="col-span-3">{t('customer')}</div>
          <div className="col-span-2 text-right">{t('total')}</div>
          <div className="col-span-2 text-right">{t('status')}</div>
        </div>
        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">{t('empty')}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((o) => (
              <Link
                key={o.id}
                href={`${basePath}/${o.id}`}
                className="grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors"
              >
                <div className="md:col-span-3">
                  <div className="font-semibold text-navy text-sm">{o.orderNumber}</div>
                  <div className="text-[11px] text-slate-400">{shortDate(o.createdAt)}</div>
                </div>
                <div className="md:col-span-2 text-sm text-slate-500">{o.category}</div>
                <div className="md:col-span-3 text-sm text-slate-600 truncate">
                  {o.clientName ?? o.user?.email ?? '—'}
                </div>
                <div className="md:col-span-2 text-right font-semibold text-navy text-sm">
                  {money(o.total)}
                </div>
                <div className="md:col-span-2 flex md:justify-end">
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
