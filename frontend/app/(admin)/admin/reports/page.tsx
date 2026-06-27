'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  BarChart3,
  Trophy,
  TrendingUp,
  Download,
  FileSpreadsheet,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/stat-card';
import { money, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { TableSkeleton, ListSkeleton } from '@/components/skeletons';

interface DealerRow {
  userId: string;
  dealer: string;
  orders: number;
  revenue: number;
}
interface RevenueRow {
  month: string;
  total: number;
}

type ExportKind = 'orders' | 'users' | 'transactions';

const EXPORTS: { kind: ExportKind; icon: typeof ShoppingCart; accent: string }[] = [
  { kind: 'orders', icon: ShoppingCart, accent: 'bg-blue-50 text-primary' },
  { kind: 'users', icon: Users, accent: 'bg-amber-50 text-amber-600' },
  { kind: 'transactions', icon: Wallet, accent: 'bg-emerald-50 text-emerald-600' },
];

export default function ReportsPage() {
  const t = useTranslations('reports');
  const [downloading, setDownloading] = useState<ExportKind | null>(null);

  const dealers = useQuery({
    queryKey: ['reports', 'dealers'],
    queryFn: () => api<DealerRow[]>('/reports/dealers'),
  });
  const revenue = useQuery({
    queryKey: ['reports', 'revenue'],
    queryFn: () => api<RevenueRow[]>('/reports/revenue'),
  });

  const dealerRows = dealers.data ?? [];
  const revRows = revenue.data ?? [];
  const maxRev = Math.max(...revRows.map((r) => r.total), 1);
  const totalRevenue = dealerRows.reduce((a, b) => a + (b.revenue ?? 0), 0);
  const totalOrders = dealerRows.reduce((a, b) => a + (b.orders ?? 0), 0);

  async function handleExport(kind: ExportKind) {
    setDownloading(kind);
    try {
      const res = await fetch(`/api/be/export/${kind}.xlsx`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kind}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('exportSuccess', { name: t(`export_${kind}`) }));
    } catch {
      toast.error(t('exportError'));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">{t('title')}</h1>
        <p className="text-slate-500">{t('subtitle')}</p>
      </div>

      {/* Özet kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label={t('totalDealers')}
          value={dealers.isLoading ? '…' : num(dealerRows.length)}
          icon={Trophy}
          accent="amber"
        />
        <StatCard
          label={t('totalOrders')}
          value={dealers.isLoading ? '…' : num(totalOrders)}
          icon={ShoppingCart}
          accent="primary"
        />
        <StatCard
          label={t('totalRevenue')}
          value={dealers.isLoading ? '…' : money(totalRevenue)}
          icon={TrendingUp}
          accent="emerald"
        />
      </div>

      {/* Excel export */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          <h2 className="font-semibold text-navy">{t('exportTitle')}</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {EXPORTS.map(({ kind, icon: Icon, accent }) => (
            <button
              key={kind}
              onClick={() => handleExport(kind)}
              disabled={downloading !== null}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-navy">{t(`export_${kind}`)}</span>
                <span className="block text-[11px] text-slate-400">{t('exportHint')}</span>
              </span>
              <Download
                className={`h-4 w-4 shrink-0 text-slate-400 ${
                  downloading === kind ? 'animate-pulse text-primary' : ''
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bayi performansı */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-navy">{t('dealerPerformance')}</h2>
          </div>
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400">
            <div className="col-span-6">{t('dealer')}</div>
            <div className="col-span-3 text-right">{t('orders')}</div>
            <div className="col-span-3 text-right">{t('revenue')}</div>
          </div>
          {dealers.isLoading ? (
            <TableSkeleton rows={6} cols={3} />
          ) : dealerRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">{t('emptyDealers')}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dealerRows.map((d, i) => (
                <div
                  key={d.userId}
                  className="grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-3.5 items-center"
                >
                  <div className="md:col-span-6 flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-navy">
                      {i + 1}
                    </span>
                    <span className="truncate text-sm font-semibold text-navy">{d.dealer}</span>
                  </div>
                  <div className="md:col-span-3 text-right text-sm text-slate-600">
                    {num(d.orders)}
                  </div>
                  <div className="md:col-span-3 text-right text-sm font-semibold text-navy">
                    {money(d.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Aylık gelir */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-navy">{t('monthlyRevenue')}</h2>
          </div>
          {revenue.isLoading ? (
            <ListSkeleton rows={6} />
          ) : revRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">{t('emptyRevenue')}</div>
          ) : (
            <div className="space-y-2.5">
              {revRows.slice(-12).map((r) => (
                <div key={r.month} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-[11px] font-medium text-slate-500">
                    {r.month}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.max((r.total / maxRev) * 100, 3)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs font-semibold text-navy">
                    {money(r.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}