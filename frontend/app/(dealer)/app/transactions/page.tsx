'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Crown,
  Undo2,
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Filter,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/stat-card';
import { TableSkeleton } from '@/components/skeletons';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TxType = 'BALANCE_LOAD' | 'ORDER_PAYMENT' | 'MEMBERSHIP_FEE' | 'REFUND';
type TxStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

interface Transaction {
  id: string;
  type: TxType;
  amount: number | string; // Decimal → JSON string
  status: TxStatus;
  method?: string | null;
  orderId?: string | null;
  note?: string | null;
  createdAt: string;
}

const PAGE_SIZE = 12;

/* Tutarın bakiyeye etkisi: yükleme/iade artı, ödeme/aidat eksi. */
const CREDIT_TYPES: TxType[] = ['BALANCE_LOAD', 'REFUND'];
const isCredit = (t: TxType) => CREDIT_TYPES.includes(t);

/* ------------------------------------------------------------------ */
/* Visual maps                                                         */
/* ------------------------------------------------------------------ */

const TYPE_META: Record<
  TxType,
  { icon: LucideIcon; chip: string; iconWrap: string }
> = {
  BALANCE_LOAD: {
    icon: ArrowDownToLine,
    chip:
      'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    iconWrap:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  REFUND: {
    icon: Undo2,
    chip:
      'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
    iconWrap: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  },
  ORDER_PAYMENT: {
    icon: ArrowUpFromLine,
    chip:
      'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
    iconWrap: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
  },
  MEMBERSHIP_FEE: {
    icon: Crown,
    chip:
      'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    iconWrap: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
};

const STATUS_META: Record<TxStatus, string> = {
  SUCCESS:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  PENDING:
    'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  FAILED: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TransactionsPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);

  const [typeFilter, setTypeFilter] = useState<'ALL' | TxType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TxStatus>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['transactions', 'me'],
    queryFn: () => api<Transaction[]>('/transactions/me'),
  });

  const rows = data ?? [];

  /* --- Summary (sadece SUCCESS hareketler hesaba katılır) --- */
  const summary = useMemo(() => {
    let loaded = 0;
    let spent = 0;
    let refunded = 0;
    let pending = 0;
    for (const r of rows) {
      const amt = Math.abs(Number(r.amount) || 0);
      if (r.status === 'PENDING') pending += 1;
      if (r.status !== 'SUCCESS') continue;
      if (r.type === 'BALANCE_LOAD') loaded += amt;
      else if (r.type === 'REFUND') refunded += amt;
      else spent += amt; // ORDER_PAYMENT + MEMBERSHIP_FEE
    }
    return { loaded, spent, refunded, pending, net: loaded + refunded - spent };
  }, [rows]);

  /* --- Filtered + searched --- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${L.typeName(r.type)} ${r.note ?? ''} ${r.orderId ?? ''} ${r.method ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, statusFilter, search, L]);

  /* --- Pagination --- */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetFilters = () => {
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilter = typeFilter !== 'ALL' || statusFilter !== 'ALL' || search.trim() !== '';

  // Filtre değişince ilk sayfaya dön
  const onFilterChange = (fn: () => void) => {
    fn();
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
          onClick={() => {
            refetch();
            toast.success(L.refreshed);
          }}
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
              className="rounded-3xl border border-slate-100 bg-white p-5 h-[104px] animate-pulse dark:bg-slate-900 dark:border-slate-800"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label={L.totalLoaded}
            value={money(summary.loaded)}
            icon={TrendingUp}
            accent="emerald"
            sub={L.totalLoadedSub}
          />
          <SummaryCard
            label={L.totalSpent}
            value={money(summary.spent)}
            icon={TrendingDown}
            accent="primary"
            sub={L.totalSpentSub}
          />
          <SummaryCard
            label={L.totalRefunded}
            value={money(summary.refunded)}
            icon={Undo2}
            accent="sky"
            sub={L.totalRefundedSub}
          />
          <SummaryCard
            label={L.netFlow}
            value={`${summary.net >= 0 ? '+' : '−'}${money(Math.abs(summary.net))}`}
            icon={Wallet}
            accent={summary.net >= 0 ? 'navy' : 'rose'}
            sub={summary.pending > 0 ? L.pendingCount(summary.pending) : L.netFlowSub}
          />
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-navy dark:text-white">{L.history}</h2>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 rounded-full px-2 py-0.5">
              {filtered.length}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => onFilterChange(() => setSearch(e.target.value))}
                placeholder={L.searchPlaceholder}
                className="h-9 pl-9 w-full sm:w-56 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </div>

            {/* Type filter */}
            <FilterSelect
              value={typeFilter}
              onChange={(v) => onFilterChange(() => setTypeFilter(v as 'ALL' | TxType))}
              options={[
                { value: 'ALL', label: L.allTypes },
                { value: 'BALANCE_LOAD', label: L.typeName('BALANCE_LOAD') },
                { value: 'ORDER_PAYMENT', label: L.typeName('ORDER_PAYMENT') },
                { value: 'MEMBERSHIP_FEE', label: L.typeName('MEMBERSHIP_FEE') },
                { value: 'REFUND', label: L.typeName('REFUND') },
              ]}
            />

            {/* Status filter */}
            <FilterSelect
              value={statusFilter}
              onChange={(v) => onFilterChange(() => setStatusFilter(v as 'ALL' | TxStatus))}
              options={[
                { value: 'ALL', label: L.allStatuses },
                { value: 'SUCCESS', label: L.statusName('SUCCESS') },
                { value: 'PENDING', label: L.statusName('PENDING') },
                { value: 'FAILED', label: L.statusName('FAILED') },
              ]}
            />

            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 rounded-xl text-slate-500 dark:text-slate-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {L.clear}
              </Button>
            )}
          </div>
        </div>

        {/* Column header (desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <div className="col-span-5">{L.colTransaction}</div>
          <div className="col-span-2">{L.colDate}</div>
          <div className="col-span-2">{L.colStatus}</div>
          <div className="col-span-3 text-right">{L.colAmount}</div>
        </div>

        {/* Body */}
        {isLoading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : isError ? (
          <ErrorBlock
            message={error instanceof Error ? error.message : L.loadError}
            retry={() => refetch()}
            retryLabel={L.retry}
          />
        ) : rows.length === 0 ? (
          <EmptyBlock title={L.emptyTitle} description={L.emptyDesc} />
        ) : filtered.length === 0 ? (
          <EmptyBlock title={L.noMatchTitle} description={L.noMatchDesc} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pageRows.map((row) => {
              const meta = TYPE_META[row.type] ?? TYPE_META.ORDER_PAYMENT;
              const Icon = meta.icon;
              const credit = isCredit(row.type);
              const amt = Math.abs(Number(row.amount) || 0);
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-2 px-5 py-3.5 items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Transaction (icon + type + note) */}
                  <div className="col-span-2 md:col-span-5 flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${meta.iconWrap}`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
                        >
                          {L.typeName(row.type)}
                        </span>
                      </div>
                      <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {row.note ||
                          (row.orderId ? `${L.orderRef} ${row.orderId.slice(0, 8)}` : L.noNote)}
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="md:col-span-2 text-[12px] text-slate-500 dark:text-slate-400 order-3 md:order-none">
                    <span className="md:hidden font-medium text-slate-400">{L.colDate}: </span>
                    {fmtDate(row.createdAt, tr)}
                  </div>

                  {/* Status */}
                  <div className="md:col-span-2 order-4 md:order-none">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_META[row.status] ?? STATUS_META.PENDING
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {L.statusName(row.status)}
                    </span>
                  </div>

                  {/* Amount */}
                  <div
                    className={`col-span-2 md:col-span-3 text-right font-semibold text-sm tabular-nums ${
                      row.status === 'FAILED'
                        ? 'text-slate-400 line-through dark:text-slate-500'
                        : credit
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {credit ? '+' : '−'}
                    {money(amt)}
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

const ACCENTS: Record<string, string> = {
  primary: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  navy: 'bg-slate-100 text-navy dark:bg-slate-800 dark:text-slate-200',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  sub,
  accent = 'primary',
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  sub?: string;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 hover:shadow-lg transition-shadow dark:bg-slate-900 dark:border-slate-800 dark:hover:shadow-black/20">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
          <div className="text-2xl font-semibold text-navy dark:text-white mt-1.5 tabular-nums truncate">
            {value}
          </div>
          {sub && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>
          )}
        </div>
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${ACCENTS[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Receipt className="h-7 w-7 text-slate-400" />
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

const money = (n: number) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const typeName = (t: TxType) =>
    tr
      ? {
          BALANCE_LOAD: 'Bakiye Yükleme',
          ORDER_PAYMENT: 'Sipariş Ödemesi',
          MEMBERSHIP_FEE: 'Üyelik Aidatı',
          REFUND: 'İade',
        }[t] ?? t
      : {
          BALANCE_LOAD: 'Balance Load',
          ORDER_PAYMENT: 'Order Payment',
          MEMBERSHIP_FEE: 'Membership Fee',
          REFUND: 'Refund',
        }[t] ?? t;

  const statusName = (s: TxStatus) =>
    tr
      ? { SUCCESS: 'Başarılı', PENDING: 'Beklemede', FAILED: 'Başarısız' }[s] ?? s
      : { SUCCESS: 'Success', PENDING: 'Pending', FAILED: 'Failed' }[s] ?? s;

  return {
    typeName,
    statusName,
    title: tr ? 'İşlemler' : 'Transactions',
    subtitle: tr
      ? 'Cüzdan hareketleriniz — yüklemeler, ödemeler ve aidatlar.'
      : 'Your wallet activity — loads, payments and fees.',
    refresh: tr ? 'Yenile' : 'Refresh',
    refreshed: tr ? 'İşlemler güncellendi' : 'Transactions refreshed',

    totalLoaded: tr ? 'Toplam Yükleme' : 'Total Loaded',
    totalLoadedSub: tr ? 'Başarılı yüklemeler' : 'Successful loads',
    totalSpent: tr ? 'Toplam Harcama' : 'Total Spent',
    totalSpentSub: tr ? 'Sipariş + aidat' : 'Orders + fees',
    totalRefunded: tr ? 'Toplam İade' : 'Total Refunded',
    totalRefundedSub: tr ? 'Bakiyeye dönen' : 'Returned to balance',
    netFlow: tr ? 'Net Akış' : 'Net Flow',
    netFlowSub: tr ? 'Yükleme − harcama' : 'Loaded − spent',
    pendingCount: (n: number) =>
      tr ? `${n} işlem beklemede` : `${n} pending transaction${n > 1 ? 's' : ''}`,

    history: tr ? 'Hareket Geçmişi' : 'Activity History',
    searchPlaceholder: tr ? 'Not, sipariş ara…' : 'Search note, order…',
    allTypes: tr ? 'Tüm Tipler' : 'All Types',
    allStatuses: tr ? 'Tüm Durumlar' : 'All Statuses',
    clear: tr ? 'Temizle' : 'Clear',

    colTransaction: tr ? 'İşlem' : 'Transaction',
    colDate: tr ? 'Tarih' : 'Date',
    colStatus: tr ? 'Durum' : 'Status',
    colAmount: tr ? 'Tutar' : 'Amount',
    orderRef: tr ? 'Sipariş' : 'Order',
    noNote: tr ? 'Açıklama yok' : 'No description',

    emptyTitle: tr ? 'Henüz işlem yok' : 'No transactions yet',
    emptyDesc: tr
      ? 'Bakiye yükledikçe ve sipariş verdikçe hareketleriniz burada görünecek.'
      : 'Your activity will appear here as you load balance and place orders.',
    noMatchTitle: tr ? 'Sonuç bulunamadı' : 'No results found',
    noMatchDesc: tr
      ? 'Filtreleri değiştirmeyi veya temizlemeyi deneyin.'
      : 'Try changing or clearing your filters.',

    loadError: tr ? 'İşlemler yüklenemedi' : 'Failed to load transactions',
    retry: tr ? 'Tekrar dene' : 'Try again',

    prev: tr ? 'Önceki' : 'Previous',
    next: tr ? 'Sonraki' : 'Next',
    rangeLabel: (from: number, to: number, total: number) =>
      tr ? `${total} işlemden ${from}–${to} arası` : `${from}–${to} of ${total}`,
  };
}
