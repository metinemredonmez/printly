'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { User, Mail, ShieldCheck, IdCard, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { TwoFactor } from '@/components/profile/two-factor';

interface Me {
  userId: string;
  email: string;
  fullName?: string | null;
  role: string;
  organizationId: string | null;
}

export default function AdminProfilePage() {
  const tr = useLocale() === 'tr';

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/auth/me'),
  });

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-navy dark:text-white">
          {tr ? 'Profil' : 'Profile'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {tr
            ? 'Hesap bilgilerin ve güvenlik ayarların.'
            : 'Your account information and security settings.'}
        </p>
      </div>

      {/* Account info (read-only) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-primary dark:text-blue-300 flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
          <div className="font-semibold text-navy dark:text-white">
            {tr ? 'Hesap Bilgileri' : 'Account Information'}
          </div>
        </div>

        {me.isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-5 w-40 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        ) : me.isError ? (
          <div className="py-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
            </div>
            <p className="font-semibold text-navy dark:text-white">
              {me.error instanceof Error
                ? me.error.message
                : tr
                  ? 'Profil yüklenemedi'
                  : 'Failed to load profile'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              icon={User}
              label={tr ? 'Ad Soyad' : 'Full Name'}
              value={me.data?.fullName || (tr ? 'Belirtilmemiş' : 'Not set')}
              muted={!me.data?.fullName}
            />
            <Field
              icon={Mail}
              label={tr ? 'E-posta' : 'Email'}
              value={me.data?.email ?? '—'}
            />
            <Field
              icon={ShieldCheck}
              label={tr ? 'Rol' : 'Role'}
              value={
                <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium font-mono">
                  {me.data?.role ?? '—'}
                </span>
              }
            />
            <Field
              icon={IdCard}
              label={tr ? 'Kullanıcı No' : 'User ID'}
              value={
                <span className="font-mono text-[13px] break-all">
                  {me.data?.userId ?? '—'}
                </span>
              }
            />
          </div>
        )}

        <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-4">
          {tr
            ? 'Yönetici hesabının rolü bu ekrandan değiştirilemez.'
            : 'Your admin role cannot be changed from this screen.'}
        </p>
      </div>

      {/* 2FA security */}
      <TwoFactor />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function Field({
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  icon: typeof User;
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div
        className={
          muted
            ? 'text-sm text-slate-400 dark:text-slate-500'
            : 'font-medium text-navy dark:text-white break-all'
        }
      >
        {value}
      </div>
    </div>
  );
}
