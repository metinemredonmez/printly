'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Undo2,
  PackageOpen,
  RotateCcw,
  Plus,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Reason = 'DEFECT' | 'WRONG_ITEM' | 'DAMAGED' | 'NOT_AS_DESC' | 'OTHER';
type RStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECEIVED'
  | 'REFUNDED'
  | 'REPRINTED';

interface ReturnRequest {
  id: string;
  orderId: string;
  userId: string;
  reason: Reason;
  details?: string | null;
  status: RStatus;
  resolution?: string | null;
  refundAmount?: number | null;
  adminNote?: string | null;
  createdAt: string;
  order: { id: string; orderNumber: string; total: number; category: string };
  user?: { id: string; fullName: string; email: string };
}

interface Order {
  id: string;
  orderNumber: string;
  category: string;
  total: number;
  status: string;
  createdAt: string;
}

const REASONS: Reason[] = [
  'DEFECT',
  'WRONG_ITEM',
  'DAMAGED',
  'NOT_AS_DESC',
  'OTHER',
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DealerReturnsPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['returns', 'me'],
    queryFn: () => api<ReturnRequest[]>('/returns'),
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy dark:text-white">
            {L.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {L.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="h-9 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            {L.newReturn}
          </Button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-slate-100 bg-white p-5 h-40 animate-pulse dark:bg-slate-900 dark:border-slate-800"
            />
          ))}
        </div>
      ) : isError ? (
        <ErrorBlock
          message={error instanceof Error ? error.message : L.loadError}
          retry={() => refetch()}
          retryLabel={L.retry}
        />
      ) : rows.length === 0 ? (
        <EmptyBlock title={L.emptyTitle} description={L.emptyDesc} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <ReturnCard key={r.id} r={r} L={L} tr={tr} />
          ))}
        </div>
      )}

      <NewReturnDialog open={open} onOpenChange={setOpen} L={L} qc={qc} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Return card                                                         */
/* ------------------------------------------------------------------ */

function ReturnCard({
  r,
  L,
  tr,
}: {
  r: ReturnRequest;
  L: ReturnType<typeof labels>;
  tr: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-navy dark:text-white truncate">
            #{r.order.orderNumber}
          </div>
          <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            {L.categoryName(r.order.category)} · {money(r.order.total)}
          </div>
        </div>
        <span className={statusChip(r.status)}>{L.statusName(r.status)}</span>
      </div>

      {/* Reason badge */}
      <div>
        <span className={reasonChip()}>{L.reasonName(r.reason)}</span>
      </div>

      {/* Details */}
      {r.details && (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {r.details}
        </p>
      )}

      {/* Refund amount */}
      {r.refundAmount != null && r.refundAmount > 0 && (
        <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <DollarSign className="h-4 w-4" />
          {money(r.refundAmount)} {L.refunded}
        </div>
      )}

      {/* Resolution / admin note highlight */}
      {(r.resolution || r.adminNote) && (
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 px-3.5 py-3 space-y-1">
          {r.resolution && (
            <div className="text-[13px] text-slate-700 dark:text-slate-200">
              <span className="font-semibold text-navy dark:text-white">
                {L.resolution}:{' '}
              </span>
              {r.resolution}
            </div>
          )}
          {r.adminNote && (
            <div className="text-[13px] text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-navy dark:text-white">
                {L.adminNote}:{' '}
              </span>
              {r.adminNote}
            </div>
          )}
        </div>
      )}

      {/* Footer date */}
      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-auto pt-1">
        {fmtDate(r.createdAt, tr)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* New return dialog                                                   */
/* ------------------------------------------------------------------ */

function NewReturnDialog({
  open,
  onOpenChange,
  L,
  qc,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  L: ReturnType<typeof labels>;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState<Reason>('DEFECT');
  const [details, setDetails] = useState('');

  const orders = useQuery({
    queryKey: ['orders', 'returns-picker'],
    queryFn: () => api<Order[]>('/orders?take=100'),
    enabled: open,
  });

  const reset = () => {
    setOrderId('');
    setReason('DEFECT');
    setDetails('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      api('/returns', {
        method: 'POST',
        json: { orderId, reason, details: details.trim() },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns', 'me'] });
      toast.success(L.created);
      reset();
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : L.createError),
  });

  const canSubmit =
    !!orderId && details.trim().length >= 3 && !mutation.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      toast.error(L.pickOrder);
      return;
    }
    if (details.trim().length < 3) {
      toast.error(L.detailsTooShort);
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:ring-slate-800">
        <DialogHeader>
          <DialogTitle className="text-navy dark:text-white">
            {L.newReturn}
          </DialogTitle>
          <DialogDescription className="dark:text-slate-400">
            {L.dialogDesc}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Order picker */}
          <Field label={L.fieldOrder}>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              disabled={orders.isLoading}
              className={selectCls}
            >
              <option value="">
                {orders.isLoading ? L.loadingOrders : L.selectOrder}
              </option>
              {(orders.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.orderNumber} — {L.categoryName(o.category)} —{' '}
                  {money(o.total)}
                </option>
              ))}
            </select>
            {!orders.isLoading && (orders.data?.length ?? 0) === 0 && (
              <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1">
                {L.noOrders}
              </p>
            )}
          </Field>

          {/* Reason */}
          <Field label={L.fieldReason}>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as Reason)}
              className={selectCls}
            >
              {REASONS.map((rs) => (
                <option key={rs} value={rs}>
                  {L.reasonName(rs)}
                </option>
              ))}
            </select>
          </Field>

          {/* Details */}
          <Field label={`${L.fieldDetails} *`}>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder={L.detailsPlaceholder}
              className={`${selectCls} h-auto py-2 resize-none`}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {L.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              className="h-9 rounded-xl"
            >
              <Undo2 className="h-4 w-4" />
              {mutation.isPending ? L.submitting : L.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const selectCls =
  'h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-navy dark:text-slate-200">
        {label}
      </span>
      {children}
    </label>
  );
}

function EmptyBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <PackageOpen className="h-7 w-7 text-slate-400" />
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
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl px-5 py-16 text-center">
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
/* Shared visual maps + helpers                                        */
/* ------------------------------------------------------------------ */

const STATUS_CHIP: Record<RStatus, string> = {
  REQUESTED:
    'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  APPROVED: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  REJECTED: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  RECEIVED:
    'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  REFUNDED:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  REPRINTED:
    'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
};

const statusChip = (s: RStatus) =>
  `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${
    STATUS_CHIP[s] ?? STATUS_CHIP.REQUESTED
  }`;

const reasonChip = () =>
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

const money = (n: number) => `$${Number(n).toFixed(2)}`;

const fmtDate = (d: string, tr: boolean) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(tr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/* Inline i18n */
function labels(tr: boolean) {
  const reasonName = (r: Reason) =>
    tr
      ? {
          DEFECT: 'Kusurlu baskı',
          WRONG_ITEM: 'Yanlış ürün',
          DAMAGED: 'Kargoda hasar',
          NOT_AS_DESC: 'Açıklamaya uymuyor',
          OTHER: 'Diğer',
        }[r] ?? r
      : {
          DEFECT: 'Defect',
          WRONG_ITEM: 'Wrong item',
          DAMAGED: 'Damaged in transit',
          NOT_AS_DESC: 'Not as described',
          OTHER: 'Other',
        }[r] ?? r;

  const statusName = (s: RStatus) =>
    tr
      ? {
          REQUESTED: 'Talep edildi',
          APPROVED: 'Onaylandı',
          REJECTED: 'Reddedildi',
          RECEIVED: 'Teslim alındı',
          REFUNDED: 'İade edildi',
          REPRINTED: 'Yeniden basıldı',
        }[s] ?? s
      : {
          REQUESTED: 'Requested',
          APPROVED: 'Approved',
          REJECTED: 'Rejected',
          RECEIVED: 'Received',
          REFUNDED: 'Refunded',
          REPRINTED: 'Reprinted',
        }[s] ?? s;

  const categoryName = (c: string) =>
    tr
      ? {
          WALLPAPER: 'Duvar Kağıdı',
          WALL_DECAL: 'Duvar Sticker',
          WOOD: 'Ahşap',
        }[c] ?? c
      : {
          WALLPAPER: 'Wallpaper',
          WALL_DECAL: 'Wall decal',
          WOOD: 'Wood',
        }[c] ?? c;

  return {
    reasonName,
    statusName,
    categoryName,
    title: tr ? 'İadeler' : 'Returns',
    subtitle: tr
      ? 'Kolay iade — siparişin için talep oluştur'
      : 'Easy returns — open a request for your order',
    refresh: tr ? 'Yenile' : 'Refresh',
    refreshed: tr ? 'İadeler güncellendi' : 'Returns refreshed',
    newReturn: tr ? '+ İade Talebi' : '+ New Return',
    dialogDesc: tr
      ? 'Siparişini seç, nedenini belirt ve detay ekle.'
      : 'Pick your order, choose a reason and add details.',

    fieldOrder: tr ? 'Sipariş' : 'Order',
    fieldReason: tr ? 'İade Nedeni' : 'Reason',
    fieldDetails: tr ? 'Detay' : 'Details',
    selectOrder: tr ? 'Sipariş seç…' : 'Select an order…',
    loadingOrders: tr ? 'Siparişler yükleniyor…' : 'Loading orders…',
    noOrders: tr ? 'İade için uygun sipariş yok.' : 'No eligible orders.',
    detailsPlaceholder: tr
      ? 'Sorunu kısaca açıkla (en az 3 karakter)…'
      : 'Briefly describe the issue (min 3 characters)…',

    cancel: tr ? 'Vazgeç' : 'Cancel',
    submit: tr ? 'Talep Gönder' : 'Submit Request',
    submitting: tr ? 'Gönderiliyor…' : 'Submitting…',
    created: tr ? 'İade talebi oluşturuldu' : 'Return request created',
    createError: tr ? 'Talep oluşturulamadı' : 'Could not create request',
    pickOrder: tr ? 'Lütfen bir sipariş seç' : 'Please select an order',
    detailsTooShort: tr
      ? 'Detay en az 3 karakter olmalı'
      : 'Details must be at least 3 characters',

    resolution: tr ? 'Çözüm' : 'Resolution',
    adminNote: tr ? 'Not' : 'Note',
    refunded: tr ? 'iade edildi' : 'refunded',

    emptyTitle: tr ? 'Henüz iade talebin yok' : 'No returns yet',
    emptyDesc: tr
      ? 'Bir siparişinle ilgili sorun olursa buradan kolayca iade talebi oluştur.'
      : 'If something is wrong with an order, open a return request here.',
    loadError: tr ? 'İadeler yüklenemedi' : 'Failed to load returns',
    retry: tr ? 'Tekrar dene' : 'Try again',
  };
}
