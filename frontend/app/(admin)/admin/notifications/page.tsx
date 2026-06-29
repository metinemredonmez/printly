'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Bell,
  BellRing,
  CheckCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Notif {
  id: string;
  title: string;
  body: string;
  type?: string | null;
  readAt?: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminNotificationsPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'notifs'],
    queryFn: () => api<Notif[]>('/notifications/center'),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'notifs'] });
    qc.invalidateQueries({ queryKey: ['notif', 'unread'] });
  };

  const readOne = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/center/${id}/read`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : L.error),
  });

  const readAll = useMutation({
    mutationFn: () => api('/notifications/center/read-all', { method: 'POST' }),
    onSuccess: () => {
      toast.success(L.allReadDone);
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : L.error),
  });

  const list = data ?? [];
  const unread = list.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy dark:text-white">
            {L.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {unread > 0 ? L.unreadCount(unread) : L.allCaughtUp}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
          >
            <RotateCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {L.refresh}
          </Button>
          <Button
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending || unread === 0}
            className="h-9 rounded-xl"
          >
            <CheckCheck className="h-4 w-4" />
            {readAll.isPending ? L.submitting : L.readAll}
          </Button>
        </div>
      </div>

      {/* List card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <div className="mt-0.5 h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="px-5 py-16 text-center">
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
              className="mt-4 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {L.retry}
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Bell className="h-7 w-7 text-slate-400" />
            </div>
            <p className="font-semibold text-navy dark:text-white">{L.emptyTitle}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              {L.emptyDesc}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((n) => {
              const isUnread = !n.readAt;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => isUnread && readOne.mutate(n.id)}
                  disabled={!isUnread || readOne.isPending}
                  className={`group w-full text-left flex items-start gap-4 px-5 py-4 transition-colors ${
                    isUnread
                      ? 'bg-primary/[0.04] dark:bg-primary/10 border-l-2 border-l-primary hover:bg-primary/[0.07] dark:hover:bg-primary/15 cursor-pointer'
                      : 'border-l-2 border-l-transparent hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-default'
                  }`}
                >
                  <div
                    className={`mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isUnread
                        ? 'bg-primary/10 text-primary dark:bg-primary/15'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    }`}
                  >
                    {isUnread ? (
                      <BellRing className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold ${
                          isUnread
                            ? 'text-navy dark:text-white'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {n.title}
                      </span>
                      {isUnread && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 dark:bg-primary/15 text-primary px-2 py-0.5 text-[11px] font-medium">
                          {L.new}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto shrink-0">
                        {fmtDate(n.createdAt, tr)}
                      </span>
                    </div>
                    <p
                      className={`text-sm mt-1 break-words ${
                        isUnread
                          ? 'text-slate-600 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {n.body}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

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
    title: tr ? 'Bildirimler' : 'Notifications',
    allCaughtUp: tr ? 'Tüm bildirimler okundu.' : "You're all caught up.",
    unreadCount: (n: number) =>
      tr ? `${n} okunmamış bildirim` : `${n} unread notification${n > 1 ? 's' : ''}`,

    refresh: tr ? 'Yenile' : 'Refresh',
    readAll: tr ? 'Tümünü okundu işaretle' : 'Mark all as read',
    submitting: tr ? 'İşleniyor…' : 'Working…',
    allReadDone: tr ? 'Tüm bildirimler okundu işaretlendi' : 'All notifications marked as read',
    new: tr ? 'Yeni' : 'New',

    emptyTitle: tr ? 'Bildirim yok' : 'No notifications',
    emptyDesc: tr
      ? 'Yeni bir şey olduğunda bildirimleriniz burada görünecek.'
      : 'Your notifications will appear here when something happens.',

    loadError: tr ? 'Bildirimler yüklenemedi' : 'Failed to load notifications',
    error: tr ? 'Bir hata oluştu' : 'Something went wrong',
    retry: tr ? 'Tekrar dene' : 'Try again',
  };
}
