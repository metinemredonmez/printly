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
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot" className="text-primary hover:underline">
          Şifremi unuttum
        </Link>
        <Link href="/register" className="text-slate-500 hover:underline">
          Hesap oluştur
        </Link>
      </div>
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
