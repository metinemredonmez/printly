'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Network,
  Search,
  Globe,
  MapPin,
  Building2,
  Pencil,
  Plus,
  X,
  ExternalLink,
  UserCircle,
  Loader2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface NetworkProfile {
  id: string;
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  company?: string | null;
  website?: string | null;
  location?: string | null;
  expertise: string[];
  createdAt: string;
  visible?: boolean;
}

interface ProfileForm {
  displayName: string;
  headline: string;
  company: string;
  location: string;
  website: string;
  bio: string;
  expertise: string;
  visible: boolean;
}

const EMPTY_FORM: ProfileForm = {
  displayName: '',
  headline: '',
  company: '',
  location: '',
  website: '',
  bio: '',
  expertise: '',
  visible: true,
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function NetworkPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);
  const qc = useQueryClient();

  /* --- Search (debounced) --- */
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* --- My profile --- */
  const meQ = useQuery({
    queryKey: ['network', 'me'],
    queryFn: () => api<NetworkProfile | null>('/network/me'),
  });

  /* --- Directory --- */
  const dirQ = useQuery({
    queryKey: ['network', 'dir', q],
    queryFn: () =>
      api<NetworkProfile[]>('/network?q=' + encodeURIComponent(q)),
  });

  /* --- Edit dialog --- */
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);

  const openEditor = () => {
    const me = meQ.data;
    setForm(
      me
        ? {
            displayName: me.displayName ?? '',
            headline: me.headline ?? '',
            company: me.company ?? '',
            location: me.location ?? '',
            website: me.website ?? '',
            bio: me.bio ?? '',
            expertise: (me.expertise ?? []).join(', '),
            visible: me.visible ?? true,
          }
        : EMPTY_FORM,
    );
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () =>
      api('/network/me', {
        method: 'PUT',
        json: {
          displayName: form.displayName.trim(),
          headline: form.headline.trim() || undefined,
          company: form.company.trim() || undefined,
          location: form.location.trim() || undefined,
          website: form.website.trim() || undefined,
          bio: form.bio.trim() || undefined,
          expertise: form.expertise
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          visible: form.visible,
        },
      }),
    onSuccess: () => {
      toast.success(L.saved);
      qc.invalidateQueries({ queryKey: ['network', 'me'] });
      qc.invalidateQueries({ queryKey: ['network', 'dir'] });
      setOpen(false);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : L.saveError);
    },
  });

  const me = meQ.data;
  const members = dirQ.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-navy dark:text-white flex items-center gap-2">
          <Network className="h-6 w-6 text-primary" />
          {L.title}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {L.subtitle}
        </p>
      </div>

      {/* My profile card */}
      {meQ.isLoading ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 h-[140px] animate-pulse dark:bg-slate-900 dark:border-slate-800" />
      ) : meQ.isError ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {meQ.error instanceof Error ? meQ.error.message : L.loadError}
          </p>
        </div>
      ) : !me ? (
        /* Soft CTA — no profile yet */
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UserCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-navy dark:text-white">
                  {L.ctaTitle}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {L.ctaDesc}
                </p>
              </div>
            </div>
            <Button
              onClick={openEditor}
              className="h-9 rounded-xl bg-primary text-white hover:bg-primary/80 shrink-0"
            >
              <Plus className="h-4 w-4" />
              {L.createProfile}
            </Button>
          </div>
        </div>
      ) : (
        /* Existing profile */
        <div className="rounded-3xl border border-slate-100 bg-white p-6 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <Avatar name={me.displayName} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-navy dark:text-white truncate">
                    {me.displayName}
                  </h2>
                  <Badge
                    variant={me.visible ? 'default' : 'secondary'}
                    className={
                      me.visible
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }
                  >
                    {me.visible ? L.visible : L.hidden}
                  </Badge>
                </div>
                {me.headline && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                    {me.headline}
                  </p>
                )}
                <Meta company={me.company} location={me.location} />
                {me.expertise.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {me.expertise.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="bg-primary/10 text-primary dark:bg-primary/15"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {me.website && (
                  <a
                    href={normalizeUrl(me.website)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {prettyUrl(me.website)}
                  </a>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={openEditor}
              className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200 shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              {L.edit}
            </Button>
          </div>
        </div>
      )}

      {/* Directory */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-navy dark:text-white">
            {L.directory}
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={L.searchPlaceholder}
              className="h-9 pl-9 w-full rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
          </div>
        </div>

        {dirQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-slate-100 bg-white p-5 h-[180px] animate-pulse dark:bg-slate-900 dark:border-slate-800"
              />
            ))}
          </div>
        ) : dirQ.isError ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center dark:bg-slate-900 dark:border-slate-800">
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {dirQ.error instanceof Error ? dirQ.error.message : L.loadError}
            </p>
            <Button
              variant="outline"
              onClick={() => dirQ.refetch()}
              className="mt-4 h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {L.retry}
            </Button>
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-white px-5 py-16 text-center dark:bg-slate-900 dark:border-slate-800">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Network className="h-7 w-7 text-slate-400" />
            </div>
            <p className="font-semibold text-navy dark:text-white">
              {q ? L.noMatchTitle : L.emptyTitle}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              {q ? L.noMatchDesc : L.emptyDesc}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <MemberCard key={m.id} member={m} L={L} />
            ))}
          </div>
        )}
      </div>

      {/* Edit / Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dark:bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-navy dark:text-white">
              <UserCircle className="h-5 w-5 text-primary" />
              {me ? L.editTitle : L.createTitle}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {L.formDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <Field label={L.fDisplayName} required>
              <Input
                value={form.displayName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayName: e.target.value }))
                }
                placeholder={L.phDisplayName}
                className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <Field label={L.fHeadline}>
              <Input
                value={form.headline}
                onChange={(e) =>
                  setForm((f) => ({ ...f, headline: e.target.value }))
                }
                placeholder={L.phHeadline}
                className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={L.fCompany}>
                <Input
                  value={form.company}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, company: e.target.value }))
                  }
                  placeholder={L.phCompany}
                  className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              </Field>
              <Field label={L.fLocation}>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                  placeholder={L.phLocation}
                  className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              </Field>
            </div>

            <Field label={L.fWebsite}>
              <Input
                value={form.website}
                onChange={(e) =>
                  setForm((f) => ({ ...f, website: e.target.value }))
                }
                placeholder={L.phWebsite}
                className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <Field label={L.fBio}>
              <textarea
                value={form.bio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bio: e.target.value }))
                }
                placeholder={L.phBio}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-navy outline-none resize-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-slate-950 dark:border-slate-700 dark:text-white placeholder:text-slate-400"
              />
            </Field>

            <Field label={L.fExpertise} hint={L.expertiseHint}>
              <Input
                value={form.expertise}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expertise: e.target.value }))
                }
                placeholder={L.phExpertise}
                className="h-9 rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white"
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300 pt-1">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(e) =>
                  setForm((f) => ({ ...f, visible: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary accent-[var(--color-primary,#2563eb)]"
              />
              <span>{L.visibleHint}</span>
            </label>
          </div>

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={save.isPending}
              className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              <X className="h-4 w-4" />
              {L.cancel}
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.displayName.trim()}
              className="h-9 rounded-xl bg-primary text-white hover:bg-primary/80"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {L.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function MemberCard({
  member,
  L,
}: {
  member: NetworkProfile;
  L: ReturnType<typeof labels>;
}) {
  const extra = Math.max(0, member.expertise.length - 4);
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 hover:shadow-lg transition-shadow dark:bg-slate-900 dark:border-slate-800 dark:hover:shadow-black/20 flex flex-col">
      <div className="flex items-start gap-3">
        <Avatar name={member.displayName} className="h-11 w-11" />
        <div className="min-w-0">
          <p className="font-semibold text-navy dark:text-white truncate">
            {member.displayName}
          </p>
          {member.headline && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
              {member.headline}
            </p>
          )}
        </div>
      </div>

      <Meta company={member.company} location={member.location} />

      {member.expertise.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {member.expertise.slice(0, 4).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="bg-primary/10 text-primary dark:bg-primary/15"
            >
              {tag}
            </Badge>
          ))}
          {extra > 0 && (
            <Badge
              variant="secondary"
              className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              +{extra}
            </Badge>
          )}
        </div>
      )}

      {member.website && (
        <a
          href={normalizeUrl(member.website)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {L.visitWebsite}
        </a>
      )}
    </div>
  );
}

function Meta({
  company,
  location,
}: {
  company?: string | null;
  location?: string | null;
}) {
  if (!company && !location) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
      {company && (
        <span className="inline-flex items-center gap-1 min-w-0">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{company}</span>
        </span>
      )}
      {location && (
        <span className="inline-flex items-center gap-1 min-w-0">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{location}</span>
        </span>
      )}
    </div>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  const letter = name?.trim()?.[0]?.toUpperCase();
  return (
    <div
      className={`rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0 ${className ?? 'h-11 w-11'}`}
    >
      {letter ?? <UserCircle className="h-5 w-5" />}
    </div>
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
    <div>
      <label className="text-xs font-medium text-navy dark:text-slate-200">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function prettyUrl(url: string) {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/* Inline i18n (next-intl useLocale) — JSON'a dokunmadan */
function labels(tr: boolean) {
  return {
    title: 'Networking',
    subtitle: tr
      ? 'Güçlü iş ağına katıl, iş birlikleri geliştir.'
      : 'Join a strong business network and grow partnerships.',

    // My profile
    visible: tr ? 'Görünür' : 'Visible',
    hidden: tr ? 'Gizli' : 'Hidden',
    edit: tr ? 'Düzenle' : 'Edit',

    // CTA
    ctaTitle: tr
      ? 'Profil oluştur ve ağda görün'
      : 'Create a profile to appear in the network',
    ctaDesc: tr
      ? 'Ekip Üyesi için ücretsiz — profilini paylaş, doğru iş ortaklarıyla tanış.'
      : 'Free for Team Members — share your profile and meet the right partners.',
    createProfile: tr ? 'Profil Oluştur' : 'Create Profile',

    // Directory
    directory: tr ? 'İş Ağı Rehberi' : 'Business Directory',
    searchPlaceholder: tr ? 'İsim, şirket, uzmanlık ara…' : 'Search name, company, skill…',
    visitWebsite: tr ? 'Web sitesi' : 'Visit website',
    emptyTitle: tr ? 'Henüz üye yok' : 'No members yet',
    emptyDesc: tr
      ? 'İlk profili sen oluştur ve iş ağını büyütmeye başla.'
      : 'Be the first to create a profile and start growing the network.',
    noMatchTitle: tr ? 'Sonuç bulunamadı' : 'No results found',
    noMatchDesc: tr
      ? 'Farklı bir arama terimi deneyin.'
      : 'Try a different search term.',

    loadError: tr ? 'Yüklenemedi' : 'Failed to load',
    retry: tr ? 'Tekrar dene' : 'Try again',

    // Dialog
    createTitle: tr ? 'Profil Oluştur' : 'Create Profile',
    editTitle: tr ? 'Profili Düzenle' : 'Edit Profile',
    formDesc: tr
      ? 'Bilgilerin iş ağı rehberinde görünür.'
      : 'Your details appear in the business directory.',
    fDisplayName: tr ? 'Görünen ad' : 'Display name',
    phDisplayName: tr ? 'Ör. Ahmet Yılmaz' : 'e.g. John Doe',
    fHeadline: tr ? 'Başlık' : 'Headline',
    phHeadline: tr ? 'Ör. Duvar kağıdı üreticisi' : 'e.g. Wallpaper manufacturer',
    fCompany: tr ? 'Şirket' : 'Company',
    phCompany: tr ? 'Şirket adı' : 'Company name',
    fLocation: tr ? 'Konum' : 'Location',
    phLocation: tr ? 'Şehir, Ülke' : 'City, Country',
    fWebsite: tr ? 'Web sitesi' : 'Website',
    phWebsite: 'example.com',
    fBio: tr ? 'Hakkında' : 'Bio',
    phBio: tr
      ? 'Kendinden ve işinden kısaca bahset…'
      : 'A short note about you and your work…',
    fExpertise: tr ? 'Uzmanlık' : 'Expertise',
    expertiseHint: tr
      ? 'Virgülle ayırın. Ör. Baskı, Tasarım, Lojistik'
      : 'Comma separated. e.g. Printing, Design, Logistics',
    phExpertise: tr ? 'Baskı, Tasarım, Lojistik' : 'Printing, Design, Logistics',
    visibleHint: tr
      ? 'Profilim iş ağı rehberinde görünsün.'
      : 'Show my profile in the business directory.',

    cancel: tr ? 'Vazgeç' : 'Cancel',
    save: tr ? 'Kaydet' : 'Save',
    saved: tr ? 'Profil kaydedildi' : 'Profile saved',
    saveError: tr ? 'Profil kaydedilemedi' : 'Failed to save profile',
  };
}
