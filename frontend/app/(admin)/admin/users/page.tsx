'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { Search, Users, ShieldCheck, UserCheck, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { StatCard } from '@/components/stat-card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/skeletons';

type Role = 'USER' | 'TEAM_MEMBER' | 'TEAM_LEADER' | 'ADMIN' | 'PRODUCTION';

type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
};

const ROLES: Role[] = ['USER', 'TEAM_MEMBER', 'TEAM_LEADER', 'ADMIN', 'PRODUCTION'];

const ROLE_BADGE: Record<Role, string> = {
  USER: 'bg-slate-100 text-slate-600',
  TEAM_MEMBER: 'bg-blue-50 text-primary',
  TEAM_LEADER: 'bg-indigo-50 text-indigo-600',
  ADMIN: 'bg-amber-50 text-amber-600',
  PRODUCTION: 'bg-emerald-50 text-emerald-600',
};

export default function AdminUsersPage() {
  const t = useTranslations('adminUsers');
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api<AdminUser[]>('/admin/users'),
  });

  const setRole = useMutation({
    mutationFn: (vars: { id: string; role: Role }) =>
      api(`/admin/users/${vars.id}/role`, { method: 'PATCH', json: { role: vars.role } }),
    onSuccess: () => {
      toast.success(t('roleChanged'));
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('error')),
  });

  const setActive = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      api(`/admin/users/${vars.id}/active`, { method: 'PATCH', json: { active: vars.active } }),
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? t('activated') : t('deactivated'));
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('error')),
  });

  const users = data ?? [];

  const rows = useMemo(() => {
    if (!q) return users;
    const s = q.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(s) ||
        (u.fullName ?? '').toLowerCase().includes(s),
    );
  }, [users, q]);

  const total = users.length;
  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-navy">{t('title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('statTotal')} value={isLoading ? '…' : total} icon={Users} accent="navy" />
        <StatCard
          label={t('statActive')}
          value={isLoading ? '…' : activeCount}
          icon={UserCheck}
          accent="emerald"
        />
        <StatCard
          label={t('statAdmins')}
          value={isLoading ? '…' : adminCount}
          icon={ShieldCheck}
          accent="amber"
        />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search')}
          className="pl-9 bg-white"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400">
          <div className="col-span-4">{t('colEmail')}</div>
          <div className="col-span-3">{t('colName')}</div>
          <div className="col-span-3">{t('colRole')}</div>
          <div className="col-span-2 text-right">{t('colStatus')}</div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">{t('empty')}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-3.5 items-center"
              >
                <div className="md:col-span-4 min-w-0">
                  <Link href={`/admin/users/${u.id}`} className="block font-semibold text-navy dark:text-white text-sm truncate hover:text-primary hover:underline">{u.email}</Link>
                  <div className="text-[11px] text-slate-400">{shortDate(u.createdAt)}</div>
                </div>

                <div className="md:col-span-3 text-sm text-slate-600 truncate">
                  {u.fullName ?? '—'}
                </div>

                <div className="md:col-span-3 flex items-center gap-2">
                  <Badge className={`${ROLE_BADGE[u.role]} border-0`}>
                    {t(`role_${u.role}`)}
                  </Badge>
                  <select
                    value={u.role}
                    disabled={setRole.isPending}
                    onChange={(e) =>
                      setRole.mutate({ id: u.id, role: e.target.value as Role })
                    }
                    aria-label={t('colRole')}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`role_${r}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 flex md:justify-end">
                  <button
                    type="button"
                    disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ id: u.id, active: !u.active })}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                      u.active
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    {u.active ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {u.active ? t('statusActive') : t('statusInactive')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
