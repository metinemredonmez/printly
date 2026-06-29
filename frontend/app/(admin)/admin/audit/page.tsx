'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ScrollText, Hash, User, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { shortDate } from '@/lib/format';
import { ListSkeleton, EmptyState } from '@/components/skeletons';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  createdAt: string;
}

// Aksiyon ön ekine göre küçük renk (badge + nokta).
function actionTone(action: string): { badge: string; dot: string } {
  const a = (action || '').toUpperCase();
  if (/(CREATE|ADD|INSERT)/.test(a)) return { badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', dot: 'bg-emerald-500' };
  if (/(UPDATE|EDIT|PATCH|CHANGE)/.test(a)) return { badge: 'bg-blue-50 text-primary dark:bg-blue-500/10', dot: 'bg-primary' };
  if (/(DELETE|REMOVE|CANCEL)/.test(a)) return { badge: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300', dot: 'bg-rose-500' };
  if (/(LOGIN|AUTH|LOGOUT)/.test(a)) return { badge: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300', dot: 'bg-amber-500' };
  return { badge: 'bg-slate-100 text-navy dark:bg-slate-800 dark:text-white', dot: 'bg-slate-400' };
}

export default function AdminAudit() {
  const t = useTranslations('audit');

  const logs = useQuery({
    queryKey: ['audit', 'list'],
    queryFn: () => api<AuditEntry[]>('/audit?take=100'),
  });

  const items = logs.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy dark:text-white">{t('title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold text-navy dark:text-white">{t('timeline')}</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {logs.isLoading ? '…' : t('count', { n: items.length })}
          </span>
        </div>

        {logs.isLoading ? (
          <div className="p-5">
            <ListSkeleton rows={6} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((e) => {
              const tone = actionTone(e.action);
              return (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={tone.badge}>{e.action}</Badge>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy dark:text-white">
                        <Hash className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        {e.entityType}
                        <span className="text-slate-400 dark:text-slate-500 font-normal">·</span>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{e.entityId}</span>
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {e.actorUserId ? e.actorUserId : t('systemActor')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {shortDate(e.createdAt)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}