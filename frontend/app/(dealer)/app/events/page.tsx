'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  Video,
  Check,
  Sparkles,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface EventItem {
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
  yourPrice: number;
  isMember: boolean;
  imageUrl?: string;
  registeredCount: number;
  spotsLeft: number | null;
  registered: boolean;
  active: boolean;
}

type Tab = 'upcoming' | 'all';

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function EventsPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('upcoming');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['events'],
    queryFn: () => api<EventItem[]>('/events'),
  });

  const registrations = useQuery({
    queryKey: ['events', 'me'],
    queryFn: () => api<EventItem[]>('/events/me/registrations'),
  });

  const register = useMutation({
    mutationFn: (id: string) => api(`/events/${id}/register`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['events', 'me'] });
      toast.success(L.registered);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : L.registerError),
  });

  const all = data ?? [];
  const now = Date.now();

  const events = useMemo(() => {
    const list =
      tab === 'upcoming'
        ? all.filter((e) => new Date(e.startsAt).getTime() >= now)
        : all;
    return [...list].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }, [all, tab, now]);

  const registeredCount = registrations.data?.length ?? 0;
  const isMember = all.some((e) => e.isMember);
  const showMemberPill = all.length > 0 && !isMember;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy dark:text-white">{L.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{L.subtitle}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-navy dark:text-slate-200">
          <Check className="h-4 w-4 text-primary" />
          {L.registeredStat(registeredCount)}
        </div>
      </div>

      {/* Member info pill */}
      {showMemberPill && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-accent/20 bg-brand-accent/5 px-4 py-3 dark:border-brand-accent/20 dark:bg-brand-accent/10">
          <Sparkles className="h-5 w-5 text-brand-accent shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-300">{L.memberHint}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800">
        {(['upcoming', 'all'] as Tab[]).map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                on
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy dark:hover:text-white'
              }`}
            >
              {t === 'upcoming' ? L.tabUpcoming : L.tabAll}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-slate-100 bg-white h-80 animate-pulse dark:bg-slate-900 dark:border-slate-800"
            />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              tr={tr}
              L={L}
              onRegister={() => register.mutate(ev.id)}
              registering={register.isPending && register.variables === ev.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function EventCard({
  event: ev,
  tr,
  L,
  onRegister,
  registering,
}: {
  event: EventItem;
  tr: boolean;
  L: ReturnType<typeof labels>;
  onRegister: () => void;
  registering: boolean;
}) {
  const title = !tr && ev.titleEn ? ev.titleEn : ev.title;
  const full = ev.spotsLeft === 0;
  const free = !(ev.price > 0);

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden hover:shadow-lg transition-shadow dark:hover:shadow-black/20">
      {/* Image / fallback */}
      {ev.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ev.imageUrl}
          alt={title}
          className="h-32 w-full object-cover"
        />
      ) : (
        <div className="h-32 w-full bg-gradient-to-br from-primary/10 via-brand-accent/10 to-primary/5 dark:from-primary/20 dark:via-brand-accent/15 dark:to-slate-900 flex items-center justify-center">
          <CalendarDays className="h-9 w-9 text-primary/50" />
        </div>
      )}

      <div className="flex flex-col flex-1 p-5">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {ev.type && (
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-navy dark:text-slate-200 capitalize">
              {ev.type}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              ev.isOnline
                ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
            }`}
          >
            {ev.isOnline ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
            {ev.isOnline ? L.online : L.inPerson}
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-2.5 text-base font-semibold text-navy dark:text-white leading-snug">
          {title}
        </h3>

        {/* Date + time */}
        <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span>{fmtDate(ev.startsAt, tr)}</span>
          <Clock className="h-4 w-4 shrink-0 ml-1" />
          <span>{fmtTime(ev.startsAt, tr)}</span>
        </div>

        {/* Location */}
        {ev.location && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{ev.location}</span>
          </div>
        )}

        {/* Capacity */}
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span>
            {ev.spotsLeft != null && ev.capacity != null
              ? L.capacityLine(ev.capacity, ev.spotsLeft)
              : L.unlimited}
          </span>
        </div>

        {/* Price */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {free ? (
            <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
              {L.free}
            </span>
          ) : (
            <>
              {ev.yourPrice < ev.price && (
                <span className="text-sm text-slate-400 dark:text-slate-500 line-through">
                  {money(ev.price)}
                </span>
              )}
              <span className="text-base font-semibold text-primary">
                {money(ev.yourPrice)}
              </span>
              {ev.isMember && (
                <span className="inline-flex items-center rounded-full bg-brand-accent/10 px-2 py-0.5 text-[11px] font-semibold text-brand-accent">
                  {L.memberBadge}
                </span>
              )}
            </>
          )}
        </div>

        {/* Action */}
        <div className="mt-4 pt-1 flex-1 flex items-end">
          {ev.registered ? (
            <Button
              variant="outline"
              disabled
              className="w-full h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              <Check className="h-4 w-4" />
              {L.registeredBtn}
            </Button>
          ) : full ? (
            <Button
              disabled
              className="w-full h-9 rounded-xl"
            >
              {L.fullBtn}
            </Button>
          ) : (
            <Button
              onClick={onRegister}
              disabled={registering}
              className="w-full h-9 rounded-xl"
            >
              {registering ? L.registering : L.registerBtn}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared blocks                                                        */
/* ------------------------------------------------------------------ */

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl px-5 py-16 text-center">
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
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl px-5 py-16 text-center">
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

/* Inline i18n (next-intl useLocale) — JSON'a dokunmadan */
function labels(tr: boolean) {
  return {
    title: tr ? 'Etkinlikler' : 'Events',
    subtitle: tr
      ? 'Seminer, workshop ve buluşmalar — Ekip Üyeleri tüm ücretli etkinliklerde %50 indirimli.'
      : 'Seminars, workshops and meetups — Team Members get 50% off all paid events.',

    memberHint: tr
      ? 'Ekip Üyesi olduğunuzda ücretli etkinliklerde %50 indirim kazanırsınız.'
      : 'Become a Team Member to get 50% off all paid events.',

    registeredStat: (n: number) => (tr ? `Kayıtlı: ${n}` : `Registered: ${n}`),

    tabUpcoming: tr ? 'Yaklaşan' : 'Upcoming',
    tabAll: tr ? 'Tümü' : 'All',

    online: tr ? 'Online' : 'Online',
    inPerson: tr ? 'Yüz yüze' : 'In person',

    capacityLine: (cap: number, left: number) =>
      tr
        ? `${cap} kişilik kontenjan · ${left} kaldı`
        : `${cap} spots · ${left} left`,
    unlimited: tr ? 'Sınırsız kontenjan' : 'Unlimited',

    free: tr ? 'Ücretsiz' : 'Free',
    memberBadge: tr ? '%50 üye' : '50% member',

    registeredBtn: tr ? 'Kayıtlısın' : 'Registered',
    fullBtn: tr ? 'Kontenjan dolu' : 'Full',
    registerBtn: tr ? 'Kayıt ol' : 'Register',
    registering: tr ? 'Kaydediliyor…' : 'Registering…',
    registered: tr ? 'Etkinliğe kayıt olundu' : 'Registered for the event',
    registerError: tr ? 'Kayıt yapılamadı' : 'Could not register',

    emptyTitle: tr ? 'Henüz etkinlik yok' : 'No events yet',
    emptyDesc: tr
      ? 'Yeni etkinlikler açıldığında burada görünecek.'
      : 'New events will appear here once they are scheduled.',

    loadError: tr ? 'Etkinlikler yüklenemedi' : 'Failed to load events',
    retry: tr ? 'Tekrar dene' : 'Try again',
  };
}
