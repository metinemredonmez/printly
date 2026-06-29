'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Receipt, Building2, Globe2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ListSkeleton } from '@/components/skeletons';

type Country = 'TR' | 'US';
type EntityType = 'individual' | 'company';

interface BillingProfile {
  country: Country;
  type: EntityType | string;
  address: string;
  // TR alanları
  tc?: string;
  taxNo?: string;
  companyTitle?: string;
  // US alanları
  ssn?: string;
  ein?: string;
  state?: string;
}

type FormState = {
  country: Country;
  type: string;
  address: string;
  tc: string;
  taxNo: string;
  companyTitle: string;
  ssn: string;
  ein: string;
  state: string;
};

const EMPTY: FormState = {
  country: 'TR',
  type: 'individual',
  address: '',
  tc: '',
  taxNo: '',
  companyTitle: '',
  ssn: '',
  ein: '',
  state: '',
};

export default function BillingPage() {
  const t = useTranslations('billing');
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  const billing = useQuery({
    queryKey: ['billing-me'],
    queryFn: () => api<BillingProfile>('/billing/me'),
  });

  useEffect(() => {
    const d = billing.data;
    if (!d) return;
    setForm({
      country: d.country === 'US' ? 'US' : 'TR',
      type: d.type ?? 'individual',
      address: d.address ?? '',
      tc: d.tc ?? '',
      taxNo: d.taxNo ?? '',
      companyTitle: d.companyTitle ?? '',
      ssn: d.ssn ?? '',
      ein: d.ein ?? '',
      state: d.state ?? '',
    });
  }, [billing.data]);

  const save = useMutation({
    mutationFn: () => {
      const base = {
        country: form.country,
        type: form.type,
        address: form.address.trim(),
      };
      const payload =
        form.country === 'TR'
          ? {
              ...base,
              tc: form.tc.trim(),
              companyTitle: form.companyTitle.trim(),
              taxNo: form.taxNo.trim(),
            }
          : {
              ...base,
              ssn: form.ssn.trim(),
              ein: form.ein.trim(),
              state: form.state.trim(),
            };
      return api<BillingProfile>('/billing/me', { method: 'PUT', json: payload });
    },
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['billing-me'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('saveFailed')),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isTR = form.country === 'TR';
  const canSubmit = form.address.trim().length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy dark:text-white">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('subtitle')}</p>
      </div>

      {billing.isLoading ? (
        <ListSkeleton rows={3} />
      ) : (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) save.mutate();
          }}
        >
          {/* Genel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-primary dark:text-blue-300 flex items-center justify-center">
                <Globe2 className="h-5 w-5" />
              </div>
              <div className="font-semibold text-navy dark:text-white">{t('general')}</div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">{t('country')}</Label>
                <Select
                  value={form.country}
                  onValueChange={(v) => set('country', (v as Country) ?? 'TR')}
                >
                  <SelectTrigger id="country" className="w-full">
                    <SelectValue placeholder={t('countryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TR">{t('countryTR')}</SelectItem>
                    <SelectItem value="US">{t('countryUS')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">{t('type')}</Label>
                <Select value={form.type} onValueChange={(v) => set('type', String(v))}>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder={t('typePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">{t('typeIndividual')}</SelectItem>
                    <SelectItem value="company">{t('typeCompany')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="address">{t('address')}</Label>
              <Input
                id="address"
                value={form.address}
                placeholder={t('addressPlaceholder')}
                onChange={(e) => set('address', e.target.value)}
              />
            </div>
          </div>

          {/* Ülkeye özel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-navy dark:text-slate-200 flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="font-semibold text-navy dark:text-white">
                  {isTR ? t('trDetails') : t('usDetails')}
                </div>
              </div>
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                {t('masked')}
              </Badge>
            </div>

            {isTR ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tc">{t('tc')}</Label>
                  <Input
                    id="tc"
                    value={form.tc}
                    inputMode="numeric"
                    placeholder={t('tcPlaceholder')}
                    onChange={(e) => set('tc', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxNo">{t('taxNo')}</Label>
                  <Input
                    id="taxNo"
                    value={form.taxNo}
                    inputMode="numeric"
                    placeholder={t('taxNoPlaceholder')}
                    onChange={(e) => set('taxNo', e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="companyTitle">{t('companyTitle')}</Label>
                  <Input
                    id="companyTitle"
                    value={form.companyTitle}
                    placeholder={t('companyTitlePlaceholder')}
                    onChange={(e) => set('companyTitle', e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ssn">{t('ssn')}</Label>
                  <Input
                    id="ssn"
                    value={form.ssn}
                    placeholder={t('ssnPlaceholder')}
                    onChange={(e) => set('ssn', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ein">{t('ein')}</Label>
                  <Input
                    id="ein"
                    value={form.ein}
                    placeholder={t('einPlaceholder')}
                    onChange={(e) => set('ein', e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="state">{t('state')}</Label>
                  <Input
                    id="state"
                    value={form.state}
                    placeholder={t('statePlaceholder')}
                    onChange={(e) => set('state', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              {t('hint')}
            </p>
            <Button type="submit" disabled={!canSubmit || save.isPending}>
              {save.isPending ? (
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
  );
}