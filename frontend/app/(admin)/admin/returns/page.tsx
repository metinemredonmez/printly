'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  PackageOpen,
  RotateCcw,
  Check,
  AlertTriangle,
  DollarSign,
  Undo2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const STATUSES: RStatus[] = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'REFUNDED',
  'REPRINTED',
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminReturnsPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<'ALL' | RStatus>('ALL');
  const [editing, setEditing] = useState<ReturnRequest | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'returns'],
    queryFn: () => api<ReturnRequest[]>('/returns'),
  });

  const rows = data ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: rows.length };
    for (const s of STATUSES) c[s] = 0;
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

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

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={filter === 'ALL'}
          onClick={() => setFilter('ALL')}
          label={L.all}
          count={counts.ALL ?? 0}
        />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={L.statusName(s)}
            count={counts[s] ?? 0}
            tone={s}
          />
        ))}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-slate-100 bg-white h-28 animate-pulse dark:bg-slate-900 dark:border-slate-800"
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
      ) : filtered.length === 0 ? (
        <EmptyBlock title={L.noMatchTitle} description={L.noMatchDesc} />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ReturnRow
              key={r.id}
              r={r}
              L={L}
              tr={tr}
              onProcess={() => setEditing(r)}
            />
          ))}
        </div>
      )}

      <ProcessDialog
        item={editing}
        onClose={() => setEditing(null)}
        L={L}
        qc={qc}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function ReturnRow({
  r,
  L,
  tr,
  onProcess,
}: {
  r: ReturnRequest;
  L: ReturnType<typeof labels>;
  tr: boolean;
  onProcess: () => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 flex flex-col lg:flex-row lg:items-start gap-4">
      <div className="flex-1 min-w-0 space-y-2">
        {/* user + status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-navy dark:text-white">
            {r.user?.fullName ?? L.unknownUser}
          </span>
          {r.user?.email && (
            <span className="text-[12px] text-slate-400 dark:text-slate-500">
              {r.user.email}
            </span>
          )}
          <span className={statusChip(r.status)}>{L.statusName(r.status)}</span>
        </div>

        {/* order + reason */}
        <div className="flex items-center gap-2 flex-wrap text-[12px] text-slate-500 dark:text-slate-400">
          <span className="font-medium text-navy dark:text-slate-200">
            #{r.order.orderNumber}
          </span>
          <span>·</span>
          <span>{money(r.order.total)}</span>
          <span>·</span>
          <span>{L.categoryName(r.order.category)}</span>
          <span className={reasonChip()}>{L.reasonName(r.reason)}</span>
        </div>

        {/* details */}
        {r.details && (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {r.details}
          </p>
        )}

        {/* refund + meta */}
        <div className="flex items-center gap-3 flex-wrap pt-0.5">
          {r.refundAmount != null && r.refundAmount > 0 && (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-3.5 w-3.5" />
              {money(r.refundAmount)}
            </span>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {fmtDate(r.createdAt, tr)}
          </span>
        </div>
      </div>

      <Button
        size="sm"
        onClick={onProcess}
        className="h-9 rounded-xl shrink-0 self-start"
      >
        <Check className="h-4 w-4" />
        {L.process}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Process dialog                                                      */
/* ------------------------------------------------------------------ */

function ProcessDialog({
  item,
  onClose,
  L,
  qc,
}: {
  item: ReturnRequest | null;
  onClose: () => void;
  L: ReturnType<typeof labels>;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const open = !!item;

  const [status, setStatus] = useState<RStatus>('APPROVED');
  const [resolution, setResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [adminNote, setAdminNote] = useState('');
  // Hangi item için form hazırlandığını izle (re-mount yerine senkronizasyon)
  const [syncedId, setSyncedId] = useState<string | null>(null);

  if (item && item.id !== syncedId) {
    setSyncedId(item.id);
    setStatus(item.status);
    setResolution(item.resolution ?? '');
    setRefundAmount(item.refundAmount != null ? String(item.refundAmount) : '');
    setAdminNote(item.adminNote ?? '');
  }

  const mutation = useMutation({
    mutationFn: () => {
      const json: Record<string, unknown> = { status };
      if (resolution.trim()) json.resolution = resolution.trim();
      if (adminNote.trim()) json.adminNote = adminNote.trim();
      const amt = Number(refundAmount);
      if (refundAmount.trim() !== '' && !Number.isNaN(amt))
        json.refundAmount = amt;
      return api(`/returns/${item!.id}`, { method: 'PATCH', json });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'returns'] });
      toast.success(L.saved);
      onClose();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : L.saveError),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:ring-slate-800">
        <DialogHeader>
          <DialogTitle className="text-navy dark:text-white">
            {L.process}
            {item ? ` · #${item.order.orderNumber}` : ''}
          </DialogTitle>
          <DialogDescription className="dark:text-slate-400">
            {item
              ? `${item.user?.fullName ?? L.unknownUser} · ${L.reasonName(item.reason)}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Status */}
          <Field label={L.fieldStatus}>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RStatus)}
              className={selectCls}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {L.statusName(s)}
                </option>
              ))}
            </select>
          </Field>

          {/* Resolution */}
          <Field label={L.fieldResolution}>
            <Input
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder={L.resolutionPlaceholder}
              className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </Field>

          {/* Refund amount */}
          <Field label={L.fieldRefund}>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 pl-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </div>
            <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1">
              {L.refundHint}
            </p>
          </Field>

          {/* Admin note */}
          <Field label={L.fieldNote}>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              placeholder={L.notePlaceholder}
              className={`${selectCls} h-auto py-2 resize-none`}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {L.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
              className="h-9 rounded-xl"
            >
              <Undo2 className="h-4 w-4" />
              {mutation.isPending ? L.saving : L.save}
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

function FilterChip({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: RStatus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[13px] font-medium border transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary dark:bg-primary/15'
          : 'border-slate-200 bg-white text-slate-500 hover:text-navy dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white'
      }`}
    >
      {tone && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`}
          aria-hidden
        />
      )}
      {label}
      <span
        className={`tabular-nums rounded-full px-1.5 text-[11px] ${
          active
            ? 'bg-primary/15 text-primary'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-400'
        }`}
      >
        {count}
      </span>
    </button>
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
/* Visual maps + helpers                                               */
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

const TONE_DOT: Record<RStatus, string> = {
  REQUESTED: 'bg-amber-500',
  APPROVED: 'bg-blue-500',
  REJECTED: 'bg-rose-500',
  RECEIVED: 'bg-indigo-500',
  REFUNDED: 'bg-emerald-500',
  REPRINTED: 'bg-violet-500',
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
    title: tr ? 'İade Yönetimi' : 'Returns',
    subtitle: tr
      ? 'İade taleplerini incele ve sonuçlandır.'
      : 'Review and process return requests.',
    refresh: tr ? 'Yenile' : 'Refresh',
    refreshed: tr ? 'İadeler güncellendi' : 'Returns refreshed',
    all: tr ? 'Tümü' : 'All',
    unknownUser: tr ? 'Bilinmeyen kullanıcı' : 'Unknown user',

    process: tr ? 'İşle' : 'Process',
    fieldStatus: tr ? 'Durum' : 'Status',
    fieldResolution: tr ? 'Çözüm' : 'Resolution',
    fieldRefund: tr ? 'İade Tutarı' : 'Refund Amount',
    fieldNote: tr ? 'Yönetici Notu' : 'Admin Note',
    resolutionPlaceholder: tr
      ? 'örn. yeniden basım / iade / not'
      : 'e.g. reprint / refund / note',
    notePlaceholder: tr
      ? 'Karara dair iç not…'
      : 'Internal note about the decision…',
    refundHint: tr
      ? 'REFUNDED + tutar girersen cüzdana otomatik iade edilir'
      : 'Setting REFUNDED with an amount auto-credits the wallet',

    cancel: tr ? 'Vazgeç' : 'Cancel',
    save: tr ? 'Kaydet' : 'Save',
    saving: tr ? 'Kaydediliyor…' : 'Saving…',
    saved: tr ? 'İade güncellendi' : 'Return updated',
    saveError: tr ? 'Kaydedilemedi' : 'Could not save',

    emptyTitle: tr ? 'Henüz iade talebi yok' : 'No return requests yet',
    emptyDesc: tr
      ? 'Bayiler iade talebi oluşturdukça burada listelenecek.'
      : 'Requests will appear here as dealers open returns.',
    noMatchTitle: tr ? 'Bu durumda kayıt yok' : 'Nothing in this status',
    noMatchDesc: tr
      ? 'Başka bir durum filtresi seçmeyi deneyin.'
      : 'Try selecting another status filter.',
    loadError: tr ? 'İadeler yüklenemedi' : 'Failed to load returns',
    retry: tr ? 'Tekrar dene' : 'Try again',
  };
}
