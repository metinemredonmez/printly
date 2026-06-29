'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  Video,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface AdminEvent {
  id: string;
  title: string;
  titleEn?: string;
  description?: string;
  type?: string;
  startsAt: string;
  endsAt?: string;
  isOnline: boolean;
  location?: string;
  capacity?: number | null;
  price: number;
  memberPrice: number;
  imageUrl?: string;
  active: boolean;
  _count: { registrations: number };
}

interface EventForm {
  title: string;
  titleEn: string;
  description: string;
  type: string;
  startsAt: string; // datetime-local value
  endsAt: string; // datetime-local value
  isOnline: boolean;
  location: string;
  capacity: string;
  price: string;
  imageUrl: string;
  active: boolean;
}

const EMPTY_FORM: EventForm = {
  title: '',
  titleEn: '',
  description: '',
  type: 'seminer',
  startsAt: '',
  endsAt: '',
  isOnline: true,
  location: '',
  capacity: '',
  price: '0',
  imageUrl: '',
  active: true,
};

const TYPE_OPTIONS = ['seminer', 'workshop', 'buluşma', 'webinar'];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminEventsPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminEvent | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: () => api<AdminEvent[]>('/events/admin/all'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'events'] });
      toast.success(L.deleted);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : L.saveError),
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (ev: AdminEvent) => {
    setEditing(ev);
    setDialogOpen(true);
  };

  const onDelete = (ev: AdminEvent) => {
    if (window.confirm(L.confirmDelete(ev.title))) remove.mutate(ev.id);
  };

  const events = data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy dark:text-white">{L.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{L.subtitle}</p>
        </div>
        <Button onClick={openCreate} className="h-9 rounded-xl">
          <Plus className="h-4 w-4" />
          {L.newEvent}
        </Button>
      </div>

      {/* List card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4 h-[72px] animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <ErrorBlock
            message={error instanceof Error ? error.message : L.loadError}
            retry={() => refetch()}
            retryLabel={L.retry}
          />
        ) : events.length === 0 ? (
          <EmptyBlock title={L.emptyTitle} description={L.emptyDesc} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                {/* Main */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy dark:text-white truncate">
                      {ev.title}
                    </span>
                    {ev.type && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-navy dark:text-slate-200 capitalize">
                        {ev.type}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        ev.active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {ev.active ? L.activeBadge : L.inactiveBadge}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmtDate(ev.startsAt, tr)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {fmtTime(ev.startsAt, tr)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {ev.isOnline ? (
                        <>
                          <Video className="h-3.5 w-3.5" />
                          {L.online}
                        </>
                      ) : (
                        <>
                          <MapPin className="h-3.5 w-3.5" />
                          {ev.location || L.inPerson}
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {ev.capacity != null
                        ? L.capacityLine(ev._count.registrations, ev.capacity)
                        : L.regOnlyLine(ev._count.registrations)}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="hidden sm:block text-right shrink-0">
                  <div className="text-sm font-semibold text-navy dark:text-white tabular-nums">
                    {ev.price > 0 ? money(ev.price) : L.free}
                  </div>
                  {ev.price > 0 && (
                    <div className="text-[11px] text-brand-accent">
                      {L.memberPrice(money(ev.memberPrice))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(ev)}
                    className="rounded-lg text-slate-500 dark:text-slate-400"
                    aria-label={L.edit}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(ev)}
                    disabled={remove.isPending && remove.variables === ev.id}
                    className="rounded-lg text-rose-500 hover:text-rose-600 dark:text-rose-400"
                    aria-label={L.delete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        tr={tr}
        L={L}
        onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'events'] })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create / Edit dialog                                                 */
/* ------------------------------------------------------------------ */

function EventFormDialog({
  open,
  onOpenChange,
  editing,
  tr,
  L,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AdminEvent | null;
  tr: boolean;
  L: ReturnType<typeof labels>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title ?? '',
        titleEn: editing.titleEn ?? '',
        description: editing.description ?? '',
        type: editing.type ?? '',
        startsAt: toLocalInput(editing.startsAt),
        endsAt: editing.endsAt ? toLocalInput(editing.endsAt) : '',
        isOnline: editing.isOnline,
        location: editing.location ?? '',
        capacity: editing.capacity != null ? String(editing.capacity) : '',
        price: String(editing.price ?? 0),
        imageUrl: editing.imageUrl ?? '',
        active: editing.active,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        titleEn: form.titleEn.trim() || undefined,
        description: form.description.trim() || undefined,
        type: form.type.trim() || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        isOnline: form.isOnline,
        location: form.location.trim() || undefined,
        capacity: form.capacity.trim() === '' ? null : Number(form.capacity),
        price: Number(form.price) || 0,
        imageUrl: form.imageUrl.trim() || undefined,
        active: form.active,
      };
      return editing
        ? api(`/events/${editing.id}`, { method: 'PATCH', json: payload })
        : api('/events', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      onSaved();
      toast.success(editing ? L.updated : L.created);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : L.saveError),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error(L.titleRequired);
      return;
    }
    if (!form.startsAt) {
      toast.error(L.startRequired);
      return;
    }
    save.mutate();
  };

  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-navy dark:text-white">
            {editing ? L.editTitle : L.newEvent}
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            {L.formHint}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Field label={L.fTitle} required>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={L.fTitlePh}
              className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </Field>

          <Field label={L.fTitleEn}>
            <Input
              value={form.titleEn}
              onChange={(e) => set('titleEn', e.target.value)}
              placeholder={L.fTitleEnPh}
              className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </Field>

          <Field label={L.fDescription}>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder={L.fDescriptionPh}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={L.fType}>
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={L.fCapacity}>
              <Input
                type="number"
                min={0}
                value={form.capacity}
                onChange={(e) => set('capacity', e.target.value)}
                placeholder={L.fCapacityPh}
                className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={L.fStartsAt} required>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
                className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <Field label={L.fEndsAt}>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
                className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={L.fPrice}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <Field label={L.fLocation}>
              <Input
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder={L.fLocationPh}
                className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>
          </div>

          <Field label={L.fImageUrl}>
            <Input
              value={form.imageUrl}
              onChange={(e) => set('imageUrl', e.target.value)}
              placeholder="https://…"
              className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </Field>

          {/* Checkboxes */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 text-sm text-navy dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isOnline}
                onChange={(e) => set('isOnline', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-950"
              />
              {L.fIsOnline}
            </label>
            <label className="flex items-center gap-2 text-sm text-navy dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-950"
              />
              {L.fActive}
            </label>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {L.cancel}
            </Button>
            <Button type="submit" disabled={save.isPending} className="h-9 rounded-xl">
              {save.isPending ? L.saving : editing ? L.saveEdit : L.saveCreate}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Shared blocks                                                        */
/* ------------------------------------------------------------------ */

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
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <CalendarDays className="h-7 w-7 text-slate-400" />
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
  retry,
  retryLabel,
}: {
  message: string;
  retry: () => void;
  retryLabel: string;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </div>
      <p className="font-semibold text-navy dark:text-white">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={retry}
        className="mt-4 rounded-xl dark:border-slate-700 dark:text-slate-200"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {retryLabel}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const money = (n: number) => `$${Number(n).toFixed(2)}`;

const fmtDate = (d: string, tr: boolean) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(tr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fmtTime = (d: string, tr: boolean) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleTimeString(tr ? 'tr-TR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/* ISO → 'YYYY-MM-DDTHH:mm' (local) for datetime-local inputs */
const toLocalInput = (iso: string) => {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours(),
  )}:${pad(dt.getMinutes())}`;
};

/* Inline i18n (next-intl useLocale) — JSON'a dokunmadan */
function labels(tr: boolean) {
  return {
    title: tr ? 'Etkinlik Yönetimi' : 'Event Management',
    subtitle: tr
      ? 'Seminer, workshop ve buluşmaları oluşturun ve düzenleyin.'
      : 'Create and manage seminars, workshops and meetups.',

    newEvent: tr ? '+ Yeni Etkinlik' : '+ New Event',
    editTitle: tr ? 'Etkinliği Düzenle' : 'Edit Event',
    formHint: tr
      ? 'Etkinlik bilgilerini girin. Yıldızlı alanlar zorunludur.'
      : 'Fill in the event details. Fields marked with * are required.',

    online: tr ? 'Online' : 'Online',
    inPerson: tr ? 'Yüz yüze' : 'In person',
    free: tr ? 'Ücretsiz' : 'Free',
    activeBadge: tr ? 'Aktif' : 'Active',
    inactiveBadge: tr ? 'Pasif' : 'Inactive',

    capacityLine: (reg: number, cap: number) =>
      tr ? `${reg}/${cap} kayıt` : `${reg}/${cap} registered`,
    regOnlyLine: (reg: number) => (tr ? `${reg} kayıt` : `${reg} registered`),
    memberPrice: (p: string) => (tr ? `Üye: ${p}` : `Member: ${p}`),

    edit: tr ? 'Düzenle' : 'Edit',
    delete: tr ? 'Sil' : 'Delete',
    confirmDelete: (t: string) =>
      tr ? `"${t}" etkinliğini silmek istiyor musunuz?` : `Delete event "${t}"?`,

    fTitle: tr ? 'Başlık' : 'Title',
    fTitlePh: tr ? 'Etkinlik başlığı' : 'Event title',
    fTitleEn: tr ? 'Başlık (EN)' : 'Title (EN)',
    fTitleEnPh: tr ? 'İngilizce başlık' : 'English title',
    fDescription: tr ? 'Açıklama' : 'Description',
    fDescriptionPh: tr ? 'Etkinlik açıklaması…' : 'Event description…',
    fType: tr ? 'Tür' : 'Type',
    fStartsAt: tr ? 'Başlangıç' : 'Starts at',
    fEndsAt: tr ? 'Bitiş' : 'Ends at',
    fIsOnline: tr ? 'Online etkinlik' : 'Online event',
    fLocation: tr ? 'Konum' : 'Location',
    fLocationPh: tr ? 'Adres veya bağlantı' : 'Address or link',
    fCapacity: tr ? 'Kontenjan' : 'Capacity',
    fCapacityPh: tr ? 'Sınırsız' : 'Unlimited',
    fPrice: tr ? 'Fiyat' : 'Price',
    fImageUrl: tr ? 'Görsel URL' : 'Image URL',
    fActive: tr ? 'Aktif' : 'Active',

    cancel: tr ? 'Vazgeç' : 'Cancel',
    saving: tr ? 'Kaydediliyor…' : 'Saving…',
    saveCreate: tr ? 'Oluştur' : 'Create',
    saveEdit: tr ? 'Kaydet' : 'Save',
    titleRequired: tr ? 'Başlık zorunludur' : 'Title is required',
    startRequired: tr ? 'Başlangıç tarihi zorunludur' : 'Start date is required',

    created: tr ? 'Etkinlik oluşturuldu' : 'Event created',
    updated: tr ? 'Etkinlik güncellendi' : 'Event updated',
    deleted: tr ? 'Etkinlik silindi' : 'Event deleted',
    saveError: tr ? 'İşlem başarısız' : 'Operation failed',

    emptyTitle: tr ? 'Henüz etkinlik yok' : 'No events yet',
    emptyDesc: tr
      ? 'İlk etkinliğinizi oluşturmak için "Yeni Etkinlik" butonuna tıklayın.'
      : 'Click "New Event" to create your first event.',

    loadError: tr ? 'Etkinlikler yüklenemedi' : 'Failed to load events',
    retry: tr ? 'Tekrar dene' : 'Try again',
  };
}
