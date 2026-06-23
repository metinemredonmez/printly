'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/api';
import { homeFor, type User } from '@/lib/types';

function LoginForm() {
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
      toast.success('Giriş başarılı');
      router.replace(params.get('next') ?? homeFor(user.role));
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Giriş başarısız';
      if (/2fa|iki fakt|kod gerekli/i.test(msg)) {
        setNeed2fa(true);
        toast.info('2FA kodu gerekli');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-5"
    >
      <h2 className="text-lg font-bold text-navy">Sistem Girişi</h2>
      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@ortakdoku.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {need2fa && (
        <div className="space-y-2">
          <Label htmlFor="code">2FA Kodu</Label>
          <Input
            id="code"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 haneli kod"
            autoFocus
          />
        </div>
      )}
      <Button type="submit" className="w-full h-11" disabled={loading}>
        {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-slate-400">veya</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => toast.info('Google ile giriş yakında (yetkilendirme bekleniyor)')}
        className="w-full h-11 flex items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
          />
        </svg>
        Google ile Giriş
      </button>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot" className="text-primary hover:underline">
          Şifremi unuttum
        </Link>
        <Link href="/register" className="text-slate-500 hover:underline">
          Hesap oluştur
        </Link>
      </div>

      <p className="text-center text-[11px] text-slate-400 border-t border-slate-100 pt-3">
        Test: <span className="font-mono">admin@ortakdoku.com / admin</span>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-primary text-white items-center justify-center font-extrabold text-xl mb-3">
            OD
          </div>
          <h1 className="text-2xl font-extrabold text-navy">Ortak Doku</h1>
          <p className="text-sm text-slate-500">Sipariş & Operasyon Portalı</p>
        </div>
        <Suspense fallback={<div className="text-center text-slate-400">Yükleniyor…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
