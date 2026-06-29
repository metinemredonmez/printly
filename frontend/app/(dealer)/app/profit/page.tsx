'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import {
  Coins,
  ShoppingBag,
  TrendingUp,
  Percent,
  PiggyBank,
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/stat-card';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { TableSkeleton } from '@/components/skeletons';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ProfitOrder {
  id: string;
  orderNumber: string;
  category: string;
  status: string;
  cost: number; // bayinin Ortak Doku'ya ödediği (maliyet)
  sale: number; // bayinin Etsy satış fiyatı
  profit: number; // sale - cost
  margin: number; // %
  createdAt: string;
}

interface ProfitSummary {
  count: number;
  totalCost: number;
  totalSale: number;
  totalProfit: number;
  avgMargin: number;
}

interface ProfitReport {
  summary: ProfitSummary;
  orders: ProfitOrder[];
}

const PAGE_SIZE = 12;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ProfitPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['reports', 'profit'],
    queryFn: () => api<ProfitReport>('/reports/profit'),
  });

  const summary = data?.summary ?? {
    count: 0,
    totalCost: 0,
    totalSale: 0,
    totalProfit: 0,
    avgMargin: 0,
  };
  const orders = data?.orders ?? [];

  /* --- Search --- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const hay = `${o.orderNumber} ${o.category} ${o.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [orders, search]);

  /* --- Pagination --- */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy dark:text-white">{L.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{L.subtitle}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
        >
          <RotateCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {L.refresh}
        </Button>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-100 bg-white p-5 h-[104px] animate-pulse dark:bg-slate-900 dark:border-slate-800"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={L.totalCost}
            value={money(summary.totalCost)}
            icon={Coins}
            accent="amber"
            sub={L.totalCostSub}
          />
          <StatCard
            label={L.totalSale}
            value={money(summary.totalSale)}
            icon={ShoppingBag}
            accent="primary"
            sub={L.totalSaleSub}
          />
          <StatCard
            label={L.totalProfit}
            value={`${summary.totalProfit >= 0 ? '+' : '−'}${money(Math.abs(summary.totalProfit))}`}
            icon={summary.totalProfit >= 0 ? TrendingUp : PiggyBank}
            accent={summary.totalProfit >= 0 ? 'emerald' : 'rose'}
            sub={L.totalProfitSub}
          />
          <StatCard
            label={L.avgMargin}
            value={pct(summary.avgMargin, tr)}
            icon={Percent}
            accent={summary.avgMargin >= 0 ? 'navy' : 'rose'}
            sub={L.countSub(summary.count)}
          />
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-navy dark:text-white">{L.breakdown}</h2>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 rounded-full px-2 py-0.5">
              {filtered.length}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={L.searchPlaceholder}
              className="h-9 pl-9 w-full sm:w-64 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </div>
        </div>

        {/* Column header (desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <div className="col-span-4">{L.colOrder}</div>
          <div className="col-span-2">{L.colStatus}</div>
          <div className="col-span-2 text-right">{L.colCost}</div>
          <div className="col-span-2 text-right">{L.colSale}</div>
          <div className="col-span-2 text-right">{L.colProfit}</div>
        </div>

        {/* Body */}
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : isError ? (
          <ErrorBlock
            message={error instanceof Error ? error.message : L.loadError}
            retry={() => refetch()}
            retryLabel={L.retry}
          />
        ) : orders.length === 0 ? (
          <EmptyBlock title={L.emptyTitle} description={L.emptyDesc} />
        ) : filtered.length === 0 ? (
          <EmptyBlock title={L.noMatchTitle} description={L.noMatchDesc} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pageRows.map((o) => {
              const up = o.profit >= 0;
              return (
                <div
                  key={o.id}
                  className="grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-2 px-5 py-3.5 items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Order (number + category + date) */}
                  <div className="col-span-2 md:col-span-4 min-w-0">
                    <Link
                      href={`/app/orders/${o.id}`}
                      className="text-sm font-semibold text-navy dark:text-white hover:text-primary dark:hover:text-blue-300 transition-colors"
                    >
                      {o.orderNumber}
                    </Link>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {o.category} · {fmtDate(o.createdAt, tr)}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="md:col-span-2 order-last md:order-none">
                    <span className="md:hidden text-[11px] font-medium text-slate-400 mr-2">
                      {L.colStatus}:
                    </span>
                    <OrderStatusBadge status={o.status} />
                  </div>

                  {/* Cost */}
                  <div className="md:col-span-2 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">
                    <span className="md:hidden text-[11px] font-medium text-slate-400 mr-1">
                      {L.colCost}:
                    </span>
                    {money(o.cost)}
                  </div>

                  {/* Sale */}
                  <div className="md:col-span-2 text-right text-sm tabular-nums text-navy dark:text-white">
                    <span className="md:hidden text-[11px] font-medium text-slate-400 mr-1">
                      {L.colSale}:
                    </span>
                    {money(o.sale)}
                  </div>

                  {/* Profit + margin */}
                  <div className="md:col-span-2 text-right">
                    <div
                      className={`font-semibold text-sm tabular-nums ${
                        up
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {up ? '+' : '−'}
                      {money(Math.abs(o.profit))}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
                      {pct(o.margin, tr)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination footer */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {L.rangeLabel(
                (safePage - 1) * PAGE_SIZE + 1,
                Math.min(safePage * PAGE_SIZE, filtered.length),
                filtered.length,
              )}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg dark:border-slate-700 dark:text-slate-200"
                aria-label={L.prev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium text-navy dark:text-slate-200 px-2 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg dark:border-slate-700 dark:text-slate-200"
                aria-label={L.next}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <PiggyBank className="h-7 w-7 text-slate-400" />
      </div>
      <p className="font-semibold text-navy dark:text-white">{title}</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
        {description}
      </p>
    </div>
  );
}

function ErrorBlock({
  message,
  retry,
  retryLabel,
}: {
  message: string;
  retry: () => void;
  retryLabel: string;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </div>
      <p className="font-semibold text-navy dark:text-white">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={retry}
        className="mt-4 rounded-xl dark:border-slate-700 dark:text-slate-200"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {retryLabel}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const money = (n: number) => `$${Number(n).toFixed(2)}`;

const pct = (n: number, tr: boolean) => {
  const v = Number(n).toFixed(1);
  return tr ? `%${v}` : `${v}%`;
};

const fmtDate = (d: string, tr: boolean) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(tr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/* Inline i18n (next-intl useLocale) — JSON'a dokunmadan */
function labels(tr: boolean) {
  return {
    title: tr ? 'Net Kâr' : 'Net Profit',
    subtitle: tr
      ? 'Etsy satış fiyatı girilen siparişlerin kâr analizi.'
      : 'Profit analysis for orders with an entered Etsy sale price.',
    refresh: tr ? 'Yenile' : 'Refresh',

    totalCost: tr ? 'Toplam Maliyet' : 'Total Cost',
    totalCostSub: tr ? "Ortak Doku'ya ödenen" : 'Paid to Ortak Doku',
    totalSale: tr ? 'Toplam Satış' : 'Total Sale',
    totalSaleSub: tr ? 'Etsy satış geliri' : 'Etsy sale revenue',
    totalProfit: tr ? 'Net Kâr' : 'Net Profit',
    totalProfitSub: tr ? 'Satış − maliyet' : 'Sale − cost',
    avgMargin: tr ? 'Ortalama Marj' : 'Average Margin',
    countSub: (n: number) =>
      tr ? `${n} sipariş baz alındı` : `Based on ${n} order${n === 1 ? '' : 's'}`,

    breakdown: tr ? 'Sipariş Kırılımı' : 'Order Breakdown',
    searchPlaceholder: tr ? 'Sipariş, kategori ara…' : 'Search order, category…',

    colOrder: tr ? 'Sipariş' : 'Order',
    colStatus: tr ? 'Durum' : 'Status',
    colCost: tr ? 'Maliyet' : 'Cost',
    colSale: tr ? 'Satış' : 'Sale',
    colProfit: tr ? 'Kâr / Marj' : 'Profit / Margin',

    emptyTitle: tr ? 'Henüz kâr verisi yok' : 'No profit data yet',
    emptyDesc: tr
      ? 'Henüz Etsy satış fiyatı girilmemiş — sipariş detayından gir.'
      : 'No Etsy sale prices entered yet — add them from order detail.',
    noMatchTitle: tr ? 'Sonuç bulunamadı' : 'No results found',
    noMatchDesc: tr
      ? 'Aramanızı değiştirmeyi veya temizlemeyi deneyin.'
      : 'Try changing or clearing your search.',

    loadError: tr ? 'Kâr raporu yüklenemedi' : 'Failed to load profit report',
    retry: tr ? 'Tekrar dene' : 'Try again',

    prev: tr ? 'Önceki' : 'Previous',
    next: tr ? 'Sonraki' : 'Next',
    rangeLabel: (from: number, to: number, total: number) =>
      tr ? `${total} siparişten ${from}–${to} arası` : `${from}–${to} of ${total}`,
  };
}
