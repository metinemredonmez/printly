'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, Archive, ArchiveRestore, FileText, Printer, Package } from 'lucide-react';
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
  if (!o) return <div className="text-slate-400 text-sm">{t('notFound')}</div>;

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{o.orderNumber}</h1>
          <div className="text-sm text-slate-400">
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
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-2xl border border-slate-100 p-3">
          {!o.approvedAt && (
            <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
              <Check className="h-4 w-4 mr-1" /> {t('approve')}
            </Button>
          )}
          <select
            className="h-9 rounded-md border border-slate-200 text-sm px-2 bg-white"
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
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h2 className="font-semibold text-navy mb-3">{t('items')}</h2>
            <div className="space-y-2">
              {(o.items ?? []).map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
                  <div>
                    <div className="font-medium text-navy">{it.product?.name ?? '—'}</div>
                    <div className="text-[11px] text-slate-400">
                      {it.widthInch}×{it.heightInch} inç · {t('qty')} {it.quantity}
                    </div>
                  </div>
                  <div className="font-semibold text-navy">{money(it.lineTotal)}</div>
                </div>
              ))}
              {(o.extras ?? []).map((ex) => (
                <div key={ex.id} className="flex items-center justify-between text-sm text-slate-500">
                  <span>+ {ex.name} ×{ex.quantity}</span>
                  <span>{money(ex.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <OrderProofs orderId={id} staff={staff} />

          {o.clientName && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h2 className="font-semibold text-navy mb-3">{t('delivery')}</h2>
              <div className="text-sm text-slate-600 space-y-0.5">
                <div className="font-medium text-navy">{o.clientName}</div>
                {o.clientAddress && <div>{o.clientAddress}</div>}
                <div>
                  {[o.clientCity, o.clientZip, o.clientCountry].filter(Boolean).join(', ')}
                </div>
                {o.clientPhone && <div>{o.clientPhone}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 h-fit">
          <h2 className="font-semibold text-navy mb-3">{t('summary')}</h2>
          <div className="space-y-2 text-sm">
            <Row label={t('subtotal')} value={money(o.subtotal)} />
            <Row label={t('extrasTotal')} value={money(o.extrasTotal)} />
            {o.discount40 > 0 && (
              <Row label={t('discount')} value={`- ${money(o.discount40)}`} accent />
            )}
            <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold text-navy">
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
      <span className="text-slate-500">{label}</span>
      <span className={accent ? 'text-emerald-600 font-medium' : 'text-navy font-medium'}>
        {value}
      </span>
    </div>
  );
}
