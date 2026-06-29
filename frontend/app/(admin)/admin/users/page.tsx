'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { Search, Users, ShieldCheck, UserCheck, CheckCircle2, XCircle, UserPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { StatCard } from '@/components/stat-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/skeletons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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
  USER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  TEAM_MEMBER: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
  TEAM_LEADER: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
  ADMIN: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  PRODUCTION: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
};

export default function AdminUsersPage() {
  const t = useTranslations('adminUsers');
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);

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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="h-9 rounded-xl">
          <UserPlus className="h-4 w-4" />
          {tr ? '+ Personel Ekle' : '+ Add Staff'}
        </Button>
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
          className="pl-9 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
          <div className="col-span-4">{t('colEmail')}</div>
          <div className="col-span-3">{t('colName')}</div>
          <div className="col-span-3">{t('colRole')}</div>
          <div className="col-span-2 text-right">{t('colStatus')}</div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 dark:text-slate-500 text-sm">{t('empty')}</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="md:col-span-4 min-w-0">
                  <Link href={`/admin/users/${u.id}`} className="block font-semibold text-navy dark:text-white text-sm truncate hover:text-primary hover:underline">{u.email}</Link>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">{shortDate(u.createdAt)}</div>
                </div>

                <div className="md:col-span-3 text-sm text-slate-600 dark:text-slate-300 truncate">
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
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200"
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
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20'
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

      <AddStaffDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tr={tr}
        onCreated={() => qc.invalidateQueries({ queryKey: ['admin', 'users'] })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add Staff dialog                                                     */
/* ------------------------------------------------------------------ */

interface StaffForm {
  email: string;
  fullName: string;
  password: string;
  role: Role;
}

const EMPTY_STAFF: StaffForm = {
  email: '',
  fullName: '',
  password: '',
  role: 'USER',
};

function AddStaffDialog({
  open,
  onOpenChange,
  tr,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tr: boolean;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<StaffForm>(EMPTY_STAFF);

  useEffect(() => {
    if (open) setForm(EMPTY_STAFF);
  }, [open]);

  const set = <K extends keyof StaffForm>(key: K, value: StaffForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      api('/admin/users', {
        method: 'POST',
        json: {
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim() || undefined,
          role: form.role,
        },
      }),
    onSuccess: () => {
      onCreated();
      toast.success(tr ? 'Personel eklendi' : 'Staff member added');
      onOpenChange(false);
      setForm(EMPTY_STAFF);
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError ? e.message : tr ? 'İşlem başarısız' : 'Operation failed',
      ),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!email) {
      toast.error(tr ? 'E-posta zorunludur' : 'Email is required');
      return;
    }
    if (form.password.length < 8) {
      toast.error(
        tr ? 'Şifre en az 8 karakter olmalı' : 'Password must be at least 8 characters',
      );
      return;
    }
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-navy dark:text-white">
            {tr ? 'Personel Ekle' : 'Add Staff'}
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            {tr
              ? 'Yeni bir kullanıcı veya ekip üyesi oluşturun. Yıldızlı alanlar zorunludur.'
              : 'Create a new user or team member. Fields marked with * are required.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Field label={tr ? 'E-posta' : 'Email'} required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="kisi@firma.com"
              autoComplete="off"
              className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </Field>

          <Field label={tr ? 'Ad Soyad' : 'Full Name'}>
            <Input
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              placeholder={tr ? 'Adı ve soyadı' : 'First and last name'}
              className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </Field>

          <Field label={tr ? 'Şifre' : 'Password'} required>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={tr ? 'En az 8 karakter' : 'At least 8 characters'}
              autoComplete="new-password"
              className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </Field>

          <Field label={tr ? 'Rol' : 'Role'} required>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value as Role)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL(r, tr)}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {tr ? 'Vazgeç' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={create.isPending} className="h-9 rounded-xl">
              {create.isPending ? (tr ? 'Ekleniyor…' : 'Adding…') : tr ? 'Ekle' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function ROLE_LABEL(r: Role, tr: boolean) {
  const map: Record<Role, [string, string]> = {
    USER: ['Kullanıcı', 'User'],
    TEAM_MEMBER: ['Ekip Üyesi', 'Team Member'],
    TEAM_LEADER: ['Ekip Lideri', 'Team Leader'],
    ADMIN: ['Yönetici', 'Admin'],
    PRODUCTION: ['Üretim', 'Production'],
  };
  const [trLabel, enLabel] = map[r];
  return tr ? trLabel : enLabel;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
