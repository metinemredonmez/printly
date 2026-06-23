'use client';

import { useTranslations } from 'next-intl';

const COLORS: Record<string, string> = {
  RECEIVED: 'bg-slate-100 text-slate-700',
  IN_PRODUCTION: 'bg-blue-50 text-primary',
  AWAITING_APPROVAL: 'bg-amber-50 text-amber-700',
  READY: 'bg-emerald-50 text-emerald-700',
  SHIPPED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-50 text-rose-700',
};

export function OrderStatusBadge({ status }: { status: string }) {
  const t = useTranslations('orderStatus');
  const cls = COLORS[status] ?? 'bg-slate-100 text-slate-700';
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
