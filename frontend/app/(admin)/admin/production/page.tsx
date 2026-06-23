'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ScanLine, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Job {
  id: string;
  orderId: string;
  station: string;
  status: string;
  priority: boolean;
  createdAt: string;
}

const JOB_COLOR: Record<string, string> = {
  QUEUED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-50 text-primary',
  DONE: 'bg-emerald-50 text-emerald-700',
};

export default function ProductionPage() {
  const t = useTranslations('prod');
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [station, setStation] = useState('production');

  const { data, isLoading } = useQuery({
    queryKey: ['production', 'queue'],
    queryFn: () => api<Job[]>('/production/queue'),
  });

  const scan = useMutation({
    mutationFn: () => api('/scan', { method: 'POST', json: { code: code.trim(), station } }),
    onSuccess: (r: unknown) => {
      const d = r as { status?: string; orderNumber?: string };
      toast.success(`${t('scanned')}: ${d.orderNumber ?? ''} → ${d.status ?? ''}`);
      setCode('');
      qc.invalidateQueries({ queryKey: ['production'] });
      qc.invalidateQueries({ queryKey: ['board'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('scanFailed')),
  });

  const setJob = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/production/jobs/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production'] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Hata'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">{t('title')}</h1>
        <p className="text-slate-500">{t('subtitle')}</p>
      </div>

      {/* QR / barkod okut */}
      <div className="bg-navy text-white rounded-2xl p-5">
        <div className="flex items-center gap-2 font-bold mb-3">
          <ScanLine className="h-5 w-5" /> {t('scan')}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) scan.mutate();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[200px]">
            <Label className="text-slate-300 text-xs">{t('scanCode')}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
              placeholder="OD-..."
              autoFocus
            />
          </div>
          <div>
            <Label className="text-slate-300 text-xs">{t('scanStation')}</Label>
            <select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="h-9 rounded-md bg-white/10 border border-white/20 text-white text-sm px-2 block"
            >
              <option value="production" className="text-navy">{t('PRINT')}</option>
              <option value="ready" className="text-navy">{t('PACK')}</option>
              <option value="ship" className="text-navy">SHIP</option>
            </select>
          </div>
          <Button type="submit" disabled={scan.isPending} className="bg-primary hover:bg-primary-hover">
            {t('scanBtn')}
          </Button>
        </form>
      </div>

      {/* Kuyruk */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-navy">{t('queue')}</div>
        {isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : (data ?? []).length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">{t('empty')}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(data ?? []).map((j) => (
              <div key={j.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  {j.priority && <Zap className="h-4 w-4 text-amber-500" />}
                  <div>
                    <div className="font-semibold text-navy text-sm">
                      {t(j.station as 'PRINT')} · {j.orderId.slice(-6)}
                    </div>
                    <div className="text-[11px] text-slate-400">{shortDate(j.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${JOB_COLOR[j.status]}`}>
                    {t(j.status as 'QUEUED')}
                  </span>
                  {j.status === 'QUEUED' && (
                    <Button size="sm" variant="outline" onClick={() => setJob.mutate({ id: j.id, status: 'IN_PROGRESS' })}>
                      {t('start')}
                    </Button>
                  )}
                  {j.status === 'IN_PROGRESS' && (
                    <Button size="sm" onClick={() => setJob.mutate({ id: j.id, status: 'DONE' })}>
                      {t('done')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
