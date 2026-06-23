'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ScrollText, Hash, User, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { shortDate } from '@/lib/format';

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
  if (/(CREATE|ADD|INSERT)/.test(a)) return { badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
  if (/(UPDATE|EDIT|PATCH|CHANGE)/.test(a)) return { badge: 'bg-blue-50 text-primary', dot: 'bg-primary' };
  if (/(DELETE|REMOVE|CANCEL)/.test(a)) return { badge: 'bg-rose-50 text-rose-600', dot: 'bg-rose-500' };
  if (/(LOGIN|AUTH|LOGOUT)/.test(a)) return { badge: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' };
  return { badge: 'bg-slate-100 text-navy', dot: 'bg-slate-400' };
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
        <h1 className="text-2xl font-extrabold text-navy">{t('title')}</h1>
        <p className="text-slate-500">{t('subtitle')}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-navy">{t('timeline')}</h2>
          <span className="text-xs text-slate-400">
            {logs.isLoading ? '…' : t('count', { n: items.length })}
          </span>
        </div>

        {logs.isLoading ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">…</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <ScrollText className="h-10 w-10 mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-navy">{t('emptyTitle')}</p>
            <p className="text-xs text-slate-400">{t('emptyDesc')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((e) => {
              const tone = actionTone(e.action);
              return (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={tone.badge}>{e.action}</Badge>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy">
                        <Hash className="h-3.5 w-3.5 text-slate-400" />
                        {e.entityType}
                        <span className="text-slate-400 font-normal">·</span>
                        <span className="font-mono text-xs text-slate-500">{e.entityId}</span>
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
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