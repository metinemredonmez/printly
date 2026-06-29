'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Wallet,
  CalendarDays,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  KeyRound,
  Percent,
  ShoppingCart,
  Building2,
  Plus,
  Hourglass,
  Check,
  Download,
  Trash2,
  AlertTriangle,
  RefreshCw,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Role = 'USER' | 'TEAM_MEMBER' | 'TEAM_LEADER' | 'ADMIN' | 'PRODUCTION';

const ROLES: Role[] = ['USER', 'TEAM_MEMBER', 'TEAM_LEADER', 'ADMIN', 'PRODUCTION'];

interface AdminUserDetail {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
  priceMultiplier: number | string;
  balance: number | string;
  hasDiscount40: boolean;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  active: boolean;
  organizationId: string | null;
  leaderId: string | null;
  createdAt: string;
  _count?: { orders: number };
}

type TxType = 'BALANCE_LOAD' | 'ORDER_PAYMENT' | 'MEMBERSHIP_FEE' | 'REFUND';
type TxStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

interface AdminTransaction {
  id: string;
  type: TxType;
  amount: number | string;
  status: TxStatus;
  note?: string | null;
  createdAt: string;
  user?: { id: string; email: string; fullName: string | null };
}

/* ------------------------------------------------------------------ */
/* Visual maps                                                         */
/* ------------------------------------------------------------------ */

const ROLE_CHIP: Record<Role, string> = {
  USER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  TEAM_MEMBER: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
  TEAM_LEADER: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
  ADMIN: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  PRODUCTION: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
};

const STAT_ACCENT: Record<string, string> = {
  primary: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  navy: 'bg-slate-100 text-navy dark:bg-slate-800 dark:text-slate-200',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const money = (n?: number | string | null) =>
  n == null
    ? '—'
    : `$${Number(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

const fmtDate = (d: string, tr: boolean) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(tr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fmtDateTime = (d: string, tr: boolean) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(tr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const initials = (u?: AdminUserDetail | null) => {
  const base = u?.fullName?.trim() || u?.email || '?';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);
  const qc = useQueryClient();

  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => api<AdminUserDetail>(`/admin/users/${id}`),
    enabled: !!id,
  });

  // Tüm işlemler (admin) → bu kullanıcının BEKLEYEN bakiye yükleme talepleri + son hareketler.
  const { data: allTx } = useQuery({
    queryKey: ['admin', 'transactions', 'all'],
    queryFn: () => api<AdminTransaction[]>('/transactions'),
    enabled: !!id,
  });

  const userTx = useMemo(
    () => (allTx ?? []).filter((t) => t.user?.id === id),
    [allTx, id],
  );
  const pendingTopups = useMemo(
    () =>
      userTx.filter((t) => t.type === 'BALANCE_LOAD' && t.status === 'PENDING'),
    [userTx],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'users', id] });
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    qc.invalidateQueries({ queryKey: ['admin', 'transactions', 'all'] });
  };

  /* --- Mutations --- */

  const setRole = useMutation({
    mutationFn: (role: Role) =>
      api(`/admin/users/${id}/role`, { method: 'PATCH', json: { role } }),
    onSuccess: () => {
      toast.success(L.roleChanged);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.error),
  });

  const setActive = useMutation({
    mutationFn: (active: boolean) =>
      api(`/admin/users/${id}/active`, { method: 'PATCH', json: { active } }),
    onSuccess: (_d, active) => {
      toast.success(active ? L.activated : L.deactivated);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.error),
  });

  const topup = useMutation({
    mutationFn: (value: number) =>
      api(`/credits/${id}/topup`, { method: 'POST', json: { amount: value } }),
    onSuccess: () => {
      toast.success(L.topupDone);
      setTopupOpen(false);
      setAmount('');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.error),
  });

  const confirmTopup = useMutation({
    mutationFn: (transactionId: string) =>
      api(`/credits/topup/${transactionId}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(L.topupConfirmed);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.error),
  });

  const exportData = useMutation({
    mutationFn: () => api<unknown>(`/gdpr/${id}/export`),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-export-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(L.exportDone);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.error),
  });

  const anonymize = useMutation({
    mutationFn: () =>
      api(`/gdpr/${id}/delete`, { method: 'POST', json: { confirm: true } }),
    onSuccess: () => {
      toast.success(L.anonymizeDone);
      setDeleteOpen(false);
      setDeleteConfirm('');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.error),
  });

  /* --- Topup submit --- */
  const submitTopup = () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error(L.amountInvalid);
      return;
    }
    topup.mutate(value);
  };

  /* ---------------------------------------------------------------- */
  /* Loading / error states                                            */
  /* ---------------------------------------------------------------- */

  if (isLoading) return <DetailSkeleton />;

  if (isError || !user) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackLink label={L.back} />
        <div className="mt-6 bg-white rounded-3xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800 px-6 py-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-rose-500" />
          </div>
          <p className="font-semibold text-navy dark:text-white">
            {error instanceof Error ? error.message : L.notFound}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-4 rounded-xl dark:border-slate-700 dark:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {L.retry}
          </Button>
        </div>
      </div>
    );
  }

  const memberName = user.fullName?.trim() || L.noName;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <BackLink label={L.back} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {L.refresh}
        </Button>
      </div>

      {/* Identity card */}
      <div className="bg-white rounded-3xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-primary text-white flex items-center justify-center text-xl font-semibold shrink-0">
            {initials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-navy dark:text-white truncate">
                {memberName}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_CHIP[user.role]}`}
              >
                {L.roleName(user.role)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  user.active
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {user.active ? L.statusActive : L.statusInactive}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4 shrink-0" /> {user.email}
                {user.isEmailVerified && (
                  <BadgeCheck className="h-4 w-4 text-emerald-500" />
                )}
              </span>
              {user.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4 shrink-0" /> {user.phone}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0" />{' '}
                {L.memberSince} {fmtDate(user.createdAt, tr)}
              </span>
            </div>
          </div>
          <Button
            onClick={() => setTopupOpen(true)}
            className="h-10 rounded-xl shrink-0 self-start sm:self-center"
          >
            <Plus className="h-4 w-4" />
            {L.topupCta}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={L.balance}
          value={money(user.balance)}
          icon={Wallet}
          accent="primary"
          sub={user.hasDiscount40 ? L.discountActive : undefined}
        />
        <StatCard
          label={L.orders}
          value={user._count?.orders ?? 0}
          icon={ShoppingCart}
          accent="navy"
        />
        <StatCard
          label={L.priceMultiplier}
          value={`${Number(user.priceMultiplier)}×`}
          icon={Percent}
          accent="amber"
        />
        <StatCard
          label={L.twoFactor}
          value={user.twoFactorEnabled ? L.on : L.off}
          icon={KeyRound}
          accent={user.twoFactorEnabled ? 'emerald' : 'navy'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account controls */}
          <Card title={L.accountControls} icon={Shield}>
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Role */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {L.role}
                </Label>
                <select
                  value={user.role}
                  disabled={setRole.isPending}
                  onChange={(e) => setRole.mutate(e.target.value as Role)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-navy outline-none transition focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 disabled:opacity-50 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {L.roleName(r)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {L.roleHint}
                </p>
              </div>

              {/* Active toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {L.accountStatus}
                </Label>
                <button
                  type="button"
                  disabled={setActive.isPending}
                  onClick={() => setActive.mutate(!user.active)}
                  className={`h-10 w-full inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                    user.active
                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
                  }`}
                >
                  {user.active ? (
                    <>
                      <XCircle className="h-4 w-4" /> {L.deactivate}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> {L.activate}
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {user.active ? L.deactivateHint : L.activateHint}
                </p>
              </div>
            </div>

            {/* Meta chips */}
            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              <MetaChip
                icon={user.isEmailVerified ? ShieldCheck : AlertTriangle}
                label={user.isEmailVerified ? L.emailVerified : L.emailUnverified}
                ok={user.isEmailVerified}
              />
              <MetaChip
                icon={KeyRound}
                label={user.twoFactorEnabled ? L.twoFactorOn : L.twoFactorOff}
                ok={user.twoFactorEnabled}
              />
              {user.hasDiscount40 && (
                <MetaChip icon={Percent} label={L.discount40} ok />
              )}
              {user.organizationId && (
                <MetaChip icon={Building2} label={L.hasOrg} ok />
              )}
            </div>
          </Card>

          {/* Pending topups */}
          <Card
            title={L.pendingTopups}
            icon={Hourglass}
            badge={pendingTopups.length}
          >
            {pendingTopups.length === 0 ? (
              <EmptyInline
                icon={CheckCircle2}
                text={L.noPending}
              />
            ) : (
              <div className="space-y-2.5">
                {pendingTopups.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <Hourglass className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-navy dark:text-white text-sm tabular-nums">
                          {money(t.amount)}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {fmtDateTime(t.createdAt, tr)}
                          {t.note ? ` · ${t.note}` : ''}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => confirmTopup.mutate(t.id)}
                      disabled={confirmTopup.isPending}
                      className="h-8 rounded-lg shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {L.confirm}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent transactions */}
          <Card title={L.recentTx} icon={Wallet}>
            {userTx.length === 0 ? (
              <EmptyInline icon={Wallet} text={L.noTx} />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 -my-1">
                {userTx.slice(0, 6).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-navy dark:text-white">
                        {L.txTypeName(t.type)}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        {fmtDateTime(t.createdAt, tr)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                          t.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : t.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
                        }`}
                      >
                        {L.txStatusName(t.status)}
                      </span>
                      <span className="text-sm font-semibold text-navy dark:text-white tabular-nums">
                        {money(t.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column — KVKK / GDPR */}
        <div className="space-y-6">
          <Card title={L.gdprTitle} icon={Shield}>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {L.gdprDesc}
            </p>
            <div className="mt-4 space-y-2.5">
              <Button
                variant="outline"
                onClick={() => exportData.mutate()}
                disabled={exportData.isPending}
                className="w-full h-10 justify-start rounded-xl dark:border-slate-700 dark:text-slate-200"
              >
                <Download className="h-4 w-4" />
                {exportData.isPending ? L.exporting : L.exportData}
              </Button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="w-full h-10 inline-flex items-center justify-start gap-2 px-3 rounded-xl text-sm font-medium bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
              >
                <Trash2 className="h-4 w-4" />
                {L.anonymize}
              </button>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              {L.gdprWarn}
            </div>
          </Card>

          {/* Identifiers */}
          <Card title={L.identifiers} icon={UserIcon}>
            <dl className="space-y-3 text-sm">
              <InfoRow label={L.userId} value={user.id} mono />
              {user.organizationId && (
                <InfoRow label={L.orgId} value={user.organizationId} mono />
              )}
              {user.leaderId && (
                <InfoRow label={L.leaderId} value={user.leaderId} mono />
              )}
              <InfoRow label={L.createdAt} value={fmtDateTime(user.createdAt, tr)} />
            </dl>
          </Card>
        </div>
      </div>

      {/* ---- Topup dialog ---- */}
      <Dialog open={topupOpen} onOpenChange={(o) => !o && setTopupOpen(false)}>
        <DialogContent className="bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800">
          <DialogHeader>
            <DialogTitle className="text-navy dark:text-white">
              {L.topupTitle}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {L.topupDesc(memberName)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <Label htmlFor="topup-amount" className="text-slate-600 dark:text-slate-300">
              {L.amount}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                $
              </span>
              <Input
                id="topup-amount"
                type="number"
                min={1}
                step="0.01"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitTopup()}
                placeholder="0.00"
                className="h-10 pl-7 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[50, 100, 250, 500].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="px-2.5 h-7 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  +${q}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTopupOpen(false)}
              className="rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {L.cancel}
            </Button>
            <Button
              onClick={submitTopup}
              disabled={topup.isPending}
              className="rounded-xl"
            >
              {topup.isPending ? L.processing : L.topupConfirmBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Anonymize/delete confirm dialog ---- */}
      <Dialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <DialogContent className="bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800">
          <DialogHeader>
            <DialogTitle className="text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {L.anonymizeTitle}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {L.anonymizeDesc(memberName)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <Label htmlFor="del-confirm" className="text-slate-600 dark:text-slate-300">
              {L.typeToConfirm}
            </Label>
            <Input
              id="del-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="h-10 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {L.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => anonymize.mutate()}
              disabled={anonymize.isPending || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
              className="rounded-xl"
            >
              <Trash2 className="h-4 w-4" />
              {anonymize.isPending ? L.processing : L.anonymizeBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/admin/users"
      className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </Link>
  );
}

function Card({
  title,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  icon: LucideIcon;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-slate-100 text-navy dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-semibold text-navy dark:text-white">{title}</h2>
        {badge != null && badge > 0 && (
          <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300 rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'primary',
  sub,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  accent?: keyof typeof STAT_ACCENT;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800 p-5 hover:shadow-lg transition-shadow dark:hover:shadow-black/20">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {label}
          </div>
          <div className="text-xl font-semibold text-navy dark:text-white mt-1.5 tabular-nums truncate">
            {value}
          </div>
          {sub && (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
              {sub}
            </div>
          )}
        </div>
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${STAT_ACCENT[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
  ok,
}: {
  icon: LucideIcon;
  label: string;
  ok?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        ok
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400 shrink-0">{label}</dt>
      <dd
        className={`text-navy dark:text-slate-200 font-medium text-right break-all ${
          mono ? 'font-mono text-[12px]' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyInline({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500">{text}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl animate-pulse">
      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
      <div className="bg-white rounded-3xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800 p-6 flex items-center gap-5">
        <div className="h-16 w-16 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[104px] bg-white rounded-3xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800"
          />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 bg-white rounded-3xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800" />
        <div className="h-64 bg-white rounded-3xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline i18n (next-intl useLocale) — JSON'a dokunmadan               */
/* ------------------------------------------------------------------ */

function labels(tr: boolean) {
  const roleName = (r: Role) =>
    tr
      ? {
          USER: 'Kullanıcı',
          TEAM_MEMBER: 'Ekip Üyesi',
          TEAM_LEADER: 'Ekip Lideri',
          ADMIN: 'Yönetici',
          PRODUCTION: 'Üretim',
        }[r]
      : {
          USER: 'User',
          TEAM_MEMBER: 'Team Member',
          TEAM_LEADER: 'Team Leader',
          ADMIN: 'Admin',
          PRODUCTION: 'Production',
        }[r];

  const txTypeName = (t: TxType) =>
    tr
      ? {
          BALANCE_LOAD: 'Bakiye Yükleme',
          ORDER_PAYMENT: 'Sipariş Ödemesi',
          MEMBERSHIP_FEE: 'Üyelik Aidatı',
          REFUND: 'İade',
        }[t]
      : {
          BALANCE_LOAD: 'Balance Load',
          ORDER_PAYMENT: 'Order Payment',
          MEMBERSHIP_FEE: 'Membership Fee',
          REFUND: 'Refund',
        }[t];

  const txStatusName = (s: TxStatus) =>
    tr
      ? { SUCCESS: 'Başarılı', PENDING: 'Beklemede', FAILED: 'Başarısız' }[s]
      : { SUCCESS: 'Success', PENDING: 'Pending', FAILED: 'Failed' }[s];

  return {
    roleName,
    txTypeName,
    txStatusName,

    back: tr ? 'Kullanıcılar' : 'Users',
    refresh: tr ? 'Yenile' : 'Refresh',
    retry: tr ? 'Tekrar dene' : 'Try again',
    notFound: tr ? 'Kullanıcı bulunamadı' : 'User not found',
    error: tr ? 'Bir hata oluştu' : 'Something went wrong',
    cancel: tr ? 'Vazgeç' : 'Cancel',
    processing: tr ? 'İşleniyor…' : 'Processing…',
    noName: tr ? 'İsimsiz kullanıcı' : 'Unnamed user',

    memberSince: tr ? 'Üyelik:' : 'Joined:',
    statusActive: tr ? 'Aktif' : 'Active',
    statusInactive: tr ? 'Pasif' : 'Inactive',

    // Stats
    balance: tr ? 'Bakiye' : 'Balance',
    discountActive: tr ? '%40 indirim aktif' : '40% discount active',
    orders: tr ? 'Sipariş' : 'Orders',
    priceMultiplier: tr ? 'Fiyat Çarpanı' : 'Price Multiplier',
    twoFactor: tr ? 'İki Adımlı' : 'Two-Factor',
    on: tr ? 'Açık' : 'On',
    off: tr ? 'Kapalı' : 'Off',

    // Account controls
    accountControls: tr ? 'Hesap Yönetimi' : 'Account Controls',
    role: tr ? 'Rol' : 'Role',
    roleHint: tr
      ? 'Rol değişikliği fiyat çarpanını günceller.'
      : 'Changing role updates the price multiplier.',
    accountStatus: tr ? 'Hesap Durumu' : 'Account Status',
    activate: tr ? 'Aktifleştir' : 'Activate',
    deactivate: tr ? 'Pasifleştir' : 'Deactivate',
    activateHint: tr
      ? 'Kullanıcı tekrar giriş yapabilecek.'
      : 'User will be able to sign in again.',
    deactivateHint: tr
      ? 'Kullanıcının erişimi engellenir.'
      : "User's access will be blocked.",
    roleChanged: tr ? 'Rol güncellendi' : 'Role updated',
    activated: tr ? 'Kullanıcı aktifleştirildi' : 'User activated',
    deactivated: tr ? 'Kullanıcı pasifleştirildi' : 'User deactivated',

    // Meta chips
    emailVerified: tr ? 'E-posta doğrulandı' : 'Email verified',
    emailUnverified: tr ? 'E-posta doğrulanmadı' : 'Email unverified',
    twoFactorOn: tr ? '2FA açık' : '2FA enabled',
    twoFactorOff: tr ? '2FA kapalı' : '2FA disabled',
    discount40: tr ? '%40 toplu indirim' : '40% bulk discount',
    hasOrg: tr ? 'Organizasyona bağlı' : 'In organization',

    // Pending topups
    pendingTopups: tr ? 'Bekleyen Kredi Talepleri' : 'Pending Credit Requests',
    noPending: tr ? 'Bekleyen yükleme talebi yok' : 'No pending top-up requests',
    confirm: tr ? 'Onayla' : 'Confirm',
    topupConfirmed: tr ? 'Yükleme onaylandı, bakiye işlendi' : 'Top-up confirmed, balance applied',

    // Recent tx
    recentTx: tr ? 'Son Hareketler' : 'Recent Activity',
    noTx: tr ? 'Henüz işlem yok' : 'No transactions yet',

    // Topup dialog
    topupCta: tr ? 'Bakiye Yükle' : 'Add Balance',
    topupTitle: tr ? 'Bakiye Yükle' : 'Add Balance',
    topupDesc: (name: string) =>
      tr
        ? `${name} hesabına manuel bakiye ekleyin. İşlem anında onaylanır.`
        : `Add balance to ${name}'s account. Applied instantly.`,
    amount: tr ? 'Tutar' : 'Amount',
    topupConfirmBtn: tr ? 'Yükle' : 'Add',
    topupDone: tr ? 'Bakiye yüklendi' : 'Balance added',
    amountInvalid: tr ? 'Geçerli bir tutar girin' : 'Enter a valid amount',

    // GDPR
    gdprTitle: tr ? 'KVKK / GDPR' : 'KVKK / GDPR',
    gdprDesc: tr
      ? 'Veri taşınabilirliği ve unutulma hakkı kapsamında kullanıcı verilerini dışa aktarın veya hesabı anonimleştirin.'
      : 'Export the user data or anonymize the account under data portability and right-to-be-forgotten.',
    exportData: tr ? 'Veriyi İndir (JSON)' : 'Export Data (JSON)',
    exporting: tr ? 'Hazırlanıyor…' : 'Preparing…',
    exportDone: tr ? 'Veri dışa aktarıldı' : 'Data exported',
    anonymize: tr ? 'Hesabı Anonimleştir' : 'Anonymize Account',
    gdprWarn: tr
      ? 'Anonimleştirme geri alınamaz; kişisel veriler kalıcı olarak temizlenir.'
      : 'Anonymization is irreversible; personal data is permanently cleared.',

    // Anonymize dialog
    anonymizeTitle: tr ? 'Hesabı Anonimleştir' : 'Anonymize Account',
    anonymizeDesc: (name: string) =>
      tr
        ? `${name} hesabının kişisel verileri kalıcı olarak silinecek ve hesap anonimleştirilecek. Bu işlem geri alınamaz.`
        : `${name}'s personal data will be permanently removed and the account anonymized. This cannot be undone.`,
    typeToConfirm: tr ? 'Onaylamak için DELETE yazın' : 'Type DELETE to confirm',
    anonymizeBtn: tr ? 'Anonimleştir' : 'Anonymize',
    anonymizeDone: tr ? 'Hesap anonimleştirildi' : 'Account anonymized',

    // Identifiers
    identifiers: tr ? 'Tanımlayıcılar' : 'Identifiers',
    userId: tr ? 'Kullanıcı ID' : 'User ID',
    orgId: tr ? 'Organizasyon ID' : 'Organization ID',
    leaderId: tr ? 'Lider ID' : 'Leader ID',
    createdAt: tr ? 'Oluşturulma' : 'Created at',
  };
}
