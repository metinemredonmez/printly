'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

interface Dashboard {
  totalOrders?: number;
  revenue?: number;
  activeDealers?: number;
  [k: string]: unknown;
}

export default function AdminHome() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => api<Dashboard>('/reports/dashboard'),
  });

  const cards = [
    { label: 'Toplam Sipariş', value: data?.totalOrders },
    { label: 'Gelir (USD)', value: data?.revenue },
    { label: 'Aktif Bayi', value: data?.activeDealers },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">Operasyon Dashboard</h1>
        <p className="text-slate-500">Genel durum ve KPI&apos;lar.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-6">
            <div className="text-sm text-slate-500">{c.label}</div>
            <div className="text-3xl font-extrabold text-navy mt-2">
              {isLoading ? '…' : (c.value ?? '—')}
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        Detaylı raporlar, Kanban ve üretim ekranları sıradaki fazda eklenecek.
      </p>
    </div>
  );
}
