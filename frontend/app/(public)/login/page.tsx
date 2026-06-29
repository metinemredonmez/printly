'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LangSwitcher } from '@/components/lang-switcher';
import { Logo, LogoMark } from '@/components/logo';
import { api, login } from '@/lib/api';
import { homeFor, type User } from '@/lib/types';

declare global {
  interface Window {
    google?: any;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleConfig {
  enabled: boolean;
  clientId: string;
}

function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [need2fa, setNeed2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  // --- Google girişi durumu ---
  const [googleCfg, setGoogleCfg] = useState<GoogleConfig | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleInited = useRef(false);

  // Başarı-sonrası yönlendirme — e-posta/şifre akışıyla aynı mantık.
  const redirectAfterAuth = useCallback(
    (user: User) => {
      toast.success(t('loginSuccess'));
      router.replace(params.get('next') ?? homeFor(user.role));
      router.refresh();
    },
    [router, params, t],
  );

  // Mount'ta backend Google config'ini çek (devre dışı varsayılan).
  useEffect(() => {
    let active = true;
    api<GoogleConfig>('/auth/google/config')
      .then((cfg) => {
        if (active) setGoogleCfg(cfg);
      })
      .catch(() => {
        if (active) setGoogleCfg({ enabled: false, clientId: '' });
      });
    return () => {
      active = false;
    };
  }, []);

  // GIS callback → idToken'ı backend'e gönder, cookie set edilir, {user} döner.
  const handleGoogleCredential = useCallback(
    async (response: { credential?: string }) => {
      const idToken = response?.credential;
      if (!idToken) {
        toast.error(t('googleFailed'));
        return;
      }
      setGoogleLoading(true);
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        const data = await res.json();
        if (!res.ok || !data?.user) {
          throw new Error(data?.message ?? t('googleFailed'));
        }
        redirectAfterAuth(data.user as User);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('googleFailed'));
      } finally {
        setGoogleLoading(false);
      }
    },
    [t, redirectAfterAuth],
  );

  // Config etkinse GIS script'ini bir kez yükle ve initialize et.
  useEffect(() => {
    if (!googleCfg?.enabled || !googleCfg.clientId) return;

    function initGis() {
      if (googleInited.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleCfg!.clientId,
        callback: handleGoogleCredential,
      });
      googleInited.current = true;
      setGoogleReady(true);
    }

    if (window.google?.accounts?.id) {
      initGis();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', initGis, { once: true });
      // Script zaten yüklenmiş olabilir.
      initGis();
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', initGis, { once: true });
    document.head.appendChild(script);
  }, [googleCfg, handleGoogleCredential]);

  const googleEnabled = !!googleCfg?.enabled && !!googleCfg.clientId;

  function onGoogleClick() {
    if (!googleEnabled) {
      toast.info(t('googleSoon'));
      return;
    }
    if (!googleReady || !window.google?.accounts?.id) {
      toast.info(t('googleSoon'));
      return;
    }
    window.google.accounts.id.prompt();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const user: User = await login(email, password, need2fa ? code : undefined, remember);
      redirectAfterAuth(user);
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
          className="h-11 bg-slate-50 dark:bg-slate-800"
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
          className="h-11 bg-slate-50 dark:bg-slate-800"
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
            className="h-11 bg-slate-50 dark:bg-slate-800"
            autoFocus
          />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-primary"
        />
        {t('rememberMe')}
      </label>
      <Button
        type="submit"
        className="w-full h-10 bg-primary hover:bg-primary-hover "
        disabled={loading}
      >
        {loading ? t('signingIn') : t('loginTitle')}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white dark:bg-slate-900 px-2 text-slate-400 dark:text-slate-500">{t('or')}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onGoogleClick}
        disabled={!googleEnabled || googleLoading}
        title={googleEnabled ? undefined : t('googleSoon')}
        className="w-full h-11 flex items-center justify-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
        </svg>
        {googleLoading ? t('signingIn') : t('googleLogin')}
        {!googleEnabled && (
          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('googleSoonBadge')}
          </span>
        )}
      </button>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot" className="text-primary hover:underline font-medium">
          {t('forgotPassword')}
        </Link>
        <Link href="/register" className="text-slate-500 dark:text-slate-400 hover:underline">
          {t('createAccount')}
        </Link>
      </div>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-3">
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
            <span className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center">
              <LogoMark className="h-7 w-7" />
            </span>
            <span className="font-semibold text-xl">{tc('appName')}</span>
          </Link>
        </div>
        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">{t('brandHeadline')}</h2>
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
            <Link href="/" className="lg:hidden flex items-center">
              <Logo className="h-8 w-auto" />
            </Link>
            <LangSwitcher className="ml-auto" />
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-navy dark:text-white">{t('loginTitle')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{tc('tagline')}</p>
          </div>
          <Suspense fallback={<div className="text-center text-slate-400 dark:text-slate-500">{tc('loading')}</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
