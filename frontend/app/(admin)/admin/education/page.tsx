'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  GraduationCap,
  BookOpen,
  Clock,
  Layers,
  Users,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
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

type Category =
  | 'PLATFORM'
  | 'DIGITAL_ADS'
  | 'SOCIAL_MEDIA'
  | 'TRADE_FINANCE'
  | 'OTHER';

interface AdminCourse {
  id: string;
  title: string;
  titleEn?: string | null;
  summary?: string | null;
  description?: string | null;
  category: Category;
  level?: string | null;
  price: number;
  memberPrice: number;
  yourPrice: number;
  isMember: boolean;
  durationMin?: number | null;
  lessonCount?: number | null;
  imageUrl?: string | null;
  contentUrl: string | null;
  active: boolean;
  sortOrder: number;
  enrolled: boolean;
  _count?: { enrollments: number };
}

const CATEGORIES: Category[] = [
  'PLATFORM',
  'DIGITAL_ADS',
  'SOCIAL_MEDIA',
  'TRADE_FINANCE',
  'OTHER',
];

function categoryLabel(c: Category, tr: boolean): string {
  const map: Record<Category, [string, string]> = {
    PLATFORM: ['Platform Eğitimleri', 'Platform'],
    DIGITAL_ADS: ['Dijital Reklam', 'Digital Ads'],
    SOCIAL_MEDIA: ['Sosyal Medya', 'Social Media'],
    TRADE_FINANCE: ['Ticaret & Finans', 'Trade & Finance'],
    OTHER: ['Diğer', 'Other'],
  };
  return tr ? map[c][0] : map[c][1];
}

const CATEGORY_BADGE: Record<Category, string> = {
  PLATFORM: 'bg-blue-50 text-primary dark:bg-blue-500/15 dark:text-blue-300',
  DIGITAL_ADS:
    'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  SOCIAL_MEDIA:
    'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  TRADE_FINANCE:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  OTHER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const money = (n: number) => `$${Number(n).toFixed(2)}`;

/* ------------------------------------------------------------------ */
/* Form model                                                          */
/* ------------------------------------------------------------------ */

interface CourseForm {
  title: string;
  titleEn: string;
  summary: string;
  description: string;
  category: Category;
  level: string;
  price: string;
  durationMin: string;
  lessonCount: string;
  imageUrl: string;
  contentUrl: string;
  active: boolean;
  sortOrder: string;
}

const emptyForm = (): CourseForm => ({
  title: '',
  titleEn: '',
  summary: '',
  description: '',
  category: 'PLATFORM',
  level: '',
  price: '0',
  durationMin: '',
  lessonCount: '',
  imageUrl: '',
  contentUrl: '',
  active: true,
  sortOrder: '0',
});

function formFromCourse(c: AdminCourse): CourseForm {
  return {
    title: c.title ?? '',
    titleEn: c.titleEn ?? '',
    summary: c.summary ?? '',
    description: c.description ?? '',
    category: c.category,
    level: c.level ?? '',
    price: String(c.price ?? 0),
    durationMin: c.durationMin != null ? String(c.durationMin) : '',
    lessonCount: c.lessonCount != null ? String(c.lessonCount) : '',
    imageUrl: c.imageUrl ?? '',
    contentUrl: c.contentUrl ?? '',
    active: c.active,
    sortOrder: String(c.sortOrder ?? 0),
  };
}

function payloadFromForm(f: CourseForm) {
  const num = (v: string) => {
    const n = Number(v);
    return v.trim() === '' || Number.isNaN(n) ? null : n;
  };
  return {
    title: f.title.trim(),
    titleEn: f.titleEn.trim() || null,
    summary: f.summary.trim() || null,
    description: f.description.trim() || null,
    category: f.category,
    level: f.level.trim() || null,
    price: Number(f.price) || 0,
    durationMin: num(f.durationMin),
    lessonCount: num(f.lessonCount),
    imageUrl: f.imageUrl.trim() || null,
    contentUrl: f.contentUrl.trim() || null,
    active: f.active,
    sortOrder: Number(f.sortOrder) || 0,
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminEducationPage() {
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCourse | null>(null);
  const [form, setForm] = useState<CourseForm>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<AdminCourse | null>(null);

  const {
    data: courses,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => api<AdminCourse[]>('/courses/admin/all'),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`/courses/${editing.id}`, {
            method: 'PATCH',
            json: payloadFromForm(form),
          })
        : api('/courses', { method: 'POST', json: payloadFromForm(form) }),
    onSuccess: () => {
      toast.success(
        editing
          ? tr
            ? 'Eğitim güncellendi'
            : 'Course updated'
          : tr
            ? 'Eğitim oluşturuldu'
            : 'Course created',
      );
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
      setDialogOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(
        e instanceof Error
          ? e.message
          : tr
            ? 'İşlem başarısız'
            : 'Operation failed',
      );
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/courses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(tr ? 'Eğitim silindi' : 'Course deleted');
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
      setDeleteTarget(null);
    },
    onError: (e: unknown) => {
      toast.error(
        e instanceof Error
          ? e.message
          : tr
            ? 'Silme başarısız'
            : 'Delete failed',
      );
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (c: AdminCourse) => {
    setEditing(c);
    setForm(formFromCourse(c));
    setDialogOpen(true);
  };

  const list = courses ?? [];
  const stats = useMemo(() => {
    const total = list.length;
    const active = list.filter((c) => c.active).length;
    const enrollments = list.reduce(
      (acc, c) => acc + (c._count?.enrollments ?? 0),
      0,
    );
    return { total, active, enrollments };
  }, [list]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy dark:text-white">
            {tr ? 'Eğitim Yönetimi' : 'Course Management'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {tr
              ? 'Bayilere sunulan eğitimleri oluşturun, düzenleyin ve yönetin.'
              : 'Create, edit and manage the courses offered to dealers.'}
          </p>
        </div>
        <Button onClick={openCreate} className="h-9 rounded-xl">
          <Plus className="h-4 w-4" />
          {tr ? 'Yeni Eğitim' : 'New Course'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStat
          label={tr ? 'Toplam' : 'Total'}
          value={isLoading ? '…' : stats.total}
          icon={BookOpen}
          accent="primary"
        />
        <MiniStat
          label={tr ? 'Aktif' : 'Active'}
          value={isLoading ? '…' : stats.active}
          icon={CheckCircle2}
          accent="emerald"
        />
        <MiniStat
          label={tr ? 'Kayıt' : 'Enrollments'}
          value={isLoading ? '…' : stats.enrollments}
          icon={Users}
          accent="amber"
        />
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Column header */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          <div className="col-span-5">{tr ? 'Eğitim' : 'Course'}</div>
          <div className="col-span-2">{tr ? 'Fiyat' : 'Price'}</div>
          <div className="col-span-2">{tr ? 'Kayıt' : 'Enroll.'}</div>
          <div className="col-span-1">{tr ? 'Durum' : 'Status'}</div>
          <div className="col-span-2 text-right">{tr ? 'İşlem' : 'Actions'}</div>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 animate-pulse"
              >
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorBlock
            message={
              error instanceof Error
                ? error.message
                : tr
                  ? 'Eğitimler yüklenemedi'
                  : 'Failed to load courses'
            }
            retryLabel={tr ? 'Tekrar dene' : 'Try again'}
            onRetry={() => refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyBlock
            title={tr ? 'Henüz eğitim yok' : 'No courses yet'}
            description={
              tr
                ? 'İlk eğitiminizi eklemek için “Yeni Eğitim” butonunu kullanın.'
                : 'Use the “New Course” button to add your first course.'
            }
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-2 px-5 py-3.5 items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                {/* Course */}
                <div className="col-span-2 md:col-span-5 flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary/10 to-indigo-500/10 dark:from-primary/20 dark:to-indigo-500/10 flex items-center justify-center overflow-hidden">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt={c.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <GraduationCap className="h-5 w-5 text-primary/70 dark:text-blue-300/70" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-navy dark:text-white text-sm truncate">
                      {c.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[c.category]}`}
                      >
                        {categoryLabel(c.category, tr)}
                      </span>
                      {c.level && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Layers className="h-3 w-3" />
                          {c.level}
                        </span>
                      )}
                      {c.durationMin != null && c.durationMin > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          {c.durationMin}
                          {tr ? 'dk' : 'm'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="md:col-span-2 text-sm order-3 md:order-none">
                  <span className="md:hidden font-medium text-slate-400 text-[11px]">
                    {tr ? 'Fiyat: ' : 'Price: '}
                  </span>
                  <span className="font-semibold text-navy dark:text-white tabular-nums">
                    {money(c.price)}
                  </span>
                  <span className="ml-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {tr ? 'üye' : 'mbr'} {money(c.memberPrice)}
                  </span>
                </div>

                {/* Enrollments */}
                <div className="md:col-span-2 text-sm order-4 md:order-none flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span className="tabular-nums">{c._count?.enrollments ?? 0}</span>
                </div>

                {/* Status */}
                <div className="md:col-span-1 order-2 md:order-none">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      c.active
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {c.active ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {c.active
                      ? tr
                        ? 'Aktif'
                        : 'Active'
                      : tr
                        ? 'Pasif'
                        : 'Off'}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(c)}
                    aria-label={tr ? 'Düzenle' : 'Edit'}
                    className="rounded-lg text-slate-500 hover:text-primary dark:text-slate-400"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(c)}
                    aria-label={tr ? 'Sil' : 'Delete'}
                    className="rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => setDialogOpen(o)}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-navy dark:text-white">
              <GraduationCap className="h-5 w-5 text-primary" />
              {editing
                ? tr
                  ? 'Eğitimi Düzenle'
                  : 'Edit Course'
                : tr
                  ? 'Yeni Eğitim'
                  : 'New Course'}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {tr
                ? 'Eğitim bilgilerini doldurun. * zorunlu alanları gösterir.'
                : 'Fill in the course details. * marks required fields.'}
            </DialogDescription>
          </DialogHeader>

          <form
            id="course-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.title.trim()) {
                toast.error(tr ? 'Başlık gerekli' : 'Title is required');
                return;
              }
              saveMut.mutate();
            }}
            className="space-y-4 py-1"
          >
            <Field label={tr ? 'Başlık' : 'Title'} required>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={tr ? 'Eğitim adı' : 'Course title'}
                className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <Field label={tr ? 'Başlık (EN)' : 'Title (EN)'}>
              <Input
                value={form.titleEn}
                onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
                placeholder="English title"
                className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <Field label={tr ? 'Özet' : 'Summary'}>
              <Input
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder={tr ? 'Kısa açıklama' : 'Short summary'}
                className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <Field label={tr ? 'Açıklama' : 'Description'}>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                placeholder={tr ? 'Detaylı açıklama' : 'Detailed description'}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white resize-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={tr ? 'Kategori' : 'Category'}>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as Category }))
                  }
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c, tr)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={tr ? 'Seviye' : 'Level'}>
                <Input
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  placeholder={tr ? 'Başlangıç' : 'Beginner'}
                  className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label={tr ? 'Fiyat ($)' : 'Price ($)'}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              </Field>
              <Field label={tr ? 'Süre (dk)' : 'Dur. (min)'}>
                <Input
                  type="number"
                  min={0}
                  value={form.durationMin}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, durationMin: e.target.value }))
                  }
                  className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              </Field>
              <Field label={tr ? 'Ders' : 'Lessons'}>
                <Input
                  type="number"
                  min={0}
                  value={form.lessonCount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lessonCount: e.target.value }))
                  }
                  className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              </Field>
            </div>

            <Field label={tr ? 'Görsel URL' : 'Image URL'}>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://…"
                className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <Field label={tr ? 'İçerik URL' : 'Content URL'}>
              <Input
                value={form.contentUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contentUrl: e.target.value }))
                }
                placeholder="https://…"
                className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label={tr ? 'Sıra' : 'Sort Order'}>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sortOrder: e.target.value }))
                  }
                  className="h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              </Field>
              <label className="flex items-center gap-2 h-9 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 dark:border-slate-600 dark:bg-slate-950"
                />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {tr ? 'Aktif' : 'Active'}
                </span>
              </label>
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {tr ? 'Vazgeç' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              form="course-form"
              disabled={saveMut.isPending}
              className="rounded-xl"
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing
                ? tr
                  ? 'Kaydet'
                  : 'Save'
                : tr
                  ? 'Oluştur'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              {tr ? 'Eğitimi Sil' : 'Delete Course'}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {tr
                ? `“${deleteTarget?.title}” kalıcı olarak silinecek. Bu işlem geri alınamaz.`
                : `“${deleteTarget?.title}” will be permanently deleted. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {tr ? 'Vazgeç' : 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="rounded-xl"
            >
              {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr ? 'Sil' : 'Delete'}
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

const ACCENTS: Record<string, string> = {
  primary: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
  emerald:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
};

function MiniStat({
  label,
  value,
  icon: Icon,
  accent = 'primary',
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof BookOpen;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 hover:shadow-lg transition-shadow dark:hover:shadow-black/20">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {label}
          </div>
          <div className="text-xl font-semibold text-navy dark:text-white mt-1.5 tabular-nums">
            {value}
          </div>
        </div>
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${ACCENTS[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-600 dark:text-slate-300 text-xs font-medium">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function EmptyBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <BookOpen className="h-7 w-7 text-slate-400" />
      </div>
      <p className="font-semibold text-navy dark:text-white">{title}</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
        {description}
      </p>
    </div>
  );
}

function ErrorBlock({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/15 flex items-center justify-center mb-4">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </div>
      <p className="font-semibold text-navy dark:text-white">{message}</p>
      <Button
        variant="outline"
        onClick={onRetry}
        className="mt-4 h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
      >
        {retryLabel}
      </Button>
    </div>
  );
}
