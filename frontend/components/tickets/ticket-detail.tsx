'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
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

  if (isLoading)
    return (
      <div className="space-y-4 max-w-2xl">
        <ListSkeleton rows={3} />
      </div>
    );
  if (!tk) return <div className="text-slate-400 text-sm">—</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-navy">{tk.subject}</h1>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
          {t(tk.status as 'OPEN')}
        </span>
      </div>

      <div className="space-y-3">
        {tk.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl p-4 text-sm ${
              m.internal ? 'bg-amber-50 border border-amber-100' : 'bg-white border border-slate-100'
            }`}
          >
            {m.internal && <div className="text-[10px] font-bold text-amber-600 mb-1">{t('internal')}</div>}
            <div className="text-slate-700 whitespace-pre-wrap">{m.body}</div>
            <div className="text-[10px] text-slate-400 mt-2">{shortDate(m.createdAt)}</div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate();
        }}
        className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder={t('message')}
          className="w-full rounded-md border border-slate-200 p-2 text-sm"
        />
        <div className="flex items-center justify-between">
          {staff ? (
            <label className="flex items-center gap-2 text-xs text-slate-500">
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
