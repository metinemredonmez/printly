'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Wallet, BadgeCheck, Percent, ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Me = { balance: number; hasDiscount40: boolean };
type Tier = { cumulativeLoad: number; tier: { name: string } };
type LedgerEntry = {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
};
type TopupResponse = { status: 'PENDING'; message: string };

export default function CreditsPage() {
  const t = useTranslations('credits');
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');

  const meQ = useQuery({
    queryKey: ['credits', 'me'],
    queryFn: () => api<Me>('/credits/me'),
  });
  const tierQ = useQuery({
    queryKey: ['memberships', 'tier'],
    queryFn: () => api<Tier>('/memberships/tier'),
  });
  const ledgerQ = useQuery({
    queryKey: ['credits', 'me', 'ledger'],
    queryFn: () => api<LedgerEntry[]>('/credits/me/ledger'),
  });

  const topup = useMutation({
    mutationFn: (value: number) =>
      api<TopupResponse>('/credits/me/topup', { method: 'POST', json: { amount: value } }),
    onSuccess: (res) => {
      toast.success(res.message || t('topupPending'));
      setAmount('');
      qc.invalidateQueries({ queryKey: ['credits'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('topupError'));
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t('invalidAmount'));
      return;
    }
    topup.mutate(value);
  }

  const me = meQ.data;
  const tier = tierQ.data;
  const ledger = ledgerQ.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">{t('title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t('balanceLabel')}
          value={meQ.isLoading ? '…' : money(me?.balance)}
          icon={Wallet}
          accent="primary"
          sub={t('balanceSub')}
        />
        <StatCard
          label={t('tierLabel')}
          value={tierQ.isLoading ? '…' : tier?.tier?.name ?? '—'}
          icon={BadgeCheck}
          accent="navy"
          sub={tierQ.isLoading ? undefined : t('cumulativeSub', { amount: money(tier?.cumulativeLoad) })}
        />
        <StatCard
          label={t('discountLabel')}
          value={meQ.isLoading ? '…' : me?.hasDiscount40 ? t('active') : t('inactive')}
          icon={Percent}
          accent={me?.hasDiscount40 ? 'emerald' : 'amber'}
          sub={t('discountSub')}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-base font-bold text-navy">{t('topupTitle')}</h2>
        <p className="text-xs text-slate-500 mt-1">{t('topupHint')}</p>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="amount">{t('amountLabel')}</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('amountPlaceholder')}
              className="mt-1.5 bg-white"
            />
          </div>
          <Button
            type="submit"
            disabled={topup.isPending}
            className="bg-primary hover:bg-primary-hover text-white font-semibold h-11 px-6 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            {topup.isPending ? t('submitting') : t('topupSubmit')}
          </Button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-navy">{t('ledgerTitle')}</h2>
        </div>
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400">
          <div className="col-span-5">{t('reason')}</div>
          <div className="col-span-3">{t('date')}</div>
          <div className="col-span-2 text-right">{t('delta')}</div>
          <div className="col-span-2 text-right">{t('balanceAfter')}</div>
        </div>
        {ledgerQ.isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">…</div>
        ) : ledger.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">{t('ledgerEmpty')}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {ledger.map((row) => {
              const positive = row.delta >= 0;
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-3.5 items-center"
                >
                  <div className="md:col-span-5 flex items-center gap-2">
                    {positive ? (
                      <ArrowUpCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-navy truncate">{row.reason}</span>
                  </div>
                  <div className="md:col-span-3 text-sm text-slate-500">{shortDate(row.createdAt)}</div>
                  <div
                    className={`md:col-span-2 text-right font-bold text-sm ${
                      positive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {positive ? '+' : '−'}
                    {money(Math.abs(row.delta))}
                  </div>
                  <div className="md:col-span-2 text-right text-sm font-semibold text-slate-600">
                    {money(row.balanceAfter)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}