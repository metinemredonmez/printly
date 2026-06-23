'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Package, Layers, PlusCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { money } from '@/lib/format';

interface Material {
  id: string;
  name: string;
  widthInch: number;
  active: boolean;
}
interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  basePricePerM2?: number | null;
  flatPrice?: number | null;
  active: boolean;
  material?: { name: string } | null;
}
interface Extra {
  id: string;
  name: string;
  price: number;
  active: boolean;
}

type Tab = 'products' | 'materials' | 'extras';

export default function CatalogPage() {
  const t = useTranslations('catalog');
  const [tab, setTab] = useState<Tab>('products');

  const products = useQuery({
    queryKey: ['catalog', 'products'],
    queryFn: () => api<Product[]>('/products'),
  });
  const materials = useQuery({
    queryKey: ['catalog', 'materials'],
    queryFn: () => api<Material[]>('/materials'),
  });
  const extras = useQuery({
    queryKey: ['catalog', 'extras'],
    queryFn: () => api<Extra[]>('/extras'),
  });

  const tabs: { key: Tab; label: string; icon: typeof Package }[] = [
    { key: 'products', label: t('tabProducts'), icon: Package },
    { key: 'materials', label: t('tabMaterials'), icon: Layers },
    { key: 'extras', label: t('tabExtras'), icon: PlusCircle },
  ];

  const active = (() => {
    if (tab === 'products') return products;
    if (tab === 'materials') return materials;
    return extras;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">{t('title')}</h1>
        <p className="text-slate-500">{t('subtitle')}</p>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-2 border-b border-slate-100">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          const on = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                on
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-navy'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* İçerik */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {active.isLoading ? (
          <div className="px-5 py-10 text-center text-slate-400">…</div>
        ) : tab === 'products' ? (
          <ProductTable rows={products.data ?? []} t={t} />
        ) : tab === 'materials' ? (
          <MaterialTable rows={materials.data ?? []} t={t} />
        ) : (
          <ExtraTable rows={extras.data ?? []} t={t} />
        )}
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

function StatusBadge({ active, t }: { active: boolean; t: T }) {
  return (
    <Badge variant={active ? 'default' : 'secondary'}>
      {active ? t('active') : t('passive')}
    </Badge>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="px-5 py-12 text-center text-slate-400 text-sm">{label}</div>;
}

function HeadCell({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function ProductTable({ rows, t }: { rows: Product[]; t: T }) {
  if (rows.length === 0) return <EmptyState label={t('emptyProducts')} />;
  return (
    <table className="w-full">
      <thead className="border-b border-slate-100 bg-slate-50/50">
        <tr>
          <HeadCell>{t('colName')}</HeadCell>
          <HeadCell>{t('colCategory')}</HeadCell>
          <HeadCell>{t('colMaterial')}</HeadCell>
          <HeadCell right>{t('colPrice')}</HeadCell>
          <HeadCell right>{t('colStatus')}</HeadCell>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((p) => (
          <tr key={p.id} className={`hover:bg-slate-50 ${p.active ? '' : 'opacity-50'}`}>
            <td className="px-5 py-3.5 font-semibold text-navy text-sm">{p.name}</td>
            <td className="px-5 py-3.5 text-sm text-slate-600">{p.category}</td>
            <td className="px-5 py-3.5 text-sm text-slate-500">{p.material?.name ?? '—'}</td>
            <td className="px-5 py-3.5 text-right font-bold text-navy text-sm">
              {p.unit === 'M2' ? `${money(p.basePricePerM2)}/m²` : money(p.flatPrice)}
            </td>
            <td className="px-5 py-3.5 text-right">
              <StatusBadge active={p.active} t={t} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MaterialTable({ rows, t }: { rows: Material[]; t: T }) {
  if (rows.length === 0) return <EmptyState label={t('emptyMaterials')} />;
  return (
    <table className="w-full">
      <thead className="border-b border-slate-100 bg-slate-50/50">
        <tr>
          <HeadCell>{t('colName')}</HeadCell>
          <HeadCell right>{t('colWidth')}</HeadCell>
          <HeadCell right>{t('colStatus')}</HeadCell>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((m) => (
          <tr key={m.id} className={`hover:bg-slate-50 ${m.active ? '' : 'opacity-50'}`}>
            <td className="px-5 py-3.5 font-semibold text-navy text-sm">{m.name}</td>
            <td className="px-5 py-3.5 text-right text-sm text-slate-600">
              {t('inchValue', { n: m.widthInch })}
            </td>
            <td className="px-5 py-3.5 text-right">
              <StatusBadge active={m.active} t={t} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExtraTable({ rows, t }: { rows: Extra[]; t: T }) {
  if (rows.length === 0) return <EmptyState label={t('emptyExtras')} />;
  return (
    <table className="w-full">
      <thead className="border-b border-slate-100 bg-slate-50/50">
        <tr>
          <HeadCell>{t('colName')}</HeadCell>
          <HeadCell right>{t('colPrice')}</HeadCell>
          <HeadCell right>{t('colStatus')}</HeadCell>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((e) => (
          <tr key={e.id} className={`hover:bg-slate-50 ${e.active ? '' : 'opacity-50'}`}>
            <td className="px-5 py-3.5 font-semibold text-navy text-sm">{e.name}</td>
            <td className="px-5 py-3.5 text-right font-bold text-navy text-sm">{money(e.price)}</td>
            <td className="px-5 py-3.5 text-right">
              <StatusBadge active={e.active} t={t} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}