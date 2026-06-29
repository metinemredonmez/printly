'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Package,
  Layers,
  PlusCircle,
  Pencil,
  Trash2,
  Plus,
  Upload,
  Loader2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { money } from '@/lib/format';
import { useMe } from '@/lib/useMe';
import {
  CatalogFormDialog,
  type CatalogKind,
} from '@/components/catalog/catalog-form';

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
  materialId?: string | null;
  material?: { id: string; name: string } | null;
}
interface Extra {
  id: string;
  name: string;
  code?: string;
  price: number;
  active: boolean;
}

type Tab = 'products' | 'materials' | 'extras';

interface ImportResult {
  created: number;
  updated: number;
  total: number;
  errors?: { row: number; message: string }[];
}

export default function CatalogPage() {
  const t = useTranslations('catalog');
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>('products');
  const fileRef = useRef<HTMLInputElement>(null);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [dialog, setDialog] = useState<{ kind: CatalogKind; editing: any } | null>(
    null,
  );

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

  const deleteExtra = useMutation({
    mutationFn: (id: string) => api(`/extras/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog', 'extras'] });
      toast.success(t('deleted'));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('saveError')),
  });

  const importProducts = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      // Not: FormData ile content-type header'ı ELLE ekleme — tarayıcı boundary'i koyar.
      return api<ImportResult>('/import/products', { method: 'POST', body: fd });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['catalog', 'products'] });
      const errCount = r.errors?.length ?? 0;
      const summary = tr
        ? `${r.created} eklendi · ${r.updated} güncellendi`
        : `${r.created} added · ${r.updated} updated`;
      if (errCount > 0) {
        toast.warning(summary, {
          description: tr
            ? `${errCount} satır atlandı: ${r.errors?.[0]?.message ?? ''}`
            : `${errCount} rows skipped: ${r.errors?.[0]?.message ?? ''}`,
        });
      } else {
        toast.success(summary);
      }
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : tr ? 'İçe aktarma başarısız' : 'Import failed',
      ),
  });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importProducts.mutate(file);
    e.target.value = ''; // aynı dosya tekrar seçilebilsin
  };

  const tabs: { key: Tab; label: string; icon: typeof Package }[] = [
    { key: 'products', label: t('tabProducts'), icon: Package },
    { key: 'materials', label: t('tabMaterials'), icon: Layers },
    { key: 'extras', label: t('tabExtras'), icon: PlusCircle },
  ];

  const active = tab === 'products' ? products : tab === 'materials' ? materials : extras;
  const kindForTab: CatalogKind =
    tab === 'products' ? 'product' : tab === 'materials' ? 'material' : 'extra';
  const materialOpts = (materials.data ?? []).map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-navy dark:text-white">{t('title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {tab === 'products' && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onPickFile}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="lg"
                  disabled={importProducts.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  {importProducts.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {tr ? 'İçe Aktar (CSV)' : 'Import (CSV)'}
                </Button>
              </>
            )}
            <Button
              size="lg"
              onClick={() => setDialog({ kind: kindForTab, editing: null })}
            >
              <Plus className="h-4 w-4" />
              {t('newTitle', { kind: t(`kind_${kindForTab}`) })}
            </Button>
          </div>
        )}
      </div>

      {/* CSV içe aktarma yardım metni */}
      {isAdmin && tab === 'products' && (
        <p className="-mt-2 text-xs text-slate-400 dark:text-slate-500">
          {tr
            ? 'Beklenen kolonlar: name, category, unit (M2/FLAT), basePricePerM2, flatPrice, description, materialId, active. Mevcut id verilirse güncellenir.'
            : 'Expected columns: name, category, unit (M2/FLAT), basePricePerM2, flatPrice, description, materialId, active. Existing id updates the row.'}
        </p>
      )}

      {/* Sekmeler */}
      <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800">
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
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* İçerik */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {active.isLoading ? (
          <TableSkeleton />
        ) : tab === 'products' ? (
          <ProductTable
            rows={products.data ?? []}
            t={t}
            isAdmin={isAdmin}
            onEdit={(p) => setDialog({ kind: 'product', editing: p })}
          />
        ) : tab === 'materials' ? (
          <MaterialTable
            rows={materials.data ?? []}
            t={t}
            isAdmin={isAdmin}
            onEdit={(m) => setDialog({ kind: 'material', editing: m })}
          />
        ) : (
          <ExtraTable
            rows={extras.data ?? []}
            t={t}
            isAdmin={isAdmin}
            onDelete={(id) => {
              if (confirm(t('confirmDelete'))) deleteExtra.mutate(id);
            }}
          />
        )}
      </div>

      {dialog && (
        <CatalogFormDialog
          kind={dialog.kind}
          editing={dialog.editing}
          materials={materialOpts}
          open={!!dialog}
          onOpenChange={(v) => !v && setDialog(null)}
        />
      )}
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ active, t }: { active: boolean; t: T }) {
  return (
    <Badge variant={active ? 'default' : 'secondary'}>
      {active ? t('active') : t('passive')}
    </Badge>
  );
}

function EmptyState({ label, icon: Icon }: { label: string; icon: typeof Package }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-slate-400 dark:text-slate-500 text-sm">{label}</p>
    </div>
  );
}

function HeadCell({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function IconBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-navy dark:hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}

function ProductTable({
  rows,
  t,
  isAdmin,
  onEdit,
}: {
  rows: Product[];
  t: T;
  isAdmin: boolean;
  onEdit: (p: Product) => void;
}) {
  if (rows.length === 0) return <EmptyState label={t('emptyProducts')} icon={Package} />;
  return (
    <table className="w-full">
      <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
        <tr>
          <HeadCell>{t('colName')}</HeadCell>
          <HeadCell>{t('colCategory')}</HeadCell>
          <HeadCell>{t('colMaterial')}</HeadCell>
          <HeadCell right>{t('colPrice')}</HeadCell>
          <HeadCell right>{t('colStatus')}</HeadCell>
          {isAdmin && <HeadCell right>{t('colActions')}</HeadCell>}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((p) => (
          <tr
            key={p.id}
            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${p.active ? '' : 'opacity-50'}`}
          >
            <td className="px-5 py-3.5 font-semibold text-navy dark:text-white text-sm">{p.name}</td>
            <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">
              {t.has(`cat_${p.category}`) ? t(`cat_${p.category}`) : p.category}
            </td>
            <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">
              {p.material?.name ?? '—'}
            </td>
            <td className="px-5 py-3.5 text-right font-semibold text-navy dark:text-white text-sm">
              {p.unit === 'M2' ? `${money(p.basePricePerM2)}/m²` : money(p.flatPrice)}
            </td>
            <td className="px-5 py-3.5 text-right">
              <StatusBadge active={p.active} t={t} />
            </td>
            {isAdmin && (
              <td className="px-5 py-3.5 text-right">
                <IconBtn onClick={() => onEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </IconBtn>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MaterialTable({
  rows,
  t,
  isAdmin,
  onEdit,
}: {
  rows: Material[];
  t: T;
  isAdmin: boolean;
  onEdit: (m: Material) => void;
}) {
  if (rows.length === 0) return <EmptyState label={t('emptyMaterials')} icon={Layers} />;
  return (
    <table className="w-full">
      <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
        <tr>
          <HeadCell>{t('colName')}</HeadCell>
          <HeadCell right>{t('colWidth')}</HeadCell>
          <HeadCell right>{t('colStatus')}</HeadCell>
          {isAdmin && <HeadCell right>{t('colActions')}</HeadCell>}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((m) => (
          <tr
            key={m.id}
            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${m.active ? '' : 'opacity-50'}`}
          >
            <td className="px-5 py-3.5 font-semibold text-navy dark:text-white text-sm">{m.name}</td>
            <td className="px-5 py-3.5 text-right text-sm text-slate-600 dark:text-slate-300">
              {m.widthInch ? t('inchValue', { n: m.widthInch }) : '—'}
            </td>
            <td className="px-5 py-3.5 text-right">
              <StatusBadge active={m.active} t={t} />
            </td>
            {isAdmin && (
              <td className="px-5 py-3.5 text-right">
                <IconBtn onClick={() => onEdit(m)}>
                  <Pencil className="h-4 w-4" />
                </IconBtn>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExtraTable({
  rows,
  t,
  isAdmin,
  onDelete,
}: {
  rows: Extra[];
  t: T;
  isAdmin: boolean;
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) return <EmptyState label={t('emptyExtras')} icon={PlusCircle} />;
  return (
    <table className="w-full">
      <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
        <tr>
          <HeadCell>{t('colName')}</HeadCell>
          <HeadCell>{t('colCode')}</HeadCell>
          <HeadCell right>{t('colPrice')}</HeadCell>
          <HeadCell right>{t('colStatus')}</HeadCell>
          {isAdmin && <HeadCell right>{t('colActions')}</HeadCell>}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((e) => (
          <tr
            key={e.id}
            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${e.active ? '' : 'opacity-50'}`}
          >
            <td className="px-5 py-3.5 font-semibold text-navy dark:text-white text-sm">{e.name}</td>
            <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400 font-mono text-xs">
              {e.code ?? '—'}
            </td>
            <td className="px-5 py-3.5 text-right font-semibold text-navy dark:text-white text-sm">
              {money(e.price)}
            </td>
            <td className="px-5 py-3.5 text-right">
              <StatusBadge active={e.active} t={t} />
            </td>
            {isAdmin && (
              <td className="px-5 py-3.5 text-right">
                {e.active && (
                  <IconBtn onClick={() => onDelete(e.id)}>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
