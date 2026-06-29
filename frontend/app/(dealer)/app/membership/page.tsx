'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Crown,
  Users,
  User as UserIcon,
  Percent,
  Zap,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  Check,
  Sparkles,
  Wallet,
  CircleCheck,
  Info,
  Loader2,
  Tag,
  Headset,
  MessageSquare,
  Network,
  GraduationCap,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/* ── Tipler (backend memberships.module.ts ile birebir) ───────────── */
type Role = 'USER' | 'TEAM_MEMBER' | 'TEAM_LEADER' | 'ADMIN' | 'PRODUCTION';

type Membership = {
  id: string;
  userId: string;
  tier: Role;
  monthlyFee: number | string;
  leaderId: string | null;
  renewalDate: string | null;
  active: boolean;
} | null;

type TierDef = { name: string; minLoad: number; discountRate: number; priority: boolean };
type TierResp = { cumulativeLoad: number; tier: TierDef; allTiers: TierDef[] };
type Leader = { id: string; fullName: string };

const MEMBERSHIP_FEE = 30; // $/ay — backend common/pricing.util.ts

export default function MembershipPage() {
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [leaderId, setLeaderId] = useState<string>('');
  const [confirmChecked, setConfirmChecked] = useState(false);

  const meQ = useQuery({
    queryKey: ['memberships', 'me'],
    queryFn: () => api<Membership>('/memberships/me'),
  });
  const tierQ = useQuery({
    queryKey: ['memberships', 'tier'],
    queryFn: () => api<TierResp>('/memberships/tier'),
  });
  const leadersQ = useQuery({
    queryKey: ['memberships', 'leaders'],
    queryFn: () => api<Leader[]>('/memberships/leaders'),
    enabled: upgradeOpen,
  });

  const upgrade = useMutation({
    mutationFn: () =>
      api('/memberships/upgrade', {
        method: 'POST',
        json: { tier: 'TEAM_MEMBER', leaderId },
      }),
    onSuccess: () => {
      toast.success(tr ? 'Ekip Üyeliğine yükseltildiniz' : 'Upgraded to Team Member');
      setUpgradeOpen(false);
      setLeaderId('');
      setConfirmChecked(false);
      qc.invalidateQueries({ queryKey: ['memberships'] });
      qc.invalidateQueries({ queryKey: ['credits'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : tr ? 'Yükseltme başarısız' : 'Upgrade failed');
    },
  });

  /* ── Mevcut rol / plan ───────────────────────────────────────────── */
  const role: Role = meQ.data?.tier ?? 'USER';
  const planMeta = PLAN_META(tr)[role] ?? PLAN_META(tr).USER;
  const isUser = role === 'USER';
  const isMember = role === 'TEAM_MEMBER';
  const isLeader = role === 'TEAM_LEADER';

  /* ── Kademe ilerleme hesabı ──────────────────────────────────────── */
  const tierData = tierQ.data;
  const sortedTiers = useMemo(
    () => [...(tierData?.allTiers ?? [])].sort((a, b) => a.minLoad - b.minLoad),
    [tierData],
  );
  const cumulative = tierData?.cumulativeLoad ?? 0;
  const currentTierName = tierData?.tier?.name;
  const currentIdx = sortedTiers.findIndex((t) => t.name === currentTierName);
  const nextTier =
    currentIdx >= 0 && currentIdx < sortedTiers.length - 1
      ? sortedTiers[currentIdx + 1]
      : undefined;

  const curMin = currentIdx >= 0 ? sortedTiers[currentIdx].minLoad : 0;
  const span = nextTier ? nextTier.minLoad - curMin : 0;
  const progressPct = nextTier
    ? Math.min(100, Math.max(0, ((cumulative - curMin) / Math.max(span, 1)) * 100))
    : 100;
  const remaining = nextTier ? Math.max(0, nextTier.minLoad - cumulative) : 0;

  const loading = meQ.isLoading || tierQ.isLoading;

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy dark:text-white">
            {tr ? 'Üyelik & Plan' : 'Membership & Plan'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {tr
              ? 'Planınızı, kademe indirimlerinizi ve ekip avantajlarınızı yönetin.'
              : 'Manage your plan, tier discounts and team benefits.'}
          </p>
        </div>
        {isUser && (
          <Button
            onClick={() => setUpgradeOpen(true)}
            className="h-11 px-5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20"
          >
            <ArrowUpRight className="h-4 w-4" />
            {tr ? "Ekip Üyesi'ne yükselt" : 'Upgrade to Team Member'}
          </Button>
        )}
      </div>

      {loading ? (
        <MembershipSkeleton />
      ) : (
        <>
          {/* ── Üst grid: mevcut plan + kademe ilerleme ──────────────── */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Mevcut plan kartı */}
            <div
              className={`relative overflow-hidden rounded-3xl border p-6 lg:col-span-1 ${planMeta.cardClass}`}
            >
              <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  <Sparkles className="h-3.5 w-3.5" />
                  {tr ? 'Mevcut Plan' : 'Current Plan'}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <planMeta.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xl font-semibold leading-tight">{planMeta.title}</div>
                    <div className="text-xs opacity-80">{planMeta.tagline}</div>
                  </div>
                </div>

                <dl className="mt-5 space-y-2.5 text-sm">
                  <PlanRow
                    label={tr ? 'Fiyat çarpanı' : 'Price multiplier'}
                    value={planMeta.multiplier}
                  />
                  <PlanRow
                    label={tr ? 'Aylık aidat' : 'Monthly fee'}
                    value={
                      isMember
                        ? money(Number(meQ.data?.monthlyFee ?? MEMBERSHIP_FEE))
                        : tr
                          ? 'Ücretsiz'
                          : 'Free'
                    }
                  />
                  {isMember && meQ.data?.renewalDate && (
                    <PlanRow
                      label={tr ? 'Yenileme' : 'Renewal'}
                      value={new Date(meQ.data.renewalDate).toLocaleDateString(
                        tr ? 'tr-TR' : 'en-US',
                      )}
                    />
                  )}
                  <PlanRow
                    label={tr ? 'Öncelikli üretim' : 'Priority production'}
                    value={
                      tierData?.tier?.priority || isLeader ? (
                        <span className="inline-flex items-center gap-1">
                          <CircleCheck className="h-3.5 w-3.5" /> {tr ? 'Aktif' : 'Active'}
                        </span>
                      ) : (
                        <span className="opacity-70">{tr ? 'Pasif' : 'Inactive'}</span>
                      )
                    }
                  />
                </dl>

                {isUser && (
                  <button
                    onClick={() => setUpgradeOpen(true)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/20 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/30"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    {tr ? 'Hemen yükselt' : 'Upgrade now'}
                  </button>
                )}
                {isMember && (
                  <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2.5 text-xs">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    {tr
                      ? 'Aktif ekip üyeliği — 1× fiyatlandırma uygulanıyor.'
                      : 'Active team membership — 1× pricing applied.'}
                  </div>
                )}
              </div>
            </div>

            {/* Kademe ilerleme kartı */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold text-navy dark:text-white">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {tr ? 'İndirim Kademesi' : 'Discount Tier'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {tr
                      ? 'Kümülatif bakiye yüklemenize göre artan indirim.'
                      : 'Discount grows with your cumulative balance loads.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 dark:bg-blue-500/10">
                  <Percent className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    %{Math.round((tierData?.tier?.discountRate ?? 0) * 100)}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {tierData?.tier?.name}
                  </span>
                </div>
              </div>

              {/* kümülatif + ilerleme çubuğu */}
              <div className="mt-5">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {tr ? 'Kümülatif yükleme' : 'Cumulative load'}
                    </div>
                    <div className="text-xl font-semibold text-navy dark:text-white">
                      {money(cumulative)}
                    </div>
                  </div>
                  {nextTier ? (
                    <div className="text-right">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {tr ? 'Sonraki kademeye' : 'To next tier'}
                      </div>
                      <div className="text-sm font-semibold text-primary">
                        {money(remaining)}{' '}
                        <span className="font-medium text-slate-400">→ {nextTier.name}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <Crown className="h-3.5 w-3.5" />
                      {tr ? 'En yüksek kademe' : 'Top tier'}
                    </div>
                  )}
                </div>

                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* kademe rozetleri */}
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {sortedTiers.map((t) => {
                  const reached = cumulative >= t.minLoad;
                  const isCurrent = t.name === currentTierName;
                  return (
                    <div
                      key={t.name}
                      className={`rounded-2xl border p-4 transition ${
                        isCurrent
                          ? 'border-primary bg-blue-50/60 ring-1 ring-primary/30 dark:border-primary dark:bg-blue-500/10'
                          : reached
                            ? 'border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-500/5'
                            : 'border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-navy dark:text-white">
                          {t.name}
                        </span>
                        {reached && (
                          <CircleCheck
                            className={`h-4 w-4 ${
                              isCurrent ? 'text-primary' : 'text-emerald-500'
                            }`}
                          />
                        )}
                      </div>
                      <div className="mt-1.5 text-xl font-semibold text-navy dark:text-white">
                        %{Math.round(t.discountRate * 100)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {t.minLoad <= 0
                          ? tr
                            ? 'Başlangıç'
                            : 'Starter'
                          : `${tr ? 'min.' : 'min'} ${money(t.minLoad)}`}
                      </div>
                      {t.priority && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                          <Zap className="h-3 w-3" />
                          {tr ? 'Öncelik' : 'Priority'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Avantajlar ──────────────────────────────────────────── */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 font-semibold text-navy dark:text-white">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {isUser
                ? tr
                  ? 'Ekip Üyeliği avantajları'
                  : 'Team Membership benefits'
                : tr
                  ? 'Üyelik avantajlarınız'
                  : 'Your membership benefits'}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS(tr).map((b) => (
                <div
                  key={b.title}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary dark:bg-blue-500/10">
                    <b.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-navy dark:text-white">{b.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {isUser && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-primary to-blue-500 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5" />
                  <div className="text-sm">
                    {tr
                      ? `Aylık sadece ${money(MEMBERSHIP_FEE)} aidatla 2× fiyattan 1×'e geçin.`
                      : `Switch from 2× to 1× pricing for just ${money(MEMBERSHIP_FEE)}/mo.`}
                  </div>
                </div>
                <Button
                  onClick={() => setUpgradeOpen(true)}
                  className="h-10 rounded-xl bg-white px-5 font-semibold text-primary hover:bg-white/90"
                >
                  {tr ? 'Yükselt' : 'Upgrade'}
                </Button>
              </div>
            )}
          </div>

          {/* ── Ekip Üyesi Ayrıcalıkları ($30/ay iş modeli) ──────────── */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-navy dark:text-white">
                  <Crown className="h-4 w-4 text-primary" />
                  {tr ? 'Ekip Üyesi Ayrıcalıkları' : 'Team Member Benefits'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {tr
                    ? `Aylık ${money(MEMBERSHIP_FEE)} Ekip Üyeliğinin size sağladığı tüm ayrıcalıklar.`
                    : `Everything your ${money(MEMBERSHIP_FEE)}/mo Team Membership unlocks.`}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-primary dark:bg-blue-500/10">
                <Sparkles className="h-3.5 w-3.5" />
                {money(MEMBERSHIP_FEE)}
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {tr ? '/ ay' : '/ mo'}
                </span>
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PERKS(tr).map((p) => {
                const card = (
                  <div className="group flex h-full flex-col rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-primary/30 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-primary/40 dark:hover:bg-blue-500/5">
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-primary dark:bg-blue-500/10">
                        <p.icon className="h-4 w-4" />
                      </div>
                      {p.href && (
                        <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-primary dark:text-slate-600" />
                      )}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-navy dark:text-white">
                      {p.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {p.desc}
                    </div>
                  </div>
                );
                return p.href ? (
                  <Link key={p.title} href={p.href} className="block h-full">
                    {card}
                  </Link>
                ) : (
                  <div key={p.title} className="h-full">
                    {card}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Yükseltme dialog'u ───────────────────────────────────────── */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-navy dark:text-white">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              {tr ? "Ekip Üyesi'ne yükselt" : 'Upgrade to Team Member'}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {tr
                ? 'Bir ekip lideri seçin ve aylık aidatı onaylayın.'
                : 'Select a team leader and confirm the monthly fee.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lider seçimi */}
            <div>
              <Label htmlFor="leader" className="text-navy dark:text-slate-200">
                {tr ? 'Ekip lideri' : 'Team leader'}
              </Label>
              {leadersQ.isLoading ? (
                <div className="mt-1.5 h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ) : (leadersQ.data?.length ?? 0) === 0 ? (
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-400">
                  <Info className="h-4 w-4 shrink-0" />
                  {tr
                    ? 'Şu an seçilebilir ekip lideri yok. Lütfen destek ile iletişime geçin.'
                    : 'No team leaders available. Please contact support.'}
                </div>
              ) : (
                <Select value={leaderId} onValueChange={(v) => setLeaderId(String(v ?? ''))}>
                  <SelectTrigger id="leader" className="mt-1.5 w-full">
                    <SelectValue placeholder={tr ? 'Lider seçin' : 'Select a leader'} />
                  </SelectTrigger>
                  <SelectContent>
                    {leadersQ.data!.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Aidat bilgisi */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {tr ? 'Aylık aidat' : 'Monthly fee'}
                </span>
                <span className="text-lg font-semibold text-navy dark:text-white">
                  {money(MEMBERSHIP_FEE)}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                {tr
                  ? 'Aidat bakiyenizden tahsil edilir ve fiyatlandırmanız 1×’e düşer. Bakiye yetersizse önce yükleme yapın.'
                  : 'The fee is charged from your balance and pricing drops to 1×. Top up first if your balance is low.'}
              </p>
              <Link
                href="/app/credits"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Wallet className="h-3.5 w-3.5" />
                {tr ? 'Bakiye yükle' : 'Top up balance'}
              </Link>
            </div>

            {/* Onay kutusu */}
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary accent-[var(--color-primary,#2563eb)]"
              />
              <span>
                {tr
                  ? `Aylık ${money(MEMBERSHIP_FEE)} aidatı ve ekip lideri atamasını kabul ediyorum.`
                  : `I accept the ${money(MEMBERSHIP_FEE)} monthly fee and the team leader assignment.`}
              </span>
            </label>
          </div>

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setUpgradeOpen(false)}
              disabled={upgrade.isPending}
            >
              {tr ? 'Vazgeç' : 'Cancel'}
            </Button>
            <Button
              onClick={() => upgrade.mutate()}
              disabled={upgrade.isPending || !leaderId || !confirmChecked}
              className="bg-primary text-white hover:bg-primary-hover"
            >
              {upgrade.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {tr ? 'Onayla ve yükselt' : 'Confirm & upgrade'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Yardımcı parçalar ──────────────────────────────────────────────── */
function PlanRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="opacity-80">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function MembershipSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800 lg:col-span-1" />
        <div className="h-72 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800 lg:col-span-2" />
      </div>
      <div className="h-44 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

/* ── Plan meta (rol bazlı) ──────────────────────────────────────────── */
function PLAN_META(tr: boolean): Record<Role, {
  title: string;
  tagline: string;
  multiplier: string;
  icon: typeof UserIcon;
  cardClass: string;
}> {
  return {
    USER: {
      title: tr ? 'Kullanıcı' : 'User',
      tagline: tr ? 'Ücretsiz · 2× fiyat' : 'Free · 2× pricing',
      multiplier: '2×',
      icon: UserIcon,
      cardClass:
        'border-slate-700 bg-gradient-to-br from-slate-700 to-slate-900 text-white dark:border-slate-700',
    },
    TEAM_MEMBER: {
      title: tr ? 'Ekip Üyesi' : 'Team Member',
      tagline: tr ? `$30/ay · 1× fiyat` : '$30/mo · 1× pricing',
      multiplier: '1×',
      icon: Users,
      cardClass:
        'border-blue-500 bg-gradient-to-br from-primary to-blue-600 text-white dark:border-blue-500',
    },
    TEAM_LEADER: {
      title: tr ? 'Ekip Lideri' : 'Team Leader',
      tagline: tr ? 'Aidatsız · 1× fiyat' : 'No fee · 1× pricing',
      multiplier: '1×',
      icon: Crown,
      cardClass:
        'border-amber-400 bg-gradient-to-br from-amber-500 to-orange-600 text-white dark:border-amber-500',
    },
    ADMIN: {
      title: 'Admin',
      tagline: tr ? 'Yönetici' : 'Administrator',
      multiplier: '—',
      icon: ShieldCheck,
      cardClass: 'border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950 text-white',
    },
    PRODUCTION: {
      title: tr ? 'Üretim' : 'Production',
      tagline: tr ? 'Üretim ekibi' : 'Production team',
      multiplier: '—',
      icon: ShieldCheck,
      cardClass: 'border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950 text-white',
    },
  };
}

/* ── Avantaj listesi ────────────────────────────────────────────────── */
function BENEFITS(tr: boolean) {
  return [
    {
      icon: Percent,
      title: tr ? '1× fiyatlandırma' : '1× pricing',
      desc: tr
        ? '2× yerine standart fiyatlardan sipariş verin, baştan %50 tasarruf.'
        : 'Order at standard prices instead of 2×, saving up to 50% upfront.',
    },
    {
      icon: TrendingUp,
      title: tr ? 'Bakiye indirimi' : 'Balance discount',
      desc: tr
        ? 'Bakiyene $100/$200/$300 yükle → %20/%30/%40 indirim (bakiye bitince biter).'
        : 'Load $100/$200/$300 → 20%/30%/40% off (ends when balance is used up).',
    },
    {
      icon: Zap,
      title: tr ? 'Öncelikli üretim' : 'Priority production',
      desc: tr
        ? 'Üst kademelerde siparişleriniz üretim sırasında öne alınır.'
        : 'On higher tiers your orders are bumped up in the production queue.',
    },
    {
      icon: Users,
      title: tr ? 'Ekip lideri desteği' : 'Team leader support',
      desc: tr
        ? 'Bir ekip liderine bağlanın; rehberlik ve hızlı destek alın.'
        : 'Get assigned a team leader for guidance and faster support.',
    },
    {
      icon: ShieldCheck,
      title: tr ? 'Aidat bakiyeden' : 'Fee from balance',
      desc: tr
        ? 'Aylık aidat otomatik olarak bakiyenizden tahsil edilir, kart gerekmez.'
        : 'The monthly fee is auto-charged from your balance — no card needed.',
    },
    {
      icon: Sparkles,
      title: tr ? 'Esnek yükseltme' : 'Flexible upgrade',
      desc: tr
        ? 'Tek tıkla ekip üyeliğine geçin; planınızı istediğiniz zaman görün.'
        : 'Upgrade to team membership in one click and track your plan anytime.',
    },
  ];
}

/* ── Ekip Üyesi ayrıcalıkları ($30/ay iş modeli) ────────────────────── */
function PERKS(tr: boolean): { icon: LucideIcon; title: string; desc: string; href?: string }[] {
  return [
    {
      icon: Tag,
      title: tr ? "%50'ye varan indirim" : 'Up to 50% off',
      desc: tr ? 'Tüm ürünlerde avantaj' : 'Advantage across all products',
    },
    {
      icon: Headset,
      title: tr ? 'Ücretsiz Destek Ekibi' : 'Free Support Team',
      desc: tr ? 'Öncelikli, ücretsiz destek' : 'Priority, no-cost support',
    },
    {
      icon: MessageSquare,
      title: tr ? 'Danışmanlık' : 'Consulting',
      desc: tr ? 'Uzmanlarla birebir görüşme' : 'One-on-one with experts',
      href: '/app/consulting',
    },
    {
      icon: Network,
      title: tr ? 'Networking' : 'Networking',
      desc: tr ? 'Güçlü iş ağına erişim' : 'Access to a strong network',
      href: '/app/network',
    },
    {
      icon: GraduationCap,
      title: tr ? 'Eğitim' : 'Education',
      desc: tr ? '%50 indirimli eğitimler' : 'Trainings at 50% off',
      href: '/app/education',
    },
    {
      icon: CalendarDays,
      title: tr ? 'Etkinlikler' : 'Events',
      desc: tr ? '%50 indirimli etkinlikler' : 'Events at 50% off',
      href: '/app/events',
    },
  ];
}
