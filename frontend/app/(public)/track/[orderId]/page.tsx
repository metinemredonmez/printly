'use client';

// Public (login'siz) markalı sipariş takip sayfası — white-label.
// Backend: GET /track/:orderId (@Public) → { orderNumber, status, placedAt, brand, timeline:[{status,at}] }
// + ileriye dönük opsiyonel alanlar: trackingNumber, carrier, estimatedDelivery.
// Proxy: /api/be/track/:orderId (token yoksa auth eklenmez → public).

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import {
  Inbox,
  Factory,
  ClipboardCheck,
  PackageCheck,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  PackageSearch,
  Copy,
  RefreshCw,
  AlertTriangle,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { Logo } from '@/components/logo';
import { LangSwitcher } from '@/components/lang-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

// ── Backend yanıt tipi ─────────────────────────────────────────────
interface TrackTimelineEvent {
  status: string;
  at: string;
}
interface TrackResponse {
  orderNumber: string;
  status: string;
  placedAt: string;
  brand: string;
  timeline: TrackTimelineEvent[];
  // ileriye dönük opsiyonel kargo alanları
  trackingNumber?: string | null;
  carrier?: string | null;
  estimatedDelivery?: string | null;
}

// Müşteriye gösterilen ana akış (CANCELLED ayrı ele alınır).
const FLOW = ['RECEIVED', 'IN_PRODUCTION', 'AWAITING_APPROVAL', 'READY', 'SHIPPED', 'DELIVERED'] as const;

const STEP_ICON: Record<string, LucideIcon> = {
  RECEIVED: Inbox,
  IN_PRODUCTION: Factory,
  AWAITING_APPROVAL: ClipboardCheck,
  READY: PackageCheck,
  SHIPPED: Truck,
  DELIVERED: CheckCircle2,
  CANCELLED: XCircle,
};

const STATUS_LABEL: Record<string, { tr: string; en: string }> = {
  RECEIVED: { tr: 'Alındı', en: 'Received' },
  IN_PRODUCTION: { tr: 'Üretimde', en: 'In Production' },
  AWAITING_APPROVAL: { tr: 'Onay Bekliyor', en: 'Awaiting Approval' },
  READY: { tr: 'Hazır', en: 'Ready' },
  SHIPPED: { tr: 'Kargoya Verildi', en: 'Shipped' },
  DELIVERED: { tr: 'Teslim Edildi', en: 'Delivered' },
  CANCELLED: { tr: 'İptal Edildi', en: 'Cancelled' },
};

const STATUS_DESC: Record<string, { tr: string; en: string }> = {
  RECEIVED: { tr: 'Siparişiniz bize ulaştı ve sıraya alındı.', en: 'Your order has reached us and is queued.' },
  IN_PRODUCTION: { tr: 'Ürününüz şu anda üretim hattında.', en: 'Your item is currently on the production line.' },
  AWAITING_APPROVAL: { tr: 'Baskı provası onay aşamasında.', en: 'The print proof is awaiting approval.' },
  READY: { tr: 'Üretim tamamlandı, sevkiyat hazırlanıyor.', en: 'Production is complete, preparing for dispatch.' },
  SHIPPED: { tr: 'Siparişiniz kargoya teslim edildi, yolda.', en: 'Your order has been handed to the carrier and is on its way.' },
  DELIVERED: { tr: 'Siparişiniz teslim edildi. İyi günlerde kullanın!', en: 'Your order has been delivered. Enjoy!' },
  CANCELLED: { tr: 'Bu sipariş iptal edilmiştir.', en: 'This order has been cancelled.' },
};

// Rozet renk paleti (order-status-badge ile aynı dil, dark varyantlı).
const BADGE_CLS: Record<string, string> = {
  RECEIVED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  IN_PRODUCTION: 'bg-blue-50 text-primary dark:bg-blue-500/15 dark:text-blue-300',
  AWAITING_APPROVAL: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  READY: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  SHIPPED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  CANCELLED: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

function fmtDate(d: string | null | undefined, locale: string) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function fmtDateOnly(d: string | null | undefined, locale: string) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ── Markalı sade layout kabuğu (shell/sidebar İÇİNDE DEĞİL) ────────
function BrandShell({ tr, children }: { tr: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-950 flex flex-col">
      {/* Üst markalı header */}
      <header className="h-16 shrink-0 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center" aria-label="Ortak Doku">
            <Logo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <LangSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</main>

      <footer className="shrink-0 border-t border-slate-100 dark:border-slate-800 py-6">
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600">
          {tr
            ? '© 2026 Ortak Doku — Markalı sipariş takip'
            : '© 2026 Ortak Doku — Branded order tracking'}
        </p>
      </footer>
    </div>
  );
}

// ── İskeletler ────────────────────────────────────────────────────
function TrackSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-7 space-y-4">
        <div className="h-3 w-28 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-7 w-48 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-10 w-40 rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-7 space-y-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-2.5 w-24 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hata / bulunamadı kartı (nazik) ───────────────────────────────
function NotFoundCard({
  tr,
  orderId,
  notFound,
  onRetry,
  retrying,
}: {
  tr: boolean;
  orderId: string;
  notFound: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 text-center shadow-sm">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-5">
        {notFound ? (
          <PackageSearch className="h-8 w-8 text-slate-400 dark:text-slate-500" />
        ) : (
          <AlertTriangle className="h-8 w-8 text-amber-500" />
        )}
      </div>
      <h1 className="text-xl font-semibold text-navy dark:text-white">
        {notFound
          ? tr
            ? 'Sipariş bulunamadı'
            : 'Order not found'
          : tr
            ? 'Bir şeyler ters gitti'
            : 'Something went wrong'}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        {notFound
          ? tr
            ? 'Bu takip bağlantısına ait bir sipariş bulamadık. Bağlantının tam olarak kopyalandığından emin olun veya size gönderilen e-postadaki güncel bağlantıyı kullanın.'
            : 'We could not find an order for this tracking link. Please make sure the link was copied in full, or use the latest link from the email sent to you.'
          : tr
            ? 'Takip bilgisine şu anda ulaşılamadı. Lütfen birkaç dakika sonra tekrar deneyin.'
            : 'We could not load the tracking info right now. Please try again in a few minutes.'}
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-mono text-slate-400 dark:text-slate-500">
        <PackageSearch className="h-3.5 w-3.5" />
        {orderId}
      </div>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button
          onClick={onRetry}
          disabled={retrying}
          className="h-11 bg-primary hover:bg-primary-hover shadow-lg shadow-blue-500/20"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${retrying ? 'animate-spin' : ''}`} />
          {tr ? 'Tekrar dene' : 'Try again'}
        </Button>
        <Link
          href="/"
          className="h-11 inline-flex items-center px-5 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {tr ? 'Ana sayfa' : 'Home'}
        </Link>
      </div>
    </div>
  );
}

// ── Ana sayfa ─────────────────────────────────────────────────────
export default function TrackPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const locale = useLocale();
  const tr = locale === 'tr';

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<TrackResponse>({
    queryKey: ['track', orderId],
    queryFn: () => api<TrackResponse>(`/track/${orderId}`),
    retry: (count, err) => (err instanceof ApiError && err.status === 404 ? false : count < 1),
    staleTime: 60_000,
  });

  const label = (s: string) => STATUS_LABEL[s]?.[tr ? 'tr' : 'en'] ?? s;
  const desc = (s: string) => STATUS_DESC[s]?.[tr ? 'tr' : 'en'] ?? '';

  function copyOrderNo(no: string) {
    navigator.clipboard
      ?.writeText(no)
      .then(() => toast.success(tr ? 'Sipariş no kopyalandı' : 'Order number copied'))
      .catch(() => toast.error(tr ? 'Kopyalanamadı' : 'Could not copy'));
  }

  // Yükleme
  if (isLoading) {
    return (
      <BrandShell tr={tr}>
        <TrackSkeleton />
      </BrandShell>
    );
  }

  // Hata / bulunamadı
  if (isError || !data) {
    const is404 = error instanceof ApiError && error.status === 404;
    return (
      <BrandShell tr={tr}>
        <NotFoundCard
          tr={tr}
          orderId={orderId}
          notFound={is404}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      </BrandShell>
    );
  }

  // ── Başarılı veri ────────────────────────────────────────────────
  const cancelled = data.status === 'CANCELLED';

  // timeline'dan her status için ilk gerçekleşme zamanı
  const reachedAt = new Map<string, string>();
  for (const ev of data.timeline ?? []) {
    if (!reachedAt.has(ev.status)) reachedAt.set(ev.status, ev.at);
  }
  // RECEIVED genelde event olmayabilir → placedAt'i baz al
  if (!reachedAt.has('RECEIVED')) reachedAt.set('RECEIVED', data.placedAt);

  const currentIdx = FLOW.indexOf(data.status as (typeof FLOW)[number]);
  const StatusIcon = STEP_ICON[data.status] ?? Clock;
  const hasShipping = Boolean(data.trackingNumber) || Boolean(data.carrier);
  // tahmini teslim: backend göndermezse READY/SHIPPED için kibar bir ipucu
  const eta = data.estimatedDelivery;

  return (
    <BrandShell tr={tr}>
      <div className="space-y-6">
        {/* Başlık + büyük durum rozeti */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-7 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {tr ? `${data.brand} · Sipariş Takibi` : `${data.brand} · Order Tracking`}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <h1 className="text-2xl sm:text-[26px] font-semibold text-navy dark:text-white truncate">
                  {data.orderNumber}
                </h1>
                <button
                  type="button"
                  onClick={() => copyOrderNo(data.orderNumber)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                  aria-label={tr ? 'Sipariş no kopyala' : 'Copy order number'}
                  title={tr ? 'Kopyala' : 'Copy'}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {tr ? 'Sipariş tarihi' : 'Order date'}: {fmtDate(data.placedAt, locale)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              className="self-start h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label={tr ? 'Yenile' : 'Refresh'}
              title={tr ? 'Yenile' : 'Refresh'}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Büyük durum rozeti */}
          <div
            className={`mt-6 flex items-center gap-4 rounded-2xl p-4 sm:p-5 ${
              cancelled
                ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20'
                : 'bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20'
            }`}
          >
            <div
              className={`h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center ${
                cancelled
                  ? 'bg-rose-500 text-white'
                  : data.status === 'DELIVERED'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-primary text-white'
              }`}
            >
              <StatusIcon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                    BADGE_CLS[data.status] ?? BADGE_CLS.RECEIVED
                  }`}
                >
                  {label(data.status)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{desc(data.status)}</p>
            </div>
          </div>

          {/* Tahmini teslim + kargo no kısa bilgisi */}
          {(eta || hasShipping) && !cancelled && (
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {eta && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                  <CalendarClock className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold">
                      {tr ? 'Tahmini teslim' : 'Estimated delivery'}
                    </p>
                    <p className="text-sm font-semibold text-navy dark:text-white truncate">
                      {fmtDateOnly(eta, locale)}
                    </p>
                  </div>
                </div>
              )}
              {hasShipping && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                  <Truck className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold">
                      {data.carrier
                        ? `${tr ? 'Kargo' : 'Carrier'} · ${data.carrier}`
                        : tr
                          ? 'Kargo takip no'
                          : 'Tracking number'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-navy dark:text-white font-mono truncate">
                        {data.trackingNumber ?? '—'}
                      </p>
                      {data.trackingNumber && (
                        <button
                          type="button"
                          onClick={() => copyOrderNo(data.trackingNumber!)}
                          className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-primary shrink-0"
                          aria-label={tr ? 'Kargo no kopyala' : 'Copy tracking number'}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Durum zaman çizelgesi */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-7 sm:p-8 shadow-sm">
          <h2 className="font-semibold text-navy dark:text-white mb-6">
            {tr ? 'Durum geçmişi' : 'Status timeline'}
          </h2>

          {cancelled ? (
            // İptal: akış yerine net iptal mesajı + (varsa) iptale kadarki adımlar
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-full bg-rose-500 text-white flex items-center justify-center">
                  <XCircle className="h-5 w-5" />
                </div>
                <div className="pt-1">
                  <p className="font-semibold text-navy dark:text-white">{label('CANCELLED')}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{desc('CANCELLED')}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {fmtDate(reachedAt.get('CANCELLED') ?? data.placedAt, locale)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ol className="relative">
              {FLOW.map((step, idx) => {
                const StepIcon = STEP_ICON[step] ?? Clock;
                const done = currentIdx >= 0 && idx < currentIdx;
                const active = idx === currentIdx;
                const reached = reachedAt.get(step);
                const isLast = idx === FLOW.length - 1;

                const dotCls = done
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : active
                    ? 'bg-primary text-white border-primary ring-4 ring-blue-100 dark:ring-blue-500/20'
                    : 'bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700';

                const lineCls = done
                  ? 'bg-emerald-400 dark:bg-emerald-500'
                  : 'bg-slate-200 dark:bg-slate-700';

                return (
                  <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* dikey bağlantı çizgisi */}
                    {!isLast && (
                      <span
                        className={`absolute left-5 top-10 -ml-px h-[calc(100%-1.5rem)] w-0.5 ${lineCls}`}
                        aria-hidden
                      />
                    )}
                    <div
                      className={`relative z-10 h-10 w-10 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${dotCls}`}
                    >
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <div className="pt-1.5 min-w-0">
                      <p
                        className={`font-semibold leading-none ${
                          active
                            ? 'text-primary'
                            : done
                              ? 'text-navy dark:text-white'
                              : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {label(step)}
                        {active && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary align-middle">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            {tr ? 'Şu an' : 'Now'}
                          </span>
                        )}
                      </p>
                      {(done || active) && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{desc(step)}</p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {reached ? fmtDate(reached, locale) : tr ? 'Bekleniyor' : 'Pending'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Yardım notu */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 px-6">
          {tr
            ? 'Bu sayfa siparişinizin güncel durumunu gösterir. Sorularınız için satıcınızla iletişime geçebilirsiniz.'
            : 'This page shows the current status of your order. For questions, please contact your seller.'}
        </p>
      </div>
    </BrandShell>
  );
}
