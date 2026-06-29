'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ListSkeleton } from '@/components/skeletons';
import { money } from '@/lib/format';

interface Card {
  id: string;
  orderNumber: string;
  total: number;
  category: string;
  clientName?: string;
}
interface Column {
  status: string;
  count: number;
  cards: Card[];
}

const COL_BORDER: Record<string, string> = {
  RECEIVED: 'border-t-slate-400',
  IN_PRODUCTION: 'border-t-primary',
  AWAITING_APPROVAL: 'border-t-amber-500',
  READY: 'border-t-emerald-500',
  SHIPPED: 'border-t-emerald-700',
  CANCELLED: 'border-t-rose-500',
};

export default function KanbanPage() {
  const t = useTranslations('kanban');
  const tos = useTranslations('orderStatus');
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['board'],
    queryFn: () => api<{ columns: Column[] }>('/board'),
  });

  const move = useMutation({
    mutationFn: ({ id, toStatus }: { id: string; toStatus: string }) =>
      api(`/board/orders/${id}/move`, { method: 'PATCH', json: { toStatus, position: 0 } }),
    onSuccess: () => {
      toast.success(t('moved'));
      qc.invalidateQueries({ queryKey: ['board'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Hata'),
  });

  const cols = data?.columns ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy dark:text-white">{t('title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {cols.map((col) => (
            <div
              key={col.status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) move.mutate({ id: dragId, toStatus: col.status });
                setDragId(null);
              }}
              className={`bg-slate-50 dark:bg-slate-800/40 rounded-2xl border-t-4 ${COL_BORDER[col.status] ?? 'border-t-slate-300'} p-2 min-h-[300px]`}
            >
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-xs font-semibold text-navy dark:text-white uppercase">{tos(col.status)}</span>
                <span className="text-[11px] bg-white dark:bg-slate-900 rounded-full px-2 py-0.5 text-slate-500 dark:text-slate-400 font-semibold">
                  {col.count}
                </span>
              </div>
              <div className="space-y-2">
                {col.cards.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <div className="font-semibold text-navy dark:text-white text-sm truncate">{c.orderNumber}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">{c.category}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{c.clientName ?? '—'}</span>
                      <span className="font-semibold text-navy dark:text-white text-xs">{money(c.total)}</span>
                    </div>
                  </div>
                ))}
                {col.cards.length === 0 && (
                  <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-6">{t('empty')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
