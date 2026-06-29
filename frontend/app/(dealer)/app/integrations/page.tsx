'use client';

/* ------------------------------------------------------------------ *
 * Bayi · Entegrasyonlar / Webhook yönetimi
 * GET    /webhooks/subscriptions          → liste
 * POST   /webhooks/subscriptions {url,events[]}
 * DELETE /webhooks/subscriptions/:id
 * POST   /webhooks/test {subscriptionId? | url?}
 * HMAC imzalı giden webhook'lar — gizli imza X-Printy-Signature header'ı.
 * ------------------------------------------------------------------ */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Webhook,
  Plus,
  Trash2,
  Send,
  ShieldCheck,
  KeyRound,
  Link2,
  Activity,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Zap,
  PackagePlus,
  RefreshCcwDot,
  Truck,
  Ban,
  CreditCard,
  Radio,
  Clock,
  type LucideIcon,
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
} from '@/components/ui/dialog';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Subscription {
  id: string;
  url: string;
  events: string[];
  active?: boolean;
  status?: 'ACTIVE' | 'INACTIVE' | 'FAILING';
  secretHint?: string | null; // örn. "whsec_••••3f9a"
  lastDeliveryAt?: string | null;
  lastStatusCode?: number | null;
  failureCount?: number | null;
  createdAt?: string;
}

/* Desteklenen olaylar — meta (ikon + renk + açıklama) */
const EVENT_KEYS = [
  'order.created',
  'order.status_changed',
  'order.approved',
  'order.shipped',
  'order.cancelled',
  'proof.uploaded',
  'credit.low_balance',
  'payment.succeeded',
] as const;
type EventKey = (typeof EVENT_KEYS)[number];

const EVENT_META: Record<EventKey, { icon: LucideIcon; wrap: string }> = {
  'order.created': {
    icon: PackagePlus,
    wrap: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
  },
  'order.status_changed': {
    icon: RefreshCcwDot,
    wrap: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
  },
  'order.approved': {
    icon: CheckCircle2,
    wrap: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  'order.shipped': {
    icon: Truck,
    wrap: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300',
  },
  'order.cancelled': {
    icon: Ban,
    wrap: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  },
  'proof.uploaded': {
    icon: Activity,
    wrap: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  },
  'credit.low_balance': {
    icon: AlertTriangle,
    wrap: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
  'payment.succeeded': {
    icon: CreditCard,
    wrap: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  },
};

/* Abonelik durumunu normalize et */
function resolveStatus(s: Subscription): 'ACTIVE' | 'INACTIVE' | 'FAILING' {
  if (s.status) return s.status;
  if ((s.failureCount ?? 0) >= 3) return 'FAILING';
  if (s.active === false) return 'INACTIVE';
  return 'ACTIVE';
}

const STATUS_META: Record<
  'ACTIVE' | 'INACTIVE' | 'FAILING',
  { dot: string; chip: string }
> = {
  ACTIVE: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  INACTIVE: {
    dot: 'bg-slate-400',
    chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  },
  FAILING: {
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  },
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function IntegrationsPage() {
  const tr = useLocale() === 'tr';
  const L = useMemo(() => labels(tr), [tr]);
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['webhooks', 'subscriptions'],
    queryFn: () => api<Subscription[]>('/webhooks/subscriptions'),
  });

  const subs = useMemo(() => data ?? [], [data]);

  const summary = useMemo(() => {
    let active = 0;
    let failing = 0;
    const events = new Set<string>();
    for (const s of subs) {
      const st = resolveStatus(s);
      if (st === 'ACTIVE') active += 1;
      if (st === 'FAILING') failing += 1;
      s.events?.forEach((e) => events.add(e));
    }
    return { total: subs.length, active, failing, events: events.size };
  }, [subs]);

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/webhooks/subscriptions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(L.toastDeleted);
      qc.invalidateQueries({ queryKey: ['webhooks', 'subscriptions'] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.toastError),
  });

  const test = useMutation({
    mutationFn: (vars: { subscriptionId?: string; url?: string }) =>
      api('/webhooks/test', { method: 'POST', json: vars }),
    onSuccess: () => toast.success(L.toastTestSent),
    onError: (e) => toast.error(e instanceof Error ? e.message : L.toastError),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 text-primary flex items-center justify-center shrink-0 dark:bg-blue-500/10 dark:text-blue-300">
            <Webhook className="h-5.5 w-5.5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-navy dark:text-white">{L.title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              {L.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch();
              toast.success(L.refreshed);
            }}
            disabled={isFetching}
            className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
          >
            <RotateCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {L.refresh}
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-9 rounded-xl shadow-lg shadow-blue-500/20"
          >
            <Plus className="h-4 w-4" />
            {L.newWebhook}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-slate-100 bg-white p-5 h-[104px] animate-pulse dark:bg-slate-900 dark:border-slate-800"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label={L.cardEndpoints}
            value={summary.total}
            icon={Radio}
            accent="primary"
            sub={L.cardEndpointsSub}
          />
          <SummaryCard
            label={L.cardActive}
            value={summary.active}
            icon={Activity}
            accent="emerald"
            sub={L.cardActiveSub}
          />
          <SummaryCard
            label={L.cardEvents}
            value={summary.events}
            icon={Zap}
            accent="amber"
            sub={L.cardEventsSub}
          />
          <SummaryCard
            label={L.cardFailing}
            value={summary.failing}
            icon={AlertTriangle}
            accent={summary.failing > 0 ? 'rose' : 'navy'}
            sub={L.cardFailingSub}
          />
        </div>
      )}

      {/* HMAC güvenlik notu */}
      <SignatureNote L={L} tr={tr} />

      {/* Subscriptions card */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-navy dark:text-white">
              {L.listTitle}
            </h2>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 rounded-full px-2 py-0.5">
              {subs.length}
            </span>
          </div>
        </div>

        {isLoading ? (
          <ListLoading />
        ) : isError ? (
          <ErrorBlock
            message={error instanceof Error ? error.message : L.loadError}
            retry={() => refetch()}
            retryLabel={L.retry}
          />
        ) : subs.length === 0 ? (
          <EmptyBlock
            L={L}
            onCreate={() => setCreateOpen(true)}
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {subs.map((s) => (
              <SubscriptionRow
                key={s.id}
                sub={s}
                L={L}
                tr={tr}
                onTest={() => test.mutate({ subscriptionId: s.id })}
                testing={test.isPending && test.variables?.subscriptionId === s.id}
                onDelete={() => setDeleteTarget(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CreateWebhookDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        L={L}
        onTestUrl={(url) => test.mutate({ url })}
        testingUrl={test.isPending && !!test.variables?.url}
      />

      {/* Delete confirm dialog */}
      <DeleteDialog
        target={deleteTarget}
        L={L}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(id) => remove.mutate(id)}
        pending={remove.isPending}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Subscription row                                                     */
/* ------------------------------------------------------------------ */

function SubscriptionRow({
  sub,
  L,
  tr,
  onTest,
  testing,
  onDelete,
}: {
  sub: Subscription;
  L: Labels;
  tr: boolean;
  onTest: () => void;
  testing: boolean;
  onDelete: () => void;
}) {
  const status = resolveStatus(sub);
  const meta = STATUS_META[status];

  return (
    <div className="px-5 py-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left: url + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {L.statusName(status)}
            </span>
            <code className="text-sm font-medium text-navy dark:text-slate-100 break-all">
              {sub.url}
            </code>
          </div>

          {/* Event chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            {(sub.events ?? []).map((ev) => {
              const m = EVENT_META[ev as EventKey];
              const Icon = m?.icon ?? Zap;
              return (
                <span
                  key={ev}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                >
                  <Icon className="h-3 w-3" />
                  {ev}
                </span>
              );
            })}
            {(sub.events ?? []).length === 0 && (
              <span className="text-[11px] text-slate-400">{L.noEvents}</span>
            )}
          </div>

          {/* Footer meta: secret + last delivery */}
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2.5 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="inline-flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              {L.secret}:{' '}
              <code className="font-mono text-slate-500 dark:text-slate-400">
                {sub.secretHint || 'whsec_••••••••'}
              </code>
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {L.lastDelivery}:{' '}
              {sub.lastDeliveryAt ? (
                <span className="inline-flex items-center gap-1">
                  {fmtDateTime(sub.lastDeliveryAt, tr)}
                  {typeof sub.lastStatusCode === 'number' && (
                    <span
                      className={`font-mono ${
                        sub.lastStatusCode < 300
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      · {sub.lastStatusCode}
                    </span>
                  )}
                </span>
              ) : (
                L.never
              )}
            </span>
            {status === 'FAILING' && (sub.failureCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-500">
                <XCircle className="h-3 w-3" />
                {L.failures(sub.failureCount ?? 0)}
              </span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onTest}
            disabled={testing}
            className="h-8 rounded-lg dark:border-slate-700 dark:text-slate-200"
          >
            {testing ? (
              <RotateCcw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {L.sendTest}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={L.delete}
            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HMAC signature note                                                  */
/* ------------------------------------------------------------------ */

function SignatureNote({ L, tr }: { L: Labels; tr: boolean }) {
  const [copied, setCopied] = useState(false);
  const snippet =
    tr
      ? `const sig = req.headers['x-printy-signature'];
const expected = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex');
// timingSafeEqual(sig, expected) → eşitse istek güvenli`
      : `const sig = req.headers['x-printy-signature'];
const expected = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex');
// timingSafeEqual(sig, expected) → request is authentic`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success(L.copied);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(L.copyFailed);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50/80 to-white rounded-3xl border border-blue-100 p-5 dark:from-blue-500/5 dark:to-slate-900 dark:border-blue-500/20">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-100 text-primary flex items-center justify-center shrink-0 dark:bg-blue-500/15 dark:text-blue-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-navy dark:text-white">{L.sigTitle}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-primary px-2 py-0.5 text-[11px] font-semibold dark:bg-blue-500/15 dark:text-blue-300">
              <KeyRound className="h-3 w-3" /> HMAC-SHA256
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
            {L.sigBody}
          </p>

          <div className="relative mt-3 group">
            <pre className="overflow-x-auto rounded-xl bg-navy text-slate-100 text-[12px] leading-relaxed p-4 font-mono dark:bg-slate-950 dark:ring-1 dark:ring-slate-800">
              {snippet}
            </pre>
            <button
              onClick={copy}
              aria-label={L.copy}
              className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 px-2 py-1 text-[11px] font-medium transition-colors"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? L.copied : L.copy}
            </button>
          </div>

          <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] text-slate-500 dark:text-slate-400">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              {L.sigPoint1}
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              {L.sigPoint2}
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              {L.sigPoint3}
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              {L.sigPoint4}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create dialog                                                        */
/* ------------------------------------------------------------------ */

function CreateWebhookDialog({
  open,
  onClose,
  L,
  onTestUrl,
  testingUrl,
}: {
  open: boolean;
  onClose: () => void;
  L: Labels;
  onTestUrl: (url: string) => void;
  testingUrl: boolean;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);

  const reset = () => {
    setUrl('');
    setSelected(new Set());
    setTouched(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const urlValid = /^https:\/\/.+/i.test(url.trim());
  const canSubmit = urlValid && selected.size > 0;

  const toggle = (ev: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ev)) next.delete(ev);
      else next.add(ev);
      return next;
    });
  };

  const create = useMutation({
    mutationFn: () =>
      api<Subscription>('/webhooks/subscriptions', {
        method: 'POST',
        json: { url: url.trim(), events: Array.from(selected) },
      }),
    onSuccess: () => {
      toast.success(L.toastCreated);
      qc.invalidateQueries({ queryKey: ['webhooks', 'subscriptions'] });
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L.toastError),
  });

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-navy dark:text-white flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center dark:bg-blue-500/10 dark:text-blue-300">
              <Plus className="h-4 w-4" />
            </span>
            {L.dialogTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
            {L.dialogDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="wh-url" className="text-navy dark:text-slate-200">
              {L.endpointUrl}
            </Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="wh-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.bayifirmasi.com/webhooks/printy"
                className={`h-10 pl-9 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white ${
                  touched && !urlValid ? 'border-rose-400 ring-2 ring-rose-100' : ''
                }`}
              />
            </div>
            {touched && !urlValid ? (
              <p className="text-[11px] text-rose-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {L.urlError}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">{L.urlHint}</p>
            )}
          </div>

          {/* Events */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-navy dark:text-slate-200">{L.events}</Label>
              <button
                type="button"
                onClick={() =>
                  setSelected((prev) =>
                    prev.size === EVENT_KEYS.length ? new Set() : new Set(EVENT_KEYS),
                  )
                }
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {selected.size === EVENT_KEYS.length ? L.clearAll : L.selectAll}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {EVENT_KEYS.map((ev) => {
                const m = EVENT_META[ev];
                const Icon = m.icon;
                const checked = selected.has(ev);
                return (
                  <button
                    type="button"
                    key={ev}
                    onClick={() => toggle(ev)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      checked
                        ? 'border-primary bg-blue-50/60 dark:bg-blue-500/10 dark:border-blue-500/40'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span
                      className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${m.wrap}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <code className="text-[12px] font-medium text-navy dark:text-slate-200 flex-1 break-all">
                      {ev}
                    </code>
                    <span
                      className={`h-4 w-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                        checked
                          ? 'bg-primary border-primary text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
            {touched && selected.size === 0 && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {L.eventsError}
              </p>
            )}
          </div>

          {/* HMAC reminder */}
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 dark:bg-slate-800/50 dark:border-slate-700">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {L.dialogSecretNote}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => urlValid && onTestUrl(url.trim())}
            disabled={!urlValid || testingUrl}
            className="h-9 rounded-xl text-slate-500 dark:text-slate-400"
          >
            {testingUrl ? (
              <RotateCcw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {L.testThisUrl}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={close}
              className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
            >
              {L.cancel}
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={create.isPending}
              className="h-9 rounded-xl shadow-lg shadow-blue-500/20"
            >
              {create.isPending ? (
                <RotateCcw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {L.createBtn}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Delete dialog                                                        */
/* ------------------------------------------------------------------ */

function DeleteDialog({
  target,
  L,
  onClose,
  onConfirm,
  pending,
}: {
  target: Subscription | null;
  L: Labels;
  onClose: () => void;
  onConfirm: (id: string) => void;
  pending: boolean;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-navy dark:text-white flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center dark:bg-rose-500/10 dark:text-rose-400">
              <Trash2 className="h-4 w-4" />
            </span>
            {L.deleteTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
            {L.deleteDesc}
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 dark:bg-slate-800/50 dark:border-slate-700">
            <code className="text-[12px] font-medium text-navy dark:text-slate-200 break-all">
              {target.url}
            </code>
            <div className="text-[11px] text-slate-400 mt-1">
              {(target.events ?? []).length} {L.eventsCountSuffix}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
          >
            {L.cancel}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => target && onConfirm(target.id)}
            disabled={pending}
            className="h-9 rounded-xl"
          >
            {pending ? (
              <RotateCcw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {L.confirmDelete}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

const ACCENTS: Record<string, string> = {
  primary: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  navy: 'bg-slate-100 text-navy dark:bg-slate-800 dark:text-slate-200',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  sub,
  accent = 'primary',
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  sub?: string;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 hover:shadow-lg transition-shadow dark:bg-slate-900 dark:border-slate-800 dark:hover:shadow-black/20">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
          <div className="text-2xl font-semibold text-navy dark:text-white mt-1.5 tabular-nums">
            {value}
          </div>
          {sub && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>
          )}
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

function ListLoading() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-5 py-4 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-64 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="flex gap-1.5 mt-3">
            <div className="h-5 w-24 rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-5 w-28 rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-5 w-20 rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-3 w-48 rounded bg-slate-100 dark:bg-slate-800 mt-3" />
        </div>
      ))}
    </div>
  );
}

function EmptyBlock({ L, onCreate }: { L: Labels; onCreate: () => void }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-4">
        <Webhook className="h-8 w-8 text-primary dark:text-blue-300" />
      </div>
      <p className="font-semibold text-navy dark:text-white text-base">{L.emptyTitle}</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
        {L.emptyDesc}
      </p>
      <Button onClick={onCreate} size="sm" className="mt-5 h-10 rounded-xl shadow-lg shadow-blue-500/20">
        <Plus className="h-4 w-4" />
        {L.emptyCta}
      </Button>
      <div className="mt-6 flex items-center justify-center gap-x-5 gap-y-2 flex-wrap text-[11px] text-slate-400 dark:text-slate-500">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {L.emptyBadge1}
        </span>
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-amber-500" /> {L.emptyBadge2}
        </span>
        <span className="inline-flex items-center gap-1">
          <Send className="h-3.5 w-3.5 text-primary" /> {L.emptyBadge3}
        </span>
      </div>
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

const fmtDateTime = (d: string, tr: boolean) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(tr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/* ------------------------------------------------------------------ */
/* Inline i18n (next-intl useLocale) — JSON'a dokunmadan               */
/* ------------------------------------------------------------------ */

type Labels = ReturnType<typeof labels>;

function labels(tr: boolean) {
  const statusName = (s: 'ACTIVE' | 'INACTIVE' | 'FAILING') =>
    tr
      ? { ACTIVE: 'Aktif', INACTIVE: 'Pasif', FAILING: 'Hatalı' }[s]
      : { ACTIVE: 'Active', INACTIVE: 'Inactive', FAILING: 'Failing' }[s];

  return {
    statusName,

    title: tr ? 'Entegrasyonlar' : 'Integrations',
    subtitle: tr
      ? 'Sipariş ve hesap olaylarını kendi sistemlerinize iletmek için HMAC imzalı webhook abonelikleri yönetin.'
      : 'Manage HMAC-signed webhook subscriptions to push order and account events into your own systems.',

    refresh: tr ? 'Yenile' : 'Refresh',
    refreshed: tr ? 'Liste güncellendi' : 'List refreshed',
    newWebhook: tr ? 'Yeni Webhook' : 'New Webhook',

    cardEndpoints: tr ? 'Uç Nokta' : 'Endpoints',
    cardEndpointsSub: tr ? 'Toplam abonelik' : 'Total subscriptions',
    cardActive: tr ? 'Aktif' : 'Active',
    cardActiveSub: tr ? 'Olay alıyor' : 'Receiving events',
    cardEvents: tr ? 'Olay Türü' : 'Event Types',
    cardEventsSub: tr ? 'Abone olunan' : 'Subscribed',
    cardFailing: tr ? 'Hatalı' : 'Failing',
    cardFailingSub: tr ? 'Teslimat sorunu' : 'Delivery issues',

    sigTitle: tr ? 'İmzalı, doğrulanabilir teslimat' : 'Signed, verifiable delivery',
    sigBody: tr
      ? 'Her giden istek, abonelik gizli anahtarınızla üretilen bir HMAC-SHA256 imzası içerir. İmzayı kendi tarafınızda yeniden hesaplayıp X-Printy-Signature başlığıyla karşılaştırarak isteğin gerçekten Printy’den geldiğini doğrulayın.'
      : 'Every outgoing request carries an HMAC-SHA256 signature derived from your subscription secret. Recompute it on your side and compare against the X-Printy-Signature header to confirm the request truly came from Printy.',
    sigPoint1: tr
      ? 'İmza X-Printy-Signature başlığında gönderilir.'
      : 'Signature is sent in the X-Printy-Signature header.',
    sigPoint2: tr
      ? 'Ham (raw) gövde üzerinden hesaplayın, JSON’u yeniden serileştirmeyin.'
      : 'Compute over the raw body — do not re-serialize the JSON.',
    sigPoint3: tr
      ? 'Zaman damgasını kontrol ederek tekrar (replay) saldırılarını engelleyin.'
      : 'Check the timestamp to mitigate replay attacks.',
    sigPoint4: tr
      ? 'Sabit zamanlı karşılaştırma (timingSafeEqual) kullanın.'
      : 'Use a constant-time comparison (timingSafeEqual).',
    copy: tr ? 'Kopyala' : 'Copy',
    copied: tr ? 'Kopyalandı' : 'Copied',
    copyFailed: tr ? 'Kopyalanamadı' : 'Copy failed',

    listTitle: tr ? 'Webhook Abonelikleri' : 'Webhook Subscriptions',
    noEvents: tr ? 'Olay seçilmemiş' : 'No events selected',
    secret: tr ? 'Gizli anahtar' : 'Secret',
    lastDelivery: tr ? 'Son teslimat' : 'Last delivery',
    never: tr ? 'henüz yok' : 'never',
    failures: (n: number) =>
      tr ? `${n} ardışık hata` : `${n} consecutive failure${n > 1 ? 's' : ''}`,
    sendTest: tr ? 'Test gönder' : 'Send test',
    delete: tr ? 'Sil' : 'Delete',

    emptyTitle: tr ? 'Henüz webhook yok' : 'No webhooks yet',
    emptyDesc: tr
      ? 'Bir uç nokta ekleyin; sipariş oluşturulduğunda, durumu değiştiğinde veya kargolandığında sisteminize anlık olarak imzalı bildirim göndereceğiz. Yoklama (polling) yapmanıza gerek kalmaz.'
      : 'Add an endpoint and we will push signed, real-time notifications to your system whenever an order is created, changes status, or ships — no polling required.',
    emptyCta: tr ? 'İlk webhook’unu ekle' : 'Add your first webhook',
    emptyBadge1: tr ? 'HMAC imzalı' : 'HMAC signed',
    emptyBadge2: tr ? 'Anlık olaylar' : 'Real-time events',
    emptyBadge3: tr ? 'Test edilebilir' : 'Testable',

    loadError: tr ? 'Abonelikler yüklenemedi' : 'Failed to load subscriptions',
    retry: tr ? 'Tekrar dene' : 'Try again',

    // Create dialog
    dialogTitle: tr ? 'Yeni Webhook Aboneliği' : 'New Webhook Subscription',
    dialogDesc: tr
      ? 'Bir HTTPS uç noktası girin ve bildirim almak istediğiniz olayları seçin.'
      : 'Enter an HTTPS endpoint and pick the events you want to be notified about.',
    endpointUrl: tr ? 'Uç Nokta URL’i' : 'Endpoint URL',
    urlHint: tr
      ? 'POST istekleri bu adrese gönderilir. HTTPS zorunludur.'
      : 'POST requests are sent to this address. HTTPS is required.',
    urlError: tr
      ? 'Geçerli bir https:// adresi girin.'
      : 'Enter a valid https:// URL.',
    events: tr ? 'Olaylar' : 'Events',
    selectAll: tr ? 'Tümünü seç' : 'Select all',
    clearAll: tr ? 'Temizle' : 'Clear',
    eventsError: tr ? 'En az bir olay seçin.' : 'Select at least one event.',
    dialogSecretNote: tr
      ? 'Oluşturma sonrası size yalnızca bir kez gösterilen bir gizli anahtar (whsec_…) üretilir. İmza doğrulaması için bu anahtarı güvenli biçimde saklayın.'
      : 'On creation a secret (whsec_…) is generated and shown only once. Store it securely to verify signatures.',
    testThisUrl: tr ? 'Bu URL’i test et' : 'Test this URL',
    cancel: tr ? 'Vazgeç' : 'Cancel',
    createBtn: tr ? 'Oluştur' : 'Create',

    // Delete dialog
    deleteTitle: tr ? 'Webhook’u sil' : 'Delete webhook',
    deleteDesc: tr
      ? 'Bu abonelik kalıcı olarak silinecek ve bu uç noktaya olay gönderimi duracak.'
      : 'This subscription will be permanently removed and event delivery to this endpoint will stop.',
    eventsCountSuffix: tr ? 'olaya abone' : 'events subscribed',
    confirmDelete: tr ? 'Evet, sil' : 'Yes, delete',

    // Toasts
    toastCreated: tr ? 'Webhook oluşturuldu' : 'Webhook created',
    toastDeleted: tr ? 'Webhook silindi' : 'Webhook deleted',
    toastTestSent: tr ? 'Test olayı gönderildi' : 'Test event sent',
    toastError: tr ? 'Bir hata oluştu' : 'Something went wrong',
  };
}
