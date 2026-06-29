'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { User, Mail, ShieldCheck, Building2, Loader2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/skeletons';
import { TwoFactor } from '@/components/profile/two-factor';

interface Me {
  userId: string;
  email: string;
  role: string;
  organizationId: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  taxInfo?: string | null;
  theme?: unknown;
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/auth/me'),
  });

  const hasOrg = !!me.data?.organizationId;

  const org = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: () => api<Organization>('/organizations/me'),
    enabled: hasOrg,
  });

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (org.data) {
      setName(org.data.name ?? '');
      setSlug(org.data.slug ?? '');
    }
  }, [org.data]);

  const update = useMutation({
    mutationFn: () =>
      api<Organization>('/organizations/me', {
        method: 'PATCH',
        json: { name: name.trim(), slug: slug.trim() },
      }),
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['organizations', 'me'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('saveFailed')),
  });

  const canSubmit =
    name.trim().length > 0 &&
    slug.trim().length > 0 &&
    (name.trim() !== org.data?.name || slug.trim() !== org.data?.slug);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy dark:text-white">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('subtitle')}</p>
      </div>

      {/* Kullanıcı bilgisi (read-only) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-xl bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300 flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
          <div className="font-semibold text-navy dark:text-white">{t('accountTitle')}</div>
        </div>

        {me.isLoading ? (
          <ListSkeleton rows={2} />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Mail className="h-3.5 w-3.5" />
                {t('email')}
              </div>
              <div className="font-semibold text-navy dark:text-white break-all">{me.data?.email ?? '—'}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('role')}
              </div>
              <div>
                <Badge variant="secondary" className="font-mono">
                  {me.data?.role ?? '—'}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2FA güvenlik */}
      <TwoFactor />

      {/* Firma profili */}
      {hasOrg && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="font-semibold text-navy dark:text-white">{t('orgTitle')}</div>
          </div>

          {org.isLoading ? (
            <ListSkeleton rows={2} />
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) update.mutate();
              }}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('orgName')}</Label>
                  <Input
                    id="name"
                    value={name}
                    placeholder={t('orgNamePlaceholder')}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">{t('orgSlug')}</Label>
                  <Input
                    id="slug"
                    value={slug}
                    placeholder={t('orgSlugPlaceholder')}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={!canSubmit || update.isPending}>
                  {update.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t('save')}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
