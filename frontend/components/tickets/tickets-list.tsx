'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableSkeleton } from '@/components/skeletons';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

const ST_COLOR: Record<string, string> = {
  OPEN: 'bg-blue-50 text-primary',
  PENDING: 'bg-amber-50 text-amber-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-600',
};

export function TicketsList({ basePath }: { basePath: string; staff?: boolean }) {
  const t = useTranslations('tickets');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api<Ticket[]>('/tickets'),
  });

  const create = useMutation({
    mutationFn: () => api('/tickets', { method: 'POST', json: { subject, body } }),
    onSuccess: () => {
      toast.success(t('created'));
      setOpen(false);
      setSubject('');
      setBody('');
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Hata'),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">{t('title')}</h1>
        <Button onClick={() => setOpen((o) => !o)}>
          <Plus className="h-4 w-4 mr-1" /> {t('new')}
        </Button>
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3"
        >
          <div className="space-y-1.5">
            <Label>{t('subject')}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t('message')}</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={3}
              className="w-full rounded-md border border-slate-200 p-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {t('create')}
          </Button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={2} />
        ) : (data ?? []).length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">{t('empty')}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(data ?? []).map((tk) => (
              <Link
                key={tk.id}
                href={`${basePath}/${tk.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50"
              >
                <div>
                  <div className="font-semibold text-navy text-sm">{tk.subject}</div>
                  <div className="text-[11px] text-slate-400">{shortDate(tk.createdAt)}</div>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${ST_COLOR[tk.status] ?? 'bg-slate-100'}`}>
                  {t(tk.status as 'OPEN')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
