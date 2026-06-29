'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import {
  Search,
  Building2,
  Globe,
  Users,
  Palette,
  CheckCircle2,
  XCircle,
  Hash,
  Calendar,
  Mail,
  ShieldCheck,
  FileText,
  ChevronRight,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { StatCard } from '@/components/stat-card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/skeletons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// ─────────────────────────────────────────────
// Tipler — backend Organization modeli (Prisma) ile hizalı
// ─────────────────────────────────────────────

type OrgUserRole = 'USER' | 'TEAM_MEMBER' | 'TEAM_LEADER' | 'ADMIN' | 'PRODUCTION';

type OrgUser = {
  id: string;
  email: string;
  role: OrgUserRole;
  fullName: string | null;
};

type OrgTheme = {
  primary?: string;
  color?: string;
  logo?: string;
  logoUrl?: string;
  hero?: string;
  [key: string]: unknown;
};

type Organization = {
  id: string;
  name: string;
  slug: string | null;
  theme: OrgTheme | null;
  taxInfo: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // GET /organizations/:id detayında gelir (liste yanıtında olmayabilir)
  users?: OrgUser[];
  _count?: { users?: number };
};

const ROLE_BADGE: Record<OrgUserRole, string> = {
  USER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  TEAM_MEMBER: 'bg-blue-50 text-primary dark:bg-blue-500/15 dark:text-blue-300',
  TEAM_LEADER: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  ADMIN: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  PRODUCTION: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
};

// Tema renk paletinden birincil rengi türet (string ya da nesne olabilir)
function themeColor(theme: OrgTheme | null): string | null {
  if (!theme) return null;
  const c = theme.primary ?? theme.color;
  if (typeof c === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(c)) {
    return c.startsWith('#') ? c : `#${c}`;
  }
  return null;
}

function memberCount(org: Organization): number | null {
  if (typeof org._count?.users === 'number') return org._count.users;
  if (Array.isArray(org.users)) return org.users.length;
  return null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

// ─────────────────────────────────────────────
// Sayfa
// ─────────────────────────────────────────────

export default function AdminOrganizationsPage() {
  const tr = useLocale() === 'tr';
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => api<Organization[]>('/organizations'),
  });

  const orgs = data ?? [];

  const rows = useMemo(() => {
    if (!q.trim()) return orgs;
    const s = q.trim().toLowerCase();
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(s) ||
        (o.slug ?? '').toLowerCase().includes(s) ||
        (o.taxInfo ?? '').toLowerCase().includes(s),
    );
  }, [orgs, q]);

  const total = orgs.length;
  const activeCount = orgs.filter((o) => o.active).length;
  const themedCount = orgs.filter((o) => themeColor(o.theme) || o.theme).length;
  const membersKnown = orgs.reduce((acc, o) => acc + (memberCount(o) ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy dark:text-white">
            {tr ? 'Bayi Firmaları' : 'Dealer Organizations'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {tr
              ? 'Platformdaki tüm bayi firmalarını görüntüleyin ve detaylarını inceleyin.'
              : 'Browse every dealer organization on the platform and inspect its details.'}
          </p>
        </div>
        {!isLoading && (
          <Badge className="bg-blue-50 text-primary border-0 dark:bg-blue-500/15 dark:text-blue-300">
            {total} {tr ? 'firma' : 'orgs'}
          </Badge>
        )}
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={tr ? 'Toplam Firma' : 'Total Orgs'}
          value={isLoading ? '…' : total}
          icon={Building2}
          accent="primary"
        />
        <StatCard
          label={tr ? 'Aktif' : 'Active'}
          value={isLoading ? '…' : activeCount}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label={tr ? 'Markalı Tema' : 'Branded Themes'}
          value={isLoading ? '…' : themedCount}
          icon={Palette}
          accent="amber"
        />
        <StatCard
          label={tr ? 'Toplam Üye' : 'Total Members'}
          value={isLoading ? '…' : membersKnown}
          icon={Users}
          accent="navy"
        />
      </div>

      {/* Arama */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr ? 'Ad, subdomain veya vergi bilgisi ara…' : 'Search name, subdomain or tax info…'}
          className="pl-9 bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-white"
        />
      </div>

      {/* Liste */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Tablo başlığı (md+) */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          <div className="col-span-4">{tr ? 'Firma' : 'Organization'}</div>
          <div className="col-span-3">{tr ? 'Subdomain' : 'Subdomain'}</div>
          <div className="col-span-2">{tr ? 'Üyeler' : 'Members'}</div>
          <div className="col-span-2">{tr ? 'Durum' : 'Status'}</div>
          <div className="col-span-1 text-right">{tr ? 'Tarih' : 'Date'}</div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : isError ? (
          <ErrorState
            tr={tr}
            message={error instanceof ApiError ? error.message : undefined}
            onRetry={() => refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState tr={tr} hasQuery={!!q.trim()} onClear={() => setQ('')} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((o) => {
              const color = themeColor(o.theme);
              const members = memberCount(o);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedId(o.id)}
                  className="w-full text-left grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  {/* Firma */}
                  <div className="md:col-span-4 min-w-0 flex items-center gap-3">
                    <div
                      className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-xs font-semibold text-white"
                      style={{ background: color ?? undefined }}
                    >
                      {!color && (
                        <span className="h-full w-full rounded-xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center">
                          {initials(o.name) || <Building2 className="h-4 w-4" />}
                        </span>
                      )}
                      {color && (initials(o.name) || <Building2 className="h-4 w-4" />)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-navy dark:text-white text-sm truncate">
                        {o.name}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                        {o.taxInfo
                          ? o.taxInfo
                          : tr
                            ? 'Vergi bilgisi yok'
                            : 'No tax info'}
                      </div>
                    </div>
                  </div>

                  {/* Subdomain */}
                  <div className="md:col-span-3 min-w-0">
                    {o.slug ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 max-w-full">
                        <Globe className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{o.slug}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 dark:text-slate-600">
                        {tr ? '— atanmamış' : '— unassigned'}
                      </span>
                    )}
                  </div>

                  {/* Üyeler */}
                  <div className="md:col-span-2 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {members != null ? members : '—'}
                  </div>

                  {/* Durum */}
                  <div className="md:col-span-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${
                        o.active
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                      }`}
                    >
                      {o.active ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {o.active
                        ? tr
                          ? 'Aktif'
                          : 'Active'
                        : tr
                          ? 'Pasif'
                          : 'Inactive'}
                    </span>
                  </div>

                  {/* Tarih + ok */}
                  <div className="md:col-span-1 flex items-center justify-end gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                    <span className="hidden md:inline">{shortDate(o.createdAt)}</span>
                    <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Alt bilgi çubuğu */}
        {!isLoading && !isError && rows.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>
              {rows.length} / {total} {tr ? 'firma gösteriliyor' : 'organizations shown'}
            </span>
            {isFetching && <span>{tr ? 'Yenileniyor…' : 'Refreshing…'}</span>}
          </div>
        )}
      </div>

      {/* Detay diyaloğu */}
      <OrgDetailDialog
        tr={tr}
        id={selectedId}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Detay diyaloğu — GET /organizations/:id
// ─────────────────────────────────────────────

function OrgDetailDialog({
  id,
  open,
  onClose,
  tr,
}: {
  id: string | null;
  open: boolean;
  onClose: () => void;
  tr: boolean;
}) {
  const { data: org, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'organizations', id],
    queryFn: () => api<Organization>(`/organizations/${id}`),
    enabled: !!id && open,
  });

  const color = themeColor(org?.theme ?? null);
  const members = org?.users ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {org?.name ?? (tr ? 'Firma detayı' : 'Organization detail')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {tr ? 'Bayi firma detayları' : 'Dealer organization details'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <DialogLoading />
        ) : isError || !org ? (
          <div className="py-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
            <p className="mt-2 text-sm font-semibold text-navy dark:text-white">
              {tr ? 'Firma yüklenemedi' : 'Could not load organization'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {error instanceof ApiError
                ? error.message
                : tr
                  ? 'Bilinmeyen hata'
                  : 'Unknown error'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Üst kimlik */}
            <div className="flex items-start gap-4 pr-8">
              <div
                className="h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center text-base font-semibold text-white shadow-lg shadow-blue-500/20"
                style={{ background: color ?? undefined }}
              >
                {!color ? (
                  <span className="h-full w-full rounded-2xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center">
                    {initials(org.name) || <Building2 className="h-6 w-6" />}
                  </span>
                ) : (
                  initials(org.name) || <Building2 className="h-6 w-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-navy dark:text-white leading-tight truncate">
                  {org.name}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                      org.active
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                    }`}
                  >
                    {org.active ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {org.active
                      ? tr
                        ? 'Aktif'
                        : 'Active'
                      : tr
                        ? 'Pasif'
                        : 'Inactive'}
                  </span>
                  {org.slug && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <Globe className="h-3 w-3 text-slate-400" />
                      {org.slug}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Meta ızgarası */}
            <div className="grid grid-cols-2 gap-3">
              <MetaItem
                icon={Hash}
                label={tr ? 'Firma ID' : 'Org ID'}
                value={<span className="font-mono text-[11px] break-all">{org.id}</span>}
              />
              <MetaItem
                icon={Link2}
                label={tr ? 'Subdomain' : 'Subdomain'}
                value={org.slug ?? (tr ? 'Atanmamış' : 'Unassigned')}
              />
              <MetaItem
                icon={FileText}
                label={tr ? 'Vergi Bilgisi' : 'Tax Info'}
                value={org.taxInfo ?? (tr ? 'Belirtilmemiş' : 'Not set')}
              />
              <MetaItem
                icon={Users}
                label={tr ? 'Üye Sayısı' : 'Members'}
                value={String(members.length || memberCount(org) || 0)}
              />
              <MetaItem
                icon={Calendar}
                label={tr ? 'Oluşturma' : 'Created'}
                value={shortDate(org.createdAt)}
              />
              <MetaItem
                icon={Calendar}
                label={tr ? 'Güncelleme' : 'Updated'}
                value={shortDate(org.updatedAt)}
              />
            </div>

            {/* Tema önizleme */}
            {org.theme && (
              <div>
                <SectionLabel icon={Palette} text={tr ? 'Marka Teması' : 'Brand Theme'} />
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 p-3">
                  <div
                    className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                    style={{ background: color ?? 'transparent' }}
                  />
                  <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
                    {color ? (
                      <span className="font-mono text-slate-700 dark:text-slate-200">{color}</span>
                    ) : (
                      <span>{tr ? 'Renk değeri okunamadı' : 'No readable color value'}</span>
                    )}
                    <div className="mt-0.5 truncate">
                      {Object.keys(org.theme).length}{' '}
                      {tr ? 'tema anahtarı tanımlı' : 'theme keys defined'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Üyeler */}
            <div>
              <SectionLabel
                icon={Users}
                text={`${tr ? 'Üyeler' : 'Members'} (${members.length})`}
              />
              {members.length === 0 ? (
                <div className="mt-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-xs text-slate-400">
                  {tr ? 'Bu firmaya bağlı üye yok.' : 'No members linked to this organization.'}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {members.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2"
                    >
                      <div className="h-8 w-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                        {(u.fullName || u.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-navy dark:text-white truncate">
                          {u.fullName || (tr ? 'İsimsiz' : 'Unnamed')}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </div>
                      </div>
                      <Badge className={`${ROLE_BADGE[u.role]} border-0 shrink-0`}>
                        {u.role === 'ADMIN' && <ShieldCheck className="h-3 w-3 mr-1" />}
                        {roleLabel(u.role, tr)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Yardımcı parçalar
// ─────────────────────────────────────────────

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm text-navy dark:text-white break-words">{value}</div>
    </div>
  );
}

function SectionLabel({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
      <Icon className="h-3.5 w-3.5" />
      {text}
    </div>
  );
}

function DialogLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  tr,
  hasQuery,
  onClear,
}: {
  tr: boolean;
  hasQuery: boolean;
  onClear: () => void;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Building2 className="h-7 w-7 text-slate-400" />
      </div>
      <p className="font-semibold text-navy dark:text-white">
        {hasQuery
          ? tr
            ? 'Eşleşen firma yok'
            : 'No matching organizations'
          : tr
            ? 'Henüz firma yok'
            : 'No organizations yet'}
      </p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
        {hasQuery
          ? tr
            ? 'Aramanızı değiştirmeyi deneyin.'
            : 'Try adjusting your search query.'
          : tr
            ? 'Yeni bayi firmaları kaydolduğunda burada listelenir.'
            : 'Organizations will appear here once dealers register.'}
      </p>
      {hasQuery && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
        >
          {tr ? 'Aramayı temizle' : 'Clear search'}
        </button>
      )}
    </div>
  );
}

function ErrorState({
  tr,
  message,
  onRetry,
}: {
  tr: boolean;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/15 flex items-center justify-center mb-4">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </div>
      <p className="font-semibold text-navy dark:text-white">
        {tr ? 'Firmalar yüklenemedi' : 'Could not load organizations'}
      </p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
        {message ?? (tr ? 'Bir hata oluştu.' : 'Something went wrong.')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
      >
        {tr ? 'Tekrar dene' : 'Retry'}
      </button>
    </div>
  );
}

function roleLabel(role: OrgUserRole, tr: boolean): string {
  const map: Record<OrgUserRole, [string, string]> = {
    USER: ['Kullanıcı', 'User'],
    TEAM_MEMBER: ['Ekip Üyesi', 'Team Member'],
    TEAM_LEADER: ['Ekip Lideri', 'Team Leader'],
    ADMIN: ['Yönetici', 'Admin'],
    PRODUCTION: ['Üretim', 'Production'],
  };
  return tr ? map[role][0] : map[role][1];
}
