'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Search,
  Package,
  ShoppingBag,
  LifeBuoy,
  AlertTriangle,
  SearchX,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface SearchOrder {
  id: string;
  orderNumber: string;
  status: string;
  clientName?: string | null;
  total?: number | string | null;
}
interface SearchProduct {
  id: string;
  name: string;
  category: string;
}
interface SearchTicket {
  id: string;
  subject: string;
  status: string;
}
interface SearchUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}
interface SearchResponse {
  q: string;
  results: {
    orders: SearchOrder[];
    products: SearchProduct[];
    tickets: SearchTicket[];
    users: SearchUser[];
  };
}

/* ------------------------------------------------------------------ */
/* Page (Suspense wrapper — Next 16 useSearchParams gerekliliği)       */
/* ------------------------------------------------------------------ */

export default function DealerSearchPage() {
  const tr = useLocale() === 'tr';
  return (
    <Suspense fallback={<SearchSkeleton tr={tr} />}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const tr = useLocale() === 'tr';
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim();

  const [term, setTerm] = useState(q);
  useEffect(() => setTerm(q), [q]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api<SearchResponse>('/search?q=' + encodeURIComponent(q)),
    enabled: q.length > 0,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = term.trim();
    router.replace(next ? `?q=${encodeURIComponent(next)}` : '?');
  };

  const results = data?.results;
  const orders = results?.orders ?? [];
  const products = results?.products ?? [];
  const tickets = results?.tickets ?? [];
  const totalCount = orders.length + products.length + tickets.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-navy dark:text-white">
          {tr ? 'Arama' : 'Search'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {tr
            ? 'Siparişler, ürünler ve destek talepleri arasında ara.'
            : 'Search across orders, products and support tickets.'}
        </p>
      </div>

      {/* Search bar */}
      <form
        onSubmit={submit}
        className="bg-white rounded-3xl border border-slate-100 p-4 dark:bg-slate-900 dark:border-slate-800 flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={tr ? 'Aramak için yazın…' : 'Type to search…'}
            autoFocus
            className="h-9 pl-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
          />
        </div>
        <Button type="submit" size="lg" className="h-9 rounded-xl">
          <Search className="h-4 w-4" />
          {tr ? 'Ara' : 'Search'}
        </Button>
      </form>

      {/* States */}
      {q.length === 0 ? (
        <PromptBlock tr={tr} />
      ) : isLoading ? (
        <ResultsSkeleton />
      ) : isError ? (
        <ErrorBlock
          message={
            error instanceof Error
              ? error.message
              : tr
                ? 'Arama yapılamadı'
                : 'Search failed'
          }
        />
      ) : totalCount === 0 ? (
        <NoResultBlock tr={tr} q={q} />
      ) : (
        <div className="space-y-5">
          {orders.length > 0 && (
            <ResultGroup
              title={tr ? 'Siparişler' : 'Orders'}
              count={orders.length}
              icon={ShoppingBag}
            >
              {orders.map((o) => (
                <ResultRow
                  key={o.id}
                  href={`/app/orders/${o.id}`}
                  title={`#${o.orderNumber}`}
                  meta={[
                    o.clientName ?? undefined,
                    statusLabel(o.status, tr),
                    o.total != null ? money(o.total) : undefined,
                  ]}
                />
              ))}
            </ResultGroup>
          )}

          {products.length > 0 && (
            <ResultGroup
              title={tr ? 'Ürünler' : 'Products'}
              count={products.length}
              icon={Package}
            >
              {products.map((p) => (
                <ResultRow
                  key={p.id}
                  title={p.name}
                  meta={[p.category]}
                />
              ))}
            </ResultGroup>
          )}

          {tickets.length > 0 && (
            <ResultGroup
              title={tr ? 'Destek Talepleri' : 'Support Tickets'}
              count={tickets.length}
              icon={LifeBuoy}
            >
              {tickets.map((t) => (
                <ResultRow
                  key={t.id}
                  href={`/app/tickets/${t.id}`}
                  title={t.subject}
                  meta={[statusLabel(t.status, tr)]}
                />
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function ResultGroup({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  count: number;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-navy dark:text-white">{title}</h2>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
    </div>
  );
}

function ResultRow({
  href,
  title,
  meta,
}: {
  href?: string;
  title: string;
  meta?: (string | undefined)[];
}) {
  const parts = (meta ?? []).filter(Boolean) as string[];
  const inner = (
    <>
      <div className="min-w-0">
        <div className="text-sm font-medium text-navy dark:text-white truncate">{title}</div>
        {parts.length > 0 && (
          <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {parts.join(' · ')}
          </div>
        )}
      </div>
      {href && <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">{inner}</div>
  );
}

function PromptBlock({ tr }: { tr: boolean }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 px-5 py-16 text-center dark:bg-slate-900 dark:border-slate-800">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Search className="h-7 w-7 text-slate-400" />
      </div>
      <p className="font-semibold text-navy dark:text-white">
        {tr ? 'Ne arıyorsunuz?' : 'What are you looking for?'}
      </p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
        {tr
          ? 'Sipariş, ürün veya talep bulmak için yukarıya bir terim yazın.'
          : 'Type a term above to find an order, product or ticket.'}
      </p>
    </div>
  );
}

function NoResultBlock({ tr, q }: { tr: boolean; q: string }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 px-5 py-16 text-center dark:bg-slate-900 dark:border-slate-800">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <SearchX className="h-7 w-7 text-slate-400" />
      </div>
      <p className="font-semibold text-navy dark:text-white">
        {tr ? `'${q}' için sonuç yok` : `No results for '${q}'`}
      </p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
        {tr
          ? 'Farklı bir terim deneyin veya yazımı kontrol edin.'
          : 'Try a different term or check your spelling.'}
      </p>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 px-5 py-16 text-center dark:bg-slate-900 dark:border-slate-800">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </div>
      <p className="font-semibold text-navy dark:text-white">{message}</p>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-3xl border border-slate-100 overflow-hidden dark:bg-slate-900 dark:border-slate-800"
        >
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="px-5 py-3.5 space-y-2">
                <div className="h-3.5 w-1/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchSkeleton({ tr }: { tr: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy dark:text-white">
          {tr ? 'Arama' : 'Search'}
        </h1>
      </div>
      <div className="bg-white rounded-3xl border border-slate-100 p-4 dark:bg-slate-900 dark:border-slate-800">
        <div className="h-9 w-full rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
      <ResultsSkeleton />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const money = (n: number | string) => `$${Number(n).toFixed(2)}`;

function statusLabel(s: string, tr: boolean) {
  const map: Record<string, [string, string]> = {
    PENDING: ['Beklemede', 'Pending'],
    PROCESSING: ['İşleniyor', 'Processing'],
    IN_PRODUCTION: ['Üretimde', 'In Production'],
    SHIPPED: ['Kargoda', 'Shipped'],
    DELIVERED: ['Teslim Edildi', 'Delivered'],
    COMPLETED: ['Tamamlandı', 'Completed'],
    CANCELLED: ['İptal Edildi', 'Cancelled'],
    OPEN: ['Açık', 'Open'],
    ANSWERED: ['Yanıtlandı', 'Answered'],
    CLOSED: ['Kapalı', 'Closed'],
  };
  const hit = map[s];
  return hit ? (tr ? hit[0] : hit[1]) : s;
}
