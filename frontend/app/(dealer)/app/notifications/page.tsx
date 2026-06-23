'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Bell,
  BellRing,
  CheckCheck,
  Check,
  Mail,
  Smartphone,
  Package,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type Prefs = {
  email: boolean;
  push: boolean;
  orderUpdates: boolean;
  marketing: boolean;
};

type PrefKey = keyof Prefs;

const PREF_META: { key: PrefKey; icon: LucideIcon; accent: string }[] = [
  { key: 'email', icon: Mail, accent: 'primary' },
  { key: 'push', icon: Smartphone, accent: 'navy' },
  { key: 'orderUpdates', icon: Package, accent: 'emerald' },
  { key: 'marketing', icon: Megaphone, accent: 'amber' },
];

export default function NotificationsPage() {
  const t = useTranslations('notifs');
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ['notifications', 'center'],
    queryFn: () => api<Notif[]>('/notifications/center'),
  });
  const prefsQ = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => api<Prefs>('/notifications/preferences'),
  });

  const readOne = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/center/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'center'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('error'));
    },
  });

  const readAll = useMutation({
    mutationFn: () => api('/notifications/center/read-all', { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('allReadDone'));
      qc.invalidateQueries({ queryKey: ['notifications', 'center'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('error'));
    },
  });

  const updatePrefs = useMutation({
    mutationFn: (patch: Partial<Prefs>) =>
      api<Prefs>('/notifications/preferences', { method: 'PATCH', json: patch }),
    onSuccess: () => {
      toast.success(t('prefsSaved'));
      qc.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('error'));
    },
  });

  const list = listQ.data ?? [];
  const unread = list.filter((n) => !n.readAt).length;
  const prefs = prefsQ.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => readAll.mutate()}
          disabled={readAll.isPending || unread === 0}
          className="bg-navy hover:bg-navy/90 text-white font-semibold h-11 px-5 rounded-xl disabled:opacity-50"
        >
          <CheckCheck className="h-4 w-4" />
          {readAll.isPending ? t('submitting') : t('readAll')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t('totalLabel')}
          value={listQ.isLoading ? '…' : list.length}
          icon={Bell}
          accent="navy"
        />
        <StatCard
          label={t('unreadLabel')}
          value={listQ.isLoading ? '…' : unread}
          icon={BellRing}
          accent={unread > 0 ? 'rose' : 'emerald'}
          sub={!listQ.isLoading && unread === 0 ? t('allCaughtUp') : undefined}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-navy">{t('listTitle')}</h2>
        </div>
        {listQ.isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">…</div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-400 mt-3">{t('listEmpty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {list.map((n) => {
              const isUnread = !n.readAt;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 ${
                    isUnread ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div
                    className={`mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isUnread ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isUnread ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-navy">{n.title}</span>
                      {isUnread && (
                        <Badge className="bg-primary/10 text-primary border-transparent">
                          {t('new')}
                        </Badge>
                      )}
                      <span className="text-[11px] text-slate-400 ml-auto shrink-0">
                        {shortDate(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 break-words">{n.body}</p>
                  </div>
                  {isUnread && (
                    <Button
                      variant="ghost"
                      onClick={() => readOne.mutate(n.id)}
                      disabled={readOne.isPending}
                      className="shrink-0 h-9 px-3 rounded-lg text-primary hover:bg-primary/10 text-xs font-semibold"
                    >
                      <Check className="h-4 w-4" />
                      {t('markRead')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-base font-bold text-navy">{t('prefsTitle')}</h2>
        <p className="text-xs text-slate-500 mt-1">{t('prefsHint')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PREF_META.map(({ key, icon: Icon, accent }) => {
            const on = prefs ? prefs[key] : false;
            const accentClass: Record<string, string> = {
              primary: 'bg-blue-50 text-primary',
              navy: 'bg-slate-100 text-navy',
              emerald: 'bg-emerald-50 text-emerald-600',
              amber: 'bg-amber-50 text-amber-600',
            };
            return (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-4"
              >
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    accentClass[accent] ?? accentClass.primary
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-navy">{t(`pref_${key}`)}</div>
                  <div className="text-[11px] text-slate-400">{t(`pref_${key}_desc`)}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t(`pref_${key}`)}
                  disabled={prefsQ.isLoading || updatePrefs.isPending}
                  onClick={() => updatePrefs.mutate({ [key]: !on } as Partial<Prefs>)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    on ? 'bg-primary' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      on ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}