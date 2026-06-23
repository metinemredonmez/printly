'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';

export type CatalogKind = 'product' | 'material' | 'extra';

export interface MaterialOpt {
  id: string;
  name: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const CATEGORIES = ['WALLPAPER', 'WALL_DECAL', 'WOOD'] as const;
const UNITS = ['M2', 'FLAT'] as const;

const fieldCls =
  'w-full h-10 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 outline-none';

export function CatalogFormDialog({
  kind,
  editing,
  materials,
  open,
  onOpenChange,
}: {
  kind: CatalogKind;
  editing: Row | null;
  materials: MaterialOpt[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useTranslations('catalog');
  const qc = useQueryClient();
  const isEdit = !!editing;

  const [form, setForm] = useState<Row>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        ...editing,
        materialId: editing.materialId ?? editing.material?.id ?? '',
        requiredFormats: Array.isArray(editing.requiredFormats)
          ? editing.requiredFormats.join(', ')
          : '',
      });
    } else {
      setForm(
        kind === 'product'
          ? { category: 'WALLPAPER', unit: 'M2', requiredFormats: '' }
          : {},
      );
    }
  }, [open, editing, kind]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const body = buildBody(kind, form);
      if (kind === 'product') {
        return isEdit
          ? api(`/products/${editing!.id}`, { method: 'PATCH', json: body })
          : api('/products', { method: 'POST', json: body });
      }
      if (kind === 'material') {
        return isEdit
          ? api(`/materials/${editing!.id}`, { method: 'PATCH', json: body })
          : api('/materials', { method: 'POST', json: body });
      }
      // extra: yalnızca create (backend'de PATCH yok)
      return api('/extras', { method: 'POST', json: body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog'] });
      toast.success(isEdit ? t('updated') : t('created'));
      onOpenChange(false);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : t('saveError'));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  const title = isEdit
    ? t('editTitle', { kind: t(`kind_${kind}`) })
    : t('newTitle', { kind: t(`kind_${kind}`) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('formHint')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Ortak: Ad */}
          <Field label={t('fName')} required>
            <Input
              value={form.name ?? ''}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder={t('fNamePlaceholder')}
            />
          </Field>

          {kind === 'product' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('fCategory')} required>
                  <select
                    className={fieldCls}
                    value={form.category ?? 'WALLPAPER'}
                    onChange={(e) => {
                      const c = e.target.value;
                      set('category', c);
                      set('unit', c === 'WALLPAPER' ? 'M2' : 'FLAT');
                    }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`cat_${c}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('fUnit')} required>
                  <select
                    className={fieldCls}
                    value={form.unit ?? 'M2'}
                    onChange={(e) => set('unit', e.target.value)}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {t(`unit_${u}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {form.unit === 'M2' ? (
                  <Field label={t('fBasePrice')}>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.basePricePerM2 ?? ''}
                      onChange={(e) => set('basePricePerM2', e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                ) : (
                  <Field label={t('fFlatPrice')}>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.flatPrice ?? ''}
                      onChange={(e) => set('flatPrice', e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                )}
                <Field label={t('fMaterial')}>
                  <select
                    className={fieldCls}
                    value={form.materialId ?? ''}
                    onChange={(e) => set('materialId', e.target.value)}
                  >
                    <option value="">{t('noMaterial')}</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('fMinDpi')}>
                  <Input
                    type="number"
                    min="1"
                    value={form.minDpi ?? ''}
                    onChange={(e) => set('minDpi', e.target.value)}
                    placeholder="150"
                  />
                </Field>
                <Field label={t('fFormats')} hint={t('formatsHint')}>
                  <Input
                    value={form.requiredFormats ?? ''}
                    onChange={(e) => set('requiredFormats', e.target.value)}
                    placeholder="tiff, pdf"
                  />
                </Field>
              </div>

              <Field label={t('fDescription')}>
                <textarea
                  className={`${fieldCls} h-20 py-2 resize-none`}
                  value={form.description ?? ''}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
            </>
          )}

          {kind === 'material' && (
            <Field label={t('fWidthInch')}>
              <Input
                type="number"
                min="1"
                value={form.widthInch ?? ''}
                onChange={(e) => set('widthInch', e.target.value)}
                placeholder="54"
              />
            </Field>
          )}

          {kind === 'extra' && (
            <>
              <Field label={t('fCode')} required>
                <Input
                  value={form.code ?? ''}
                  onChange={(e) => set('code', e.target.value.toUpperCase())}
                  required
                  placeholder="SHIPPING_BOX"
                  disabled={isEdit}
                />
              </Field>
              <Field label={t('fPrice')} required>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price ?? ''}
                  onChange={(e) => set('price', e.target.value)}
                  required
                  placeholder="0.00"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('fFixedWidth')}>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.fixedWidthInch ?? ''}
                    onChange={(e) => set('fixedWidthInch', e.target.value)}
                  />
                </Field>
                <Field label={t('fFixedHeight')}>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.fixedHeightInch ?? ''}
                    onChange={(e) => set('fixedHeightInch', e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {/* Aktiflik (yalnızca product/material düzenlemede) */}
          {isEdit && kind !== 'extra' && (
            <label className="flex items-center gap-2 text-sm text-navy cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.active ?? true}
                onChange={(e) => set('active', e.target.checked)}
              />
              {t('fActive')}
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('saving') : isEdit ? t('save') : t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function num(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function buildBody(kind: CatalogKind, form: Row): Row {
  if (kind === 'material') {
    return {
      name: form.name,
      widthInch: num(form.widthInch),
      ...(form.active !== undefined ? { active: form.active } : {}),
    };
  }
  if (kind === 'extra') {
    return {
      code: form.code,
      name: form.name,
      price: num(form.price) ?? 0,
      fixedWidthInch: num(form.fixedWidthInch),
      fixedHeightInch: num(form.fixedHeightInch),
    };
  }
  // product
  const formats = String(form.requiredFormats ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return {
    name: form.name,
    category: form.category,
    unit: form.unit,
    description: form.description || undefined,
    basePricePerM2: form.unit === 'M2' ? num(form.basePricePerM2) : undefined,
    flatPrice: form.unit === 'FLAT' ? num(form.flatPrice) : undefined,
    materialId: form.materialId || undefined,
    minDpi: num(form.minDpi),
    requiredFormats: formats.length ? formats : undefined,
    ...(form.active !== undefined ? { active: form.active } : {}),
  };
}
