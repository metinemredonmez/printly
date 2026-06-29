'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Headset,
  MessageSquare,
  Calendar,
  Clock,
  Send,
  Video,
  Plus,
  AlertTriangle,
  RotateCcw,
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

/* ------------------------------------------------------------------ */
/* Status visuals                                                      */
/* ------------------------------------------------------------------ */

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

export default function ConsultingPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [preferredAt, setPreferredAt] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['consulting', 'me'],
    queryFn: () => api<ConsultingRequest[]>('/consulting'),
  });

  const rows = data ?? [];

  const create = useMutation({
    mutationFn: () =>
      api('/consulting', {
        method: 'POST',
        json: {
          topic: topic.trim(),
          details: details.trim() || undefined,
          preferredAt: preferredAt ? new Date(preferredAt).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(L.created);
      setOpen(false);
      setTopic('');
      setDetails('');
      setPreferredAt('');
      qc.invalidateQueries({ queryKey: ['consulting', 'me'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.genericError),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error(L.topicRequired);
      return;
    }
    create.mutate();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy dark:text-white">{L.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{L.subtitle}</p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="h-9 rounded-xl"
        >
          <Plus className="h-4 w-4" />
          {L.requestCta}
        </Button>
      </div>

      {/* Intro card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Headset className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-navy dark:text-white">{L.introTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{L.introBody}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-medium">
                <Headset className="h-3.5 w-3.5" />
                {L.teamFree}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 text-[11px] font-medium">
                <MessageSquare className="h-3.5 w-3.5" />
                {L.standardCanRequest}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-navy dark:text-white">{L.myRequests}</h2>
          {!isLoading && !isError && (
            <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 rounded-full px-2 py-0.5">
              {rows.length}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-3xl border border-slate-100 bg-white animate-pulse dark:bg-slate-900 dark:border-slate-800"
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
        ) : rows.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl px-5 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Headset className="h-7 w-7 text-slate-400" />
            </div>
            <p className="font-semibold text-navy dark:text-white">{L.emptyTitle}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              {L.emptyDesc}
            </p>
            <Button onClick={() => setOpen(true)} className="mt-4 h-9 rounded-xl">
              <Plus className="h-4 w-4" />
              {L.requestCta}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-navy dark:text-white truncate">{r.topic}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[12px] text-slate-500 dark:text-slate-400">
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
                    </div>
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

                {r.adminNote && (
                  <div className="mt-3 rounded-2xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-3">
                    <div className="text-[11px] font-semibold text-primary dark:text-blue-300 uppercase tracking-wide">
                      {L.adminNote}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap">
                      {r.adminNote}
                    </p>
                  </div>
                )}

                {r.status === 'SCHEDULED' && r.meetingUrl && (
                  <a href={r.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-4">
                    <Button className="h-9 rounded-xl">
                      <Video className="h-4 w-4" />
                      {L.joinMeeting}
                    </Button>
                  </a>
                )}

                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
                  {L.requestedOn} {fmtDate(r.createdAt, tr)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800">
          <DialogHeader>
            <DialogTitle className="text-navy dark:text-white">{L.dialogTitle}</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {L.dialogDesc}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-navy dark:text-slate-200">
                {L.topicLabel} <span className="text-rose-500">*</span>
              </label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={L.topicPlaceholder}
                required
                className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-navy dark:text-slate-200">
                {L.detailsLabel}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                placeholder={L.detailsPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-navy dark:text-slate-200">
                {L.preferredLabel}
              </label>
              <Input
                type="datetime-local"
                value={preferredAt}
                onChange={(e) => setPreferredAt(e.target.value)}
                className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{L.preferredHint}</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
              >
                {L.cancel}
              </Button>
              <Button type="submit" disabled={create.isPending} className="h-9 rounded-xl">
                <Send className="h-4 w-4" />
                {create.isPending ? L.sending : L.submit}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
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
    title: tr ? 'Danışmanlık' : 'Consulting',
    subtitle: tr
      ? 'Uzman ekibimizle birebir danışmanlık görüşmesi talep edin.'
      : 'Request a one-on-one consulting session with our expert team.',
    requestCta: tr ? 'Danışmanlık Talebi' : 'Request Consulting',

    introTitle: tr ? 'Uzman ekibimizle birebir danışmanlık' : 'One-on-one consulting with our experts',
    introBody: tr
      ? 'Ürün seçimi, baskı teknikleri, fiyatlandırma ve bayilik süreçleriniz için uzman ekibimizle birebir görüşün.'
      : 'Talk one-on-one with our experts about product selection, printing techniques, pricing and your dealership journey.',
    teamFree: tr ? 'Ekip Üyeleri için ücretsiz' : 'Free for Team Members',
    standardCanRequest: tr ? 'Standart kullanıcılar da talep edebilir' : 'Standard users can request too',

    myRequests: tr ? 'Taleplerim' : 'My Requests',

    preferred: tr ? 'Tercih edilen' : 'Preferred',
    scheduled: tr ? 'Randevu' : 'Scheduled',
    adminNote: tr ? 'Ekip Notu' : 'Team Note',
    joinMeeting: tr ? 'Görüşmeye katıl' : 'Join meeting',
    requestedOn: tr ? 'Talep tarihi:' : 'Requested on',

    emptyTitle: tr ? 'Henüz talebiniz yok' : 'No requests yet',
    emptyDesc: tr
      ? 'İlk danışmanlık talebinizi oluşturun, ekibimiz en kısa sürede dönüş yapsın.'
      : 'Create your first consulting request and our team will get back to you shortly.',

    loadError: tr ? 'Talepler yüklenemedi' : 'Failed to load requests',
    retry: tr ? 'Tekrar dene' : 'Try again',

    dialogTitle: tr ? 'Danışmanlık Talebi' : 'Request Consulting',
    dialogDesc: tr
      ? 'Konuyu ve varsa tercih ettiğiniz zamanı belirtin.'
      : 'Tell us the topic and, optionally, your preferred time.',
    topicLabel: tr ? 'Konu' : 'Topic',
    topicPlaceholder: tr ? 'Örn. Duvar kağıdı baskı kalitesi' : 'e.g. Wallpaper print quality',
    detailsLabel: tr ? 'Detaylar' : 'Details',
    detailsPlaceholder: tr
      ? 'Görüşmek istediğiniz konuyu kısaca anlatın…'
      : 'Briefly describe what you would like to discuss…',
    preferredLabel: tr ? 'Tercih Edilen Zaman' : 'Preferred Time',
    preferredHint: tr ? 'Opsiyonel' : 'Optional',

    cancel: tr ? 'Vazgeç' : 'Cancel',
    submit: tr ? 'Talep Gönder' : 'Send Request',
    sending: tr ? 'Gönderiliyor…' : 'Sending…',
    created: tr ? 'Danışmanlık talebiniz alındı' : 'Your consulting request has been received',
    topicRequired: tr ? 'Lütfen bir konu girin' : 'Please enter a topic',
    genericError: tr ? 'Bir hata oluştu' : 'Something went wrong',
  };
}
