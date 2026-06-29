'use client';

import { useTranslations } from 'next-intl';

const COLORS: Record<string, string> = {
  RECEIVED: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
  IN_PRODUCTION: 'bg-blue-50 dark:bg-blue-500/10 text-primary',
  AWAITING_APPROVAL: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
  READY: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  SHIPPED: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  DELIVERED: 'bg-teal-100 dark:bg-teal-500/10 text-teal-800 dark:text-teal-300',
  CANCELLED: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export function OrderStatusBadge({ status }: { status: string }) {
  const t = useTranslations('orderStatus');
  const cls = COLORS[status] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200';
  let label = status;
  try {
    label = t(status);
  } catch {
    label = status;
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
