'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Headset,
  Calendar,
  Clock,
  Check,
  Video,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Mail,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
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

type ConsultingStatus = 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

interface ConsultingRequest {
  id: string;
  userId: string;
  topic: string;
  details?: string | null;
  preferredAt?: string | null;
  status: ConsultingStatus;
  scheduledAt?: string | null;
  meetingUrl?: string | null;
  adminNote?: string | null;
  createdAt: string;
  user?: { id: string; fullName: string; email: string; role: string };
}

const STATUSES: ConsultingStatus[] = ['PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

const STATUS_META: Record<ConsultingStatus, string> = {
  PENDING:
    'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  SCHEDULED:
    'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  COMPLETED:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  CANCELLED:
    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminConsultingPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);

  const [filter, setFilter] = useState<'ALL' | ConsultingStatus>('ALL');
  const [editing, setEditing] = useState<ConsultingRequest | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'consulting'],
    queryFn: () => api<ConsultingRequest[]>('/consulting'),
  });

  const rows = data ?? [];

  const counts = useMemo(() => {
    const c: Record<'ALL' | ConsultingStatus, number> = {
      ALL: rows.length,
      PENDING: 0,
      SCHEDULED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const r of rows) c[r.status] += 1;
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
          <h1 className="text-xl font-semibold text-navy dark:text-white">{L.title}</h1>
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

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['ALL', ...STATUSES] as const).map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`inline-flex items-center gap-2 h-9 rounded-xl px-3 text-sm font-medium transition-colors border ${
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800/60'
              }`}
            >
              {s === 'ALL' ? L.all : L.statusName(s)}
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 rounded-full px-1.5 text-[11px] ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {counts[s]}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-3xl border border-slate-100 bg-white animate-pulse dark:bg-slate-900 dark:border-slate-800"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl px-5 py-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-rose-500" />
          </div>
          <p className="font-semibold text-navy dark:text-white">
            {error instanceof Error ? error.message : L.loadError}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-4 rounded-xl dark:border-slate-700 dark:text-slate-200"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {L.retry}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl px-5 py-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Headset className="h-7 w-7 text-slate-400" />
          </div>
          <p className="font-semibold text-navy dark:text-white">{L.emptyTitle}</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            {filter === 'ALL' ? L.emptyDesc : L.emptyFilterDesc}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  {/* User */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-navy dark:text-white truncate">
                      {r.user?.fullName ?? L.unknownUser}
                    </span>
                    {r.user?.email && (
                      <span className="inline-flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400 truncate">
                        <Mail className="h-3.5 w-3.5" />
                        {r.user.email}
                      </span>
                    )}
                  </div>
                  {/* Topic */}
                  <h3 className="font-semibold text-navy dark:text-white mt-1.5">{r.topic}</h3>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 ${STATUS_META[r.status]}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {L.statusName(r.status)}
                </span>
              </div>

              {r.details && (
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 whitespace-pre-wrap">
                  {r.details}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[12px] text-slate-500 dark:text-slate-400">
                {r.preferredAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {L.preferred}: {fmtDate(r.preferredAt, tr)}
                  </span>
                )}
                {r.scheduledAt && (
                  <span className="inline-flex items-center gap-1.5 text-primary dark:text-blue-300">
                    <Clock className="h-3.5 w-3.5" />
                    {L.scheduled}: {fmtDate(r.scheduledAt, tr)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  {L.requestedOn} {fmtDate(r.createdAt, tr)}
                </span>
              </div>

              {r.adminNote && (
                <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {L.adminNote}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap">
                    {r.adminNote}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <Button onClick={() => setEditing(r)} className="h-9 rounded-xl">
                  {L.manage}
                </Button>
                {r.meetingUrl && (
                  <a href={r.meetingUrl} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="outline"
                      className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
                    >
                      <Video className="h-4 w-4" />
                      {L.openMeeting}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manage dialog */}
      {editing && (
        <ManageDialog request={editing} onClose={() => setEditing(null)} L={L} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Manage dialog                                                        */
/* ------------------------------------------------------------------ */

function ManageDialog({
  request,
  onClose,
  L,
}: {
  request: ConsultingRequest;
  onClose: () => void;
  L: ReturnType<typeof labels>;
}) {
  const qc = useQueryClient();

  const [status, setStatus] = useState<ConsultingStatus>(request.status);
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(request.scheduledAt));
  const [meetingUrl, setMeetingUrl] = useState(request.meetingUrl ?? '');
  const [adminNote, setAdminNote] = useState(request.adminNote ?? '');

  const save = useMutation({
    mutationFn: () => {
      const json: Record<string, unknown> = { status };
      if (scheduledAt) json.scheduledAt = new Date(scheduledAt).toISOString();
      if (meetingUrl.trim()) json.meetingUrl = meetingUrl.trim();
      if (adminNote.trim()) json.adminNote = adminNote.trim();
      return api(`/consulting/${request.id}`, { method: 'PATCH', json });
    },
    onSuccess: () => {
      toast.success(L.updated);
      qc.invalidateQueries({ queryKey: ['admin', 'consulting'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.genericError),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800">
        <DialogHeader>
          <DialogTitle className="text-navy dark:text-white">{L.manageTitle}</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            {request.user?.fullName ? `${request.user.fullName} — ` : ''}
            {request.topic}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy dark:text-slate-200">{L.statusLabel}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ConsultingStatus)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {L.statusName(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy dark:text-slate-200">{L.scheduledLabel}</label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy dark:text-slate-200">{L.meetingUrlLabel}</label>
            <Input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.example.com/…"
              className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy dark:text-slate-200">{L.adminNoteLabel}</label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              placeholder={L.adminNotePlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {L.cancel}
            </Button>
            <Button type="submit" disabled={save.isPending} className="h-9 rounded-xl">
              <Check className="h-4 w-4" />
              {save.isPending ? L.saving : L.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const fmtDate = (d: string, tr: boolean) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(tr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/* ISO → value for <input type="datetime-local"> (local time, no tz suffix) */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

/* Inline i18n (next-intl useLocale) — JSON'a dokunmadan */
function labels(tr: boolean) {
  const statusName = (s: ConsultingStatus) =>
    tr
      ? {
          PENDING: 'Beklemede',
          SCHEDULED: 'Randevulu',
          COMPLETED: 'Tamamlandı',
          CANCELLED: 'İptal',
        }[s] ?? s
      : {
          PENDING: 'Pending',
          SCHEDULED: 'Scheduled',
          COMPLETED: 'Completed',
          CANCELLED: 'Cancelled',
        }[s] ?? s;

  return {
    statusName,
    title: tr ? 'Danışmanlık Talepleri' : 'Consulting Requests',
    subtitle: tr
      ? 'Bayilerin birebir danışmanlık taleplerini yönetin.'
      : 'Manage one-on-one consulting requests from dealers.',
    refresh: tr ? 'Yenile' : 'Refresh',
    refreshed: tr ? 'Talepler güncellendi' : 'Requests refreshed',

    all: tr ? 'Tümü' : 'All',
    unknownUser: tr ? 'Bilinmeyen kullanıcı' : 'Unknown user',

    preferred: tr ? 'Tercih edilen' : 'Preferred',
    scheduled: tr ? 'Randevu' : 'Scheduled',
    requestedOn: tr ? 'Talep:' : 'Requested:',
    adminNote: tr ? 'Ekip Notu' : 'Team Note',
    openMeeting: tr ? 'Görüşmeyi aç' : 'Open meeting',
    manage: tr ? 'Yönet' : 'Manage',

    emptyTitle: tr ? 'Talep bulunamadı' : 'No requests found',
    emptyDesc: tr
      ? 'Henüz danışmanlık talebi oluşturulmamış.'
      : 'No consulting requests have been created yet.',
    emptyFilterDesc: tr
      ? 'Bu duruma uygun talep yok. Filtreyi değiştirmeyi deneyin.'
      : 'No requests match this status. Try changing the filter.',

    loadError: tr ? 'Talepler yüklenemedi' : 'Failed to load requests',
    retry: tr ? 'Tekrar dene' : 'Try again',

    manageTitle: tr ? 'Talebi Yönet' : 'Manage Request',
    statusLabel: tr ? 'Durum' : 'Status',
    scheduledLabel: tr ? 'Randevu Zamanı' : 'Scheduled Time',
    meetingUrlLabel: tr ? 'Görüşme Bağlantısı' : 'Meeting URL',
    adminNoteLabel: tr ? 'Ekip Notu' : 'Team Note',
    adminNotePlaceholder: tr
      ? 'Bayiye iletilecek not…'
      : 'Note to share with the dealer…',

    cancel: tr ? 'Vazgeç' : 'Cancel',
    save: tr ? 'Kaydet' : 'Save',
    saving: tr ? 'Kaydediliyor…' : 'Saving…',
    updated: tr ? 'Talep güncellendi' : 'Request updated',
    genericError: tr ? 'Bir hata oluştu' : 'Something went wrong',
  };
}
