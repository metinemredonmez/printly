'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LangSwitcher } from '@/components/lang-switcher';
import { login } from '@/lib/api';
import { homeFor, type User } from '@/lib/types';

function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [need2fa, setNeed2fa] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const user: User = await login(email, password, need2fa ? code : undefined);
      toast.success(t('loginSuccess'));
      router.replace(params.get('next') ?? homeFor(user.role));
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('loginFailed');
      if (/2fa|iki fakt|kod gerekli|code required/i.test(msg)) {
        setNeed2fa(true);
        toast.info(t('need2fa'));
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@ortakdoku.com"
          className="h-11 bg-slate-50"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 bg-slate-50"
        />
      </div>
      {need2fa && (
        <div className="space-y-2">
          <Label htmlFor="code">{t('code2fa')}</Label>
          <Input
            id="code"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('code2faPlaceholder')}
            className="h-11 bg-slate-50"
            autoFocus
          />
        </div>
      )}
      <Button
        type="submit"
        className="w-full h-11 bg-primary hover:bg-primary-hover shadow-lg shadow-blue-500/20"
        disabled={loading}
      >
        {loading ? t('signingIn') : t('loginTitle')}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-slate-400">{t('or')}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => toast.info(t('googleSoon'))}
        className="w-full h-11 flex items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
        </svg>
        {t('googleLogin')}
      </button>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot" className="text-primary hover:underline font-medium">
          {t('forgotPassword')}
        </Link>
        <Link href="/register" className="text-slate-500 hover:underline">
          {t('createAccount')}
        </Link>
      </div>

      <p className="text-center text-[11px] text-slate-400 border-t border-slate-100 pt-3">
        {t('testHint')}: <span className="font-mono">admin@ortakdoku.com / admin</span>
      </p>
    </form>
  );
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const feats = [t('feat1'), t('feat2'), t('feat3')];

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Sol marka paneli */}
      <div className="relative hidden lg:flex flex-col justify-between bg-navy text-white p-12 overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <div className="h-11 w-11 rounded-2xl bg-primary flex items-center justify-center font-extrabold text-lg">
              OD
            </div>
            <span className="font-extrabold text-xl">{tc('appName')}</span>
          </Link>
        </div>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-extrabold leading-tight">{t('brandHeadline')}</h2>
          <p className="text-slate-300 text-lg">{t('brandSub')}</p>
          <ul className="space-y-3 pt-2">
            {feats.map((f) => (
              <li key={f} className="flex items-center gap-3 text-slate-200">
                <CircleCheck className="h-5 w-5 text-brand-accent shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 text-xs text-slate-500">
          © 2026 Ortak Doku — B2B Print-on-Demand
        </div>
        {/* dekoratif daireler */}
        <svg
          className="absolute -right-24 -bottom-24 w-[28rem] h-[28rem] opacity-30"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle cx="200" cy="200" r="160" stroke="#1F5EFF" strokeWidth="2" strokeDasharray="8 8" />
          <circle cx="200" cy="200" r="100" stroke="#6B8E23" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="200" cy="200" r="40" fill="#1F5EFF" opacity="0.4" />
        </svg>
      </div>

      {/* Sağ form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="lg:hidden flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-extrabold">
                OD
              </div>
              <span className="font-extrabold text-navy">{tc('appName')}</span>
            </Link>
            <LangSwitcher className="ml-auto" />
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-navy">{t('loginTitle')}</h1>
            <p className="text-sm text-slate-500">{tc('tagline')}</p>
          </div>
          <Suspense fallback={<div className="text-center text-slate-400">{tc('loading')}</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
