'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  KeyRound,
  Mail,
  CreditCard,
  Bell,
  MessageSquare,
  Store,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/skeletons';

/* ------------------------------------------------------------------ */
/* Types & field schema                                                */
/* ------------------------------------------------------------------ */

type FieldKind = 'text' | 'number' | 'secret';

interface Field {
  name: string;
  kind: FieldKind;
  label: { tr: string; en: string };
  placeholder?: string;
}

interface Group {
  key: string;
  icon: LucideIcon;
  title: { tr: string; en: string };
  hint?: { tr: string; en: string };
  fields: Field[];
}

/** Secret alanlar GET'te bu maske ile gelir — değiştirilmezse geri gönderilir, backend mevcut değeri korur. */
const MASK = '••••••••';

/* Tüm gruplar — her biri tek bir settings key'ini düzenler. */
const GROUPS: Group[] = [
  {
    key: 'googleOAuth',
    icon: KeyRound,
    title: { tr: 'Google Girişi', en: 'Google Sign-In' },
    fields: [
      { name: 'clientId', kind: 'text', label: { tr: 'Client ID', en: 'Client ID' } },
      { name: 'clientSecret', kind: 'secret', label: { tr: 'Client Secret', en: 'Client Secret' } },
    ],
  },
  {
    key: 'smtp',
    icon: Mail,
    title: { tr: 'E-posta / SMTP', en: 'Email / SMTP' },
    hint: {
      tr: 'SMTP girilince gerçek doğrulama e-postaları gönderilir.',
      en: 'Once SMTP is set, real verification emails are sent.',
    },
    fields: [
      { name: 'host', kind: 'text', label: { tr: 'Sunucu (Host)', en: 'Host' }, placeholder: 'smtp.example.com' },
      { name: 'port', kind: 'number', label: { tr: 'Port', en: 'Port' }, placeholder: '587' },
      { name: 'user', kind: 'text', label: { tr: 'Kullanıcı Adı', en: 'Username' } },
      { name: 'pass', kind: 'secret', label: { tr: 'Şifre', en: 'Password' } },
      { name: 'from', kind: 'text', label: { tr: 'Gönderen Adresi', en: 'From Address' }, placeholder: 'no-reply@example.com' },
    ],
  },
  {
    key: 'etsy',
    icon: Store,
    title: { tr: 'Etsy', en: 'Etsy' },
    fields: [
      { name: 'apiKey', kind: 'secret', label: { tr: 'API Anahtarı', en: 'API Key' } },
      { name: 'sharedSecret', kind: 'secret', label: { tr: 'Paylaşılan Sır', en: 'Shared Secret' } },
    ],
  },
  {
    key: 'quickbooks',
    icon: ShieldCheck,
    title: { tr: 'QuickBooks', en: 'QuickBooks' },
    fields: [
      { name: 'clientId', kind: 'text', label: { tr: 'Client ID', en: 'Client ID' } },
      { name: 'clientSecret', kind: 'secret', label: { tr: 'Client Secret', en: 'Client Secret' } },
      { name: 'realmId', kind: 'text', label: { tr: 'Realm ID', en: 'Realm ID' } },
    ],
  },
  {
    key: 'stripe',
    icon: CreditCard,
    title: { tr: 'Stripe', en: 'Stripe' },
    fields: [
      { name: 'publishableKey', kind: 'text', label: { tr: 'Publishable Key', en: 'Publishable Key' }, placeholder: 'pk_live_…' },
      { name: 'secretKey', kind: 'secret', label: { tr: 'Secret Key', en: 'Secret Key' }, placeholder: 'sk_live_…' },
      { name: 'webhookSecret', kind: 'secret', label: { tr: 'Webhook Secret', en: 'Webhook Secret' }, placeholder: 'whsec_…' },
    ],
  },
  {
    key: 'onesignal',
    icon: Bell,
    title: { tr: 'OneSignal (Push)', en: 'OneSignal (Push)' },
    fields: [
      { name: 'appId', kind: 'text', label: { tr: 'App ID', en: 'App ID' } },
      { name: 'apiKey', kind: 'secret', label: { tr: 'REST API Anahtarı', en: 'REST API Key' } },
    ],
  },
  {
    key: 'twilio',
    icon: MessageSquare,
    title: { tr: 'Twilio (SMS)', en: 'Twilio (SMS)' },
    fields: [
      { name: 'accountSid', kind: 'text', label: { tr: 'Account SID', en: 'Account SID' } },
      { name: 'authToken', kind: 'secret', label: { tr: 'Auth Token', en: 'Auth Token' } },
      { name: 'fromNumber', kind: 'text', label: { tr: 'Gönderen Numara', en: 'From Number' }, placeholder: '+1234567890' },
    ],
  },
];

type GroupValue = Record<string, unknown>;
type SettingsMap = Record<string, GroupValue | undefined>;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminIntegrations() {
  const tr = useLocale() === 'tr';

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<SettingsMap>('/settings'),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-navy dark:text-white">
          {tr ? 'Entegrasyon Anahtarları' : 'Integration Keys'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
          {tr
            ? "Tüm anahtarlar burada saklanır (şifreli). “••••••••” görünen secret alanı değiştirmezsen mevcut değer korunur."
            : 'All keys are stored here (encrypted). A secret field showing “••••••••” keeps its current value unless you change it.'}
        </p>
      </div>

      {settings.isLoading ? (
        <ListSkeleton rows={4} />
      ) : settings.isError ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-100 dark:border-rose-500/20 p-8 text-center">
          <p className="font-semibold text-navy dark:text-white">
            {tr ? 'Ayarlar yüklenemedi' : 'Failed to load settings'}
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            {settings.error instanceof Error ? settings.error.message : ''}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => settings.refetch()}
            className="mt-4 h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
          >
            {tr ? 'Tekrar dene' : 'Try again'}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {GROUPS.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              tr={tr}
              initial={settings.data?.[group.key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Group card — her grup kendi local state'ini tutar                   */
/* ------------------------------------------------------------------ */

function GroupCard({
  group,
  tr,
  initial,
}: {
  group: Group;
  tr: boolean;
  initial: GroupValue | undefined;
}) {
  const qc = useQueryClient();
  const Icon = group.icon;

  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});

  // GET verisi geldiğinde / değiştiğinde formu doldur.
  useEffect(() => {
    const src = (initial ?? {}) as GroupValue;
    setEnabled(Boolean(src.enabled));
    const next: Record<string, string> = {};
    for (const f of group.fields) {
      const v = src[f.name];
      next[f.name] = v === undefined || v === null ? '' : String(v);
    }
    // 'secure' (SMTP) gibi ekstra checkbox alanı varsa onu da takip et.
    if (group.key === 'smtp') {
      next.__secure = src.secure ? '1' : '';
    }
    setValues(next);
  }, [initial, group]);

  const save = useMutation({
    mutationFn: (payload: GroupValue) =>
      api(`/settings/${group.key}`, { method: 'PUT', json: { value: payload } }),
    onSuccess: () => {
      toast.success(tr ? 'Kaydedildi' : 'Saved');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: unknown) => {
      toast.error(
        e instanceof Error
          ? e.message
          : tr
            ? 'Kaydedilemedi'
            : 'Failed to save',
      );
    },
  });

  const onSubmit = () => {
    const payload: GroupValue = { enabled };
    for (const f of group.fields) {
      const raw = values[f.name] ?? '';
      if (f.kind === 'number') {
        const n = raw === '' ? undefined : Number(raw);
        payload[f.name] = n === undefined || Number.isNaN(n) ? undefined : n;
      } else {
        // Secret alan MASK olarak gelirse aynen geri gönderiyoruz → backend mevcut değeri korur.
        payload[f.name] = raw;
      }
    }
    if (group.key === 'smtp') {
      payload.secure = values.__secure === '1';
    }
    save.mutate(payload);
  };

  const setField = (name: string, v: string) =>
    setValues((s) => ({ ...s, [name]: v }));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 sm:p-6">
      {/* Card header: icon + title + enable toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              enabled
                ? 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-navy dark:text-white truncate">
              {group.title[tr ? 'tr' : 'en']}
            </h2>
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              {enabled
                ? tr
                  ? 'Aktif'
                  : 'Active'
                : tr
                  ? 'Pasif'
                  : 'Inactive'}
            </p>
          </div>
        </div>

        <Toggle
          checked={enabled}
          onChange={setEnabled}
          label={tr ? 'Etkin' : 'Enabled'}
        />
      </div>

      {group.hint && (
        <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl px-3 py-2">
          {group.hint[tr ? 'tr' : 'en']}
        </p>
      )}

      {/* Fields */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {group.fields.map((f) => {
          const id = `${group.key}-${f.name}`;
          const isSecret = f.kind === 'secret';
          const revealed = show[f.name];
          return (
            <div key={f.name} className="space-y-1.5">
              <label
                htmlFor={id}
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                {f.label[tr ? 'tr' : 'en']}
              </label>
              <div className="relative">
                <Input
                  id={id}
                  type={
                    isSecret
                      ? revealed
                        ? 'text'
                        : 'password'
                      : f.kind === 'number'
                        ? 'number'
                        : 'text'
                  }
                  value={values[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  className={`h-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white ${
                    isSecret ? 'pr-9' : ''
                  }`}
                />
                {isSecret && (
                  <button
                    type="button"
                    onClick={() =>
                      setShow((s) => ({ ...s, [f.name]: !s[f.name] }))
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={
                      revealed
                        ? tr
                          ? 'Gizle'
                          : 'Hide'
                        : tr
                          ? 'Göster'
                          : 'Show'
                    }
                  >
                    {revealed ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* SMTP 'secure' ekstra checkbox */}
        {group.key === 'smtp' && (
          <label
            htmlFor={`${group.key}-secure`}
            className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none"
          >
            <input
              id={`${group.key}-secure`}
              type="checkbox"
              checked={values.__secure === '1'}
              onChange={(e) => setField('__secure', e.target.checked ? '1' : '')}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30 dark:bg-slate-950"
            />
            {tr ? 'Güvenli bağlantı (SSL/TLS)' : 'Secure connection (SSL/TLS)'}
          </label>
        )}
      </div>

      {/* Save */}
      <div className="mt-5 flex justify-end">
        <Button
          onClick={onSubmit}
          disabled={save.isPending}
          className="h-9 rounded-xl bg-primary hover:bg-primary/80"
        >
          <Save className="h-4 w-4" />
          {save.isPending
            ? tr
              ? 'Kaydediliyor…'
              : 'Saving…'
            : tr
              ? 'Kaydet'
              : 'Save'}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle                                                               */
/* ------------------------------------------------------------------ */

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked
          ? 'bg-primary'
          : 'bg-slate-200 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
