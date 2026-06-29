'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Check,
  Loader2,
  Wallet,
  Store,
  Crown,
  CircleCheck,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LangSwitcher } from '@/components/lang-switcher';
import { PasswordStrength, scorePassword } from '@/components/password-strength';
import { LogoMark } from '@/components/logo';
import { api } from '@/lib/api';
import { homeFor, type User } from '@/lib/types';

type Plan = 'USER' | 'TEAM_MEMBER' | 'TEAM_LEADER';
const PLANS: { key: Plan; icon: LucideIcon; recommended?: boolean }[] = [
  { key: 'USER', icon: Wallet },
  { key: 'TEAM_MEMBER', icon: Store, recommended: true },
  { key: 'TEAM_LEADER', icon: Crown },
];
const CATEGORIES = ['WALLPAPER', 'WALL_DECAL', 'WOOD'] as const;
const VOLUMES = ['v1', 'v2', 'v3', 'v4'] as const;

const STEPS = ['stepPlan', 'stepAccount', 'stepBusiness', 'stepContact', 'stepConfirm'] as const;

const field = 'h-11 bg-slate-50 dark:bg-slate-800';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tw = useTranslations('apply');
  const tc = useTranslations('common');
  const isTr = useLocale() === 'tr';
  const router = useRouter();

  const [step, setStep] = useState(0); // 0..4 form, 5 = OTP
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');

  const [f, setF] = useState({
    plan: '' as Plan | '',
    fullName: '',
    email: '',
    password: '',
    organizationName: '',
    etsyStoreName: '',
    categories: [] as string[],
    monthlyVolume: '',
    phone: '',
    country: '',
    city: '',
    acceptedTerms: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleCat = (c: string) =>
    set('categories', f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c]);

  const canNext =
    (step === 0 && !!f.plan) ||
    (step === 1 && !!f.fullName && /\S+@\S+\.\S+/.test(f.email) && scorePassword(f.password) >= 2) ||
    (step === 2 && !!f.organizationName) ||
    step === 3 ||
    (step === 4 && f.acceptedTerms);

  async function submit() {
    setLoading(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        json: {
          email: f.email,
          password: f.password,
          fullName: f.fullName,
          organizationName: f.organizationName || undefined,
          phone: f.phone || undefined,
        },
      });
      toast.success(t('otpSent'));
      setStep(5);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('registerFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: f.email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? t('verifyFailed'));
      toast.success(t('accountCreated'));
      router.replace(homeFor((data.user as User)?.role));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('verifyFailed'));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Sol marka paneli */}
      <div className="relative hidden lg:flex flex-col justify-between bg-navy text-white p-12 overflow-hidden">
        <Link href="/" className="relative z-10 flex items-center gap-3 w-fit">
          <span className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center">
            <LogoMark className="h-7 w-7" />
          </span>
          <span className="font-semibold text-xl">{tc('appName')}</span>
        </Link>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-semibold leading-tight">{tw('brandHeadline')}</h2>
          <p className="text-slate-300 text-lg">{tw('brandSub')}</p>
          <ul className="space-y-3 pt-2">
            {[tw('feat1'), tw('feat2'), tw('feat3')].map((x) => (
              <li key={x} className="flex items-center gap-3 text-slate-200">
                <CircleCheck className="h-5 w-5 text-brand-accent shrink-0" />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 text-xs text-slate-500 dark:text-slate-400">© 2026 Ortak Doku — B2B Print-on-Demand</div>
        <svg className="absolute -right-24 -bottom-24 w-[28rem] h-[28rem] opacity-30" viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="160" stroke="#1F5EFF" strokeWidth="2" strokeDasharray="8 8" />
          <circle cx="200" cy="200" r="100" stroke="#6B8E23" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="200" cy="200" r="40" fill="#1F5EFF" opacity="0.4" />
        </svg>
      </div>

      {/* Sağ form */}
      <div className="flex flex-col p-6 sm:p-10 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {t('backToLogin')}
          </Link>
          <LangSwitcher />
        </div>

        <div className="w-full max-w-lg mx-auto flex-1">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-navy dark:text-white">{tw('title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{tw('subtitle')}</p>
          </div>

          {/* Adım göstergesi */}
          {step < 5 && (
            <div className="flex items-center gap-1.5 mb-7">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1">
                  <div className={`h-1.5 rounded-full ${i <= step ? 'bg-primary' : 'bg-slate-200'}`} />
                  <div className={`text-[10px] mt-1.5 font-semibold ${i === step ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                    {tw(s)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ADIM 1 — Plan */}
          {step === 0 && (
            <div className="space-y-3">
              {PLANS.map((p) => {
                const Icon = p.icon;
                const on = f.plan === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => set('plan', p.key)}
                    className={`w-full text-left rounded-2xl border-2 p-4 flex items-start gap-4 transition-all ${
                      on ? 'border-primary bg-blue-50' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${on ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-navy dark:text-white">{tw(`plan_${p.key}`)}</span>
                        {p.recommended && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-accent/15 text-brand-accent">
                            {tw('recommended')}
                          </span>
                        )}
                        <span className="ml-auto text-sm font-semibold text-primary">{tw(`plan_${p.key}_price`)}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tw(`plan_${p.key}_desc`)}</p>
                    </div>
                    {on && <CircleCheck className="h-5 w-5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* ADIM 2 — Hesap */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('fullName')}</Label>
                <Input className={field} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder={tw('fullNamePlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input className={field} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="ornek@ortakdoku.com" />
                {f.email && !/\S+@\S+\.\S+/.test(f.email) && (
                  <p className="text-xs text-rose-500">
                    {isTr ? 'Geçerli bir e-posta girin (örn. ad@site.com)' : 'Enter a valid email (e.g. name@site.com)'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('passwordHint')}</Label>
                <Input className={field} type="password" value={f.password} onChange={(e) => set('password', e.target.value)} />
                <PasswordStrength value={f.password} />
              </div>
            </div>
          )}

          {/* ADIM 3 — İş bilgileri */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{tw('companyName')}</Label>
                <Input className={field} value={f.organizationName} onChange={(e) => set('organizationName', e.target.value)} placeholder={tw('companyPlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label>{tw('etsyStore')} <span className="text-slate-400 dark:text-slate-500 font-normal">({tc('optional')})</span></Label>
                <Input className={field} value={f.etsyStoreName} onChange={(e) => set('etsyStoreName', e.target.value)} placeholder={tw('etsyPlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label>{tw('categories')}</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const on = f.categories.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCat(c)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                          on ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        {tw(`cat_${c}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tw('monthlyVolume')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VOLUMES.map((v) => {
                    const on = f.monthlyVolume === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set('monthlyVolume', v)}
                        className={`px-2 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                          on ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        {tw(`vol_${v}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ADIM 4 — İletişim */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{tw('phone')}</Label>
                <Input className={field} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+90 5xx xxx xx xx" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{tw('country')}</Label>
                  <Input className={field} value={f.country} onChange={(e) => set('country', e.target.value)} placeholder={tw('countryPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{tw('city')}</Label>
                  <Input className={field} value={f.city} onChange={(e) => set('city', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">{tw('contactHint')}</p>
            </div>
          )}

          {/* ADIM 5 — Onay */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 space-y-2 text-sm">
                <SummaryRow label={tw('sumPlan')} value={f.plan ? tw(`plan_${f.plan}`) : '—'} />
                <SummaryRow label={t('fullName')} value={f.fullName || '—'} />
                <SummaryRow label={t('email')} value={f.email || '—'} />
                <SummaryRow label={tw('companyName')} value={f.organizationName || '—'} />
                {f.categories.length > 0 && (
                  <SummaryRow label={tw('categories')} value={f.categories.map((c) => tw(`cat_${c}`)).join(', ')} />
                )}
                {f.phone && <SummaryRow label={tw('phone')} value={f.phone} />}
              </div>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={f.acceptedTerms}
                  onChange={(e) => set('acceptedTerms', e.target.checked)}
                />
                <span className="text-slate-600 dark:text-slate-300">
                  {tw('acceptPre')}{' '}
                  <Link href="/terms" target="_blank" className="text-primary hover:underline">{tw('termsLink')}</Link>
                  {' '}{tw('and')}{' '}
                  <Link href="/privacy" target="_blank" className="text-primary hover:underline">{tw('privacyLink')}</Link>
                  {' '}{tw('acceptPost')}
                </span>
              </label>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                <ShieldCheck className="h-4 w-4 text-brand-accent" /> {tw('secureNote')}
              </div>
            </div>
          )}

          {/* ADIM 6 — OTP doğrulama */}
          {step === 5 && (
            <form onSubmit={verify} className="space-y-5">
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-navy dark:text-white">{f.email}</span> {t('enterOtp')}
              </div>
              <div className="space-y-2">
                <Label>{t('verifyCode')}</Label>
                <Input
                  className="h-12 text-center text-lg tracking-[0.4em] font-semibold bg-slate-50 dark:bg-slate-800"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="••••••"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={verifying || code.length < 4}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                {t('verifyRegister')}
              </Button>
            </form>
          )}

          {/* Navigasyon */}
          {step < 5 && !canNext && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6 -mb-2">
              {isTr ? 'Devam etmek için zorunlu alanları doğru doldurun.' : 'Fill the required fields correctly to continue.'}
            </p>
          )}
          {step < 5 && (
            <div className="flex items-center justify-between mt-8">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ArrowLeft className="h-4 w-4 mr-1" /> {tw('prev')}
              </Button>
              {step < 4 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                  {tw('next')} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={!canNext || loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  {tw('submit')}
                </Button>
              )}
            </div>
          )}

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            {t('haveAccount')}{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">{tc('login')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-navy dark:text-white text-right">{value}</span>
    </div>
  );
}
