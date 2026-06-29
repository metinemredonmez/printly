'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Check, Archive, ArchiveRestore, FileText, Printer, Package, Truck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { OrderProofs } from '@/components/orders/order-proofs';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/skeletons';
import { ORDER_STATUSES, type Order } from '@/lib/orders';

export function OrderDetail({
  id,
  basePath,
  staff = false,
}: {
  id: string;
  basePath: string;
  staff?: boolean;
}) {
  const t = useTranslations('orders');
  const tos = useTranslations('orderStatus');
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();

  const { data: o, isLoading } = useQuery({
    queryKey: ['orders', id],
    queryFn: () => api<Order>(`/orders/${id}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const approve = useMutation({
    mutationFn: () => api(`/orders/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('approved'));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Hata'),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) =>
      api(`/orders/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success(t('statusChanged'));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Hata'),
  });

  const archive = useMutation({
    mutationFn: (on: boolean) =>
      api(`/orders/${id}/${on ? 'archive' : 'unarchive'}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('statusChanged'));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Hata'),
  });

  if (isLoading)
    return (
      <div className="space-y-5 max-w-4xl">
        <ListSkeleton rows={4} />
      </div>
    );
  if (!o) return <div className="text-slate-400 dark:text-slate-500 text-sm">{t('notFound')}</div>;

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy dark:text-white">{o.orderNumber}</h1>
          <div className="text-sm text-slate-400 dark:text-slate-500">
            {o.category} · {shortDate(o.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OrderStatusBadge status={o.status} />
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/be/invoices/order/${id}`, '_blank')}>
            <FileText className="h-3.5 w-3.5 mr-1.5" /> {t('invoicePdf')}
          </Button>
          {staff && (
            <>
              <Button size="sm" variant="outline" onClick={() => window.open(`/api/be/labels/order/${id}`, '_blank')}>
                <Printer className="h-3.5 w-3.5 mr-1.5" /> {t('labelPdf')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(`/api/be/orders/${id}/packing-slip`, '_blank')}>
                <Package className="h-3.5 w-3.5 mr-1.5" /> {t('packingSlip')}
              </Button>
            </>
          )}
        </div>
      </div>

      {staff && (
        <div className="flex items-center gap-2 flex-wrap bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-3">
          {!o.approvedAt && (
            <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
              <Check className="h-4 w-4 mr-1" /> {t('approve')}
            </Button>
          )}
          <select
            className="h-9 rounded-md border border-slate-200 dark:border-slate-700 text-sm px-2 bg-white dark:bg-slate-950 dark:text-white"
            value=""
            onChange={(e) => e.target.value && setStatus.mutate(e.target.value)}
          >
            <option value="">{t('changeStatus')}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tos(s)}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => archive.mutate(!o.archivedAt)}
            disabled={archive.isPending}
          >
            {o.archivedAt ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-1" /> {t('unarchive')}
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-1" /> {t('archive')}
              </>
            )}
          </Button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
            <h2 className="font-semibold text-navy dark:text-white mb-3">{t('items')}</h2>
            <div className="space-y-2">
              {(o.items ?? []).map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm border-b border-slate-50 dark:border-slate-800/40 pb-2">
                  <div>
                    <div className="font-medium text-navy dark:text-white">{it.product?.name ?? '—'}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      {it.widthInch}×{it.heightInch} inç · {t('qty')} {it.quantity}
                    </div>
                  </div>
                  <div className="font-semibold text-navy dark:text-white">{money(it.lineTotal)}</div>
                </div>
              ))}
              {(o.extras ?? []).map((ex) => (
                <div key={ex.id} className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                  <span>+ {ex.name} ×{ex.quantity}</span>
                  <span>{money(ex.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <OrderProofs orderId={id} staff={staff} />

          {o.clientName && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
              <h2 className="font-semibold text-navy dark:text-white mb-3">{t('delivery')}</h2>
              <div className="text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
                <div className="font-medium text-navy dark:text-white">{o.clientName}</div>
                {o.clientAddress && <div>{o.clientAddress}</div>}
                <div>
                  {[o.clientCity, o.clientZip, o.clientCountry].filter(Boolean).join(', ')}
                </div>
                {o.clientPhone && <div>{o.clientPhone}</div>}
              </div>
            </div>
          )}

          <ShipmentCard order={o} staff={staff} id={id} />

          <EtsySalePriceCard order={o} id={id} />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 h-fit">
          <h2 className="font-semibold text-navy dark:text-white mb-3">{t('summary')}</h2>
          <div className="space-y-2 text-sm">
            <Row label={t('subtotal')} value={money(o.subtotal)} />
            <Row label={t('extrasTotal')} value={money(o.extrasTotal)} />
            {o.discount40 > 0 && (
              <Row label={t('discount')} value={`- ${money(o.discount40)}`} accent />
            )}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between font-semibold text-navy dark:text-white">
              <span>{t('grandTotal')}</span>
              <span>{money(o.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={accent ? 'text-emerald-600 dark:text-emerald-300 font-medium' : 'text-navy dark:text-white font-medium'}>
        {value}
      </span>
    </div>
  );
}

const CARRIERS = ['', 'UPS', 'FedEx', 'USPS', 'DHL'] as const;

function fmtDate(d: string | null | undefined, tr: boolean) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(tr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ISO → 'YYYY-MM-DD' (date input pre-fill)
function isoToDateInput(d: string | null | undefined) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function ShipmentCard({
  order,
  staff,
  id,
}: {
  order: Order;
  staff: boolean;
  id: string;
}) {
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();

  const [carrier, setCarrier] = useState(order.carrier ?? '');
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? '');
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState(
    isoToDateInput(order.estimatedDeliveryAt),
  );
  const [shippingCost, setShippingCost] = useState(
    order.shippingCost != null ? String(order.shippingCost) : '',
  );

  const shipment = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api(`/orders/${id}/shipment`, { method: 'PATCH', json: payload }),
    onSuccess: () => {
      toast.success(tr ? 'Kargo bilgileri kaydedildi' : 'Shipping info saved');
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : tr ? 'Hata' : 'Error'),
  });

  const baseFields = () => ({
    carrier,
    trackingNumber,
    estimatedDeliveryAt: estimatedDeliveryAt
      ? new Date(estimatedDeliveryAt).toISOString()
      : '',
    shippingCost: shippingCost === '' ? undefined : Number(shippingCost),
  });

  const title = tr ? 'Kargo Bilgileri' : 'Shipping';
  const inputCls =
    'h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 text-sm px-2 bg-white dark:bg-slate-950 dark:text-white';
  const labelCls = 'block text-[11px] mb-1 text-slate-500 dark:text-slate-400';

  // ── STAFF: düzenlenebilir form ──────────────────────────────
  if (staff) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
        <h2 className="font-semibold text-navy dark:text-white mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4 text-slate-400 dark:text-slate-500" /> {title}
        </h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{tr ? 'Kargo Firması' : 'Carrier'}</label>
            <select
              className={inputCls}
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            >
              {CARRIERS.map((c) => (
                <option key={c || 'none'} value={c}>
                  {c || '—'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{tr ? 'Takip No' : 'Tracking number'}</label>
            <input
              className={inputCls}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder={tr ? 'Takip numarası' : 'Tracking number'}
            />
          </div>
          <div>
            <label className={labelCls}>
              {tr ? 'Tahmini Teslim' : 'Estimated delivery'}
            </label>
            <input
              type="date"
              className={inputCls}
              value={estimatedDeliveryAt}
              onChange={(e) => setEstimatedDeliveryAt(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>
              {tr ? 'Kargo Ücreti (USD)' : 'Shipping cost (USD)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {(order.shippedAt || order.deliveredAt) && (
          <div className="mt-3 text-[12px] text-slate-500 dark:text-slate-400 space-y-0.5">
            {order.shippedAt && (
              <div>
                {tr ? 'Kargolandı' : 'Shipped'}: {fmtDate(order.shippedAt, tr)}
              </div>
            )}
            {order.deliveredAt && (
              <div>
                {tr ? 'Teslim' : 'Delivered'}: {fmtDate(order.deliveredAt, tr)}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-xl"
            onClick={() => shipment.mutate(baseFields())}
            disabled={shipment.isPending}
          >
            {tr ? 'Kaydet' : 'Save'}
          </Button>
          {order.status === 'READY' && (
            <Button
              size="sm"
              className="h-9 rounded-xl"
              onClick={() =>
                shipment.mutate({ markShipped: true, carrier, trackingNumber })
              }
              disabled={shipment.isPending}
            >
              <Truck className="h-4 w-4 mr-1.5" /> {tr ? 'Kargoya Ver' : 'Mark Shipped'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── BAYİ: salt-okunur ───────────────────────────────────────
  const hasInfo =
    order.carrier ||
    order.trackingNumber ||
    order.shippedAt ||
    order.estimatedDeliveryAt ||
    order.deliveredAt;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
      <h2 className="font-semibold text-navy dark:text-white mb-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-slate-400 dark:text-slate-500" /> {title}
      </h2>

      {!hasInfo ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {tr ? 'Henüz kargo bilgisi yok' : 'No shipping info yet'}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <Row label={tr ? 'Kargo Firması' : 'Carrier'} value={order.carrier || '—'} />
          {order.trackingNumber && (
            <Row label={tr ? 'Takip No' : 'Tracking number'} value={order.trackingNumber} />
          )}
          <Row
            label={tr ? 'Kargolandı' : 'Shipped'}
            value={fmtDate(order.shippedAt, tr)}
          />
          <Row
            label={tr ? 'Tahmini Teslim' : 'Estimated delivery'}
            value={fmtDate(order.estimatedDeliveryAt, tr)}
          />
          <Row label={tr ? 'Teslim' : 'Delivered'} value={fmtDate(order.deliveredAt, tr)} />
          <div className="pt-1">
            <Link
              href={`/track/${order.orderNumber}`}
              className="text-[13px] text-primary hover:underline"
            >
              {tr ? 'Takip sayfasını aç' : 'Open tracking page'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Para: $${Number(n).toFixed(2)}
const usd = (n: number) => `$${Number(n).toFixed(2)}`;

function EtsySalePriceCard({ order, id }: { order: Order; id: string }) {
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();

  const [salePrice, setSalePrice] = useState(
    order.etsySalePrice != null && order.etsySalePrice > 0 ? String(order.etsySalePrice) : '',
  );

  const save = useMutation({
    mutationFn: (value: number) =>
      api(`/orders/${id}/sale-price`, { method: 'PATCH', json: { etsySalePrice: value } }),
    onSuccess: () => {
      toast.success(tr ? 'Etsy satış fiyatı kaydedildi' : 'Etsy sale price saved');
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : tr ? 'Hata' : 'Error'),
  });

  const inputCls =
    'h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 text-sm px-2 bg-white dark:bg-slate-950 dark:text-white';
  const labelCls = 'block text-[11px] mb-1 text-slate-500 dark:text-slate-400';

  const cost = order.total;
  const sale = order.etsySalePrice ?? 0;
  const hasSale = sale > 0;
  const profit = sale - cost;
  const positive = profit >= 0;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
      <h2 className="font-semibold text-navy dark:text-white mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-slate-400 dark:text-slate-500" />{' '}
        {tr ? 'Etsy Satış Fiyatı' : 'Etsy Sale Price'}
      </h2>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className={labelCls}>
            {tr ? 'Etsy Satış Fiyatı (USD)' : 'Etsy Sale Price (USD)'}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputCls}
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 rounded-xl"
          onClick={() => save.mutate(salePrice === '' ? 0 : Number(salePrice))}
          disabled={save.isPending}
        >
          {tr ? 'Kaydet' : 'Save'}
        </Button>
      </div>

      {hasSale && (
        <div className="mt-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {tr ? 'Net Kâr' : 'Net Profit'}
            </span>
            <span
              className={`text-base font-semibold ${
                positive
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-rose-600 dark:text-rose-300'
              }`}
            >
              {positive ? '' : '- '}
              {usd(Math.abs(profit))}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[12px] text-slate-400 dark:text-slate-500">
              {tr ? 'Marj' : 'Margin'}
            </span>
            <span
              className={`text-[12px] font-medium ${
                positive
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-rose-600 dark:text-rose-300'
              }`}
            >
              %{margin.toFixed(1)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            {tr ? 'Maliyet (ödediğin)' : 'Cost (you paid)'}: {usd(cost)}
          </div>
        </div>
      )}
    </div>
  );
}
