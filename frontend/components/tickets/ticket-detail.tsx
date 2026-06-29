'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Lock, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/skeletons';

interface Message {
  id: string;
  authorUserId: string;
  body: string;
  internal: boolean;
  createdAt: string;
}
interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  messages: Message[];
}

export function TicketDetail({
  id,
  basePath,
  staff = false,
}: {
  id: string;
  basePath: string;
  staff?: boolean;
}) {
  const t = useTranslations('tickets');
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);

  const { data: tk, isLoading } = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => api<Ticket>(`/tickets/${id}`),
  });

  const send = useMutation({
    mutationFn: () =>
      api(`/tickets/${id}/messages`, { method: 'POST', json: { body, internal: staff ? internal : false } }),
    onSuccess: () => {
      toast.success(t('sent'));
      setBody('');
      qc.invalidateQueries({ queryKey: ['tickets', id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Hata'),
  });

  const setStatus = useMutation({
    mutationFn: (status: 'CLOSED' | 'OPEN') =>
      api(`/tickets/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: (_d, status) => {
      toast.success(
        status === 'CLOSED'
          ? tr
            ? 'Talep kapatıldı'
            : 'Ticket closed'
          : tr
            ? 'Talep yeniden açıldı'
            : 'Ticket reopened',
      );
      qc.invalidateQueries({ queryKey: ['tickets', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : tr ? 'Hata' : 'Error'),
  });

  if (isLoading)
    return (
      <div className="space-y-4 max-w-2xl">
        <ListSkeleton rows={3} />
      </div>
    );
  if (!tk) return <div className="text-slate-400 dark:text-slate-500 text-sm">—</div>;

  const isClosed = tk.status === 'CLOSED';
  const canClose = tk.status === 'OPEN' || tk.status === 'PENDING';

  return (
    <div className="space-y-4 max-w-2xl">
      <Link
        href={basePath}
        className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-navy dark:text-white">{tk.subject}</h1>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {t(tk.status as 'OPEN')}
          </span>
          {staff && (canClose || isClosed) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus.mutate(isClosed ? 'OPEN' : 'CLOSED')}
              disabled={setStatus.isPending}
              className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {isClosed ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" /> {tr ? 'Yeniden Aç' : 'Reopen'}
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" /> {tr ? 'Kapat' : 'Close'}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {tk.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl p-4 text-sm ${
              m.internal
                ? 'bg-amber-50 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20'
                : 'bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800'
            }`}
          >
            {m.internal && (
              <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-300 mb-1">{t('internal')}</div>
            )}
            <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{m.body}</div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">{shortDate(m.createdAt)}</div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate();
        }}
        className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2 dark:bg-slate-900 dark:border-slate-800"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder={t('message')}
          className="w-full rounded-md border border-slate-200 p-2 text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-white"
        />
        <div className="flex items-center justify-between">
          {staff ? (
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <input type="checkbox" className="accent-primary" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              {t('internal')}
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={send.isPending}>
            {t('send')}
          </Button>
        </div>
      </form>
    </div>
  );
}
