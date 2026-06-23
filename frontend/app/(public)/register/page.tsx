'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { homeFor, type User } from '@/lib/types';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/auth/register', { method: 'POST', json: form });
      toast.success('Doğrulama kodu e-postanıza gönderildi');
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setLoading(false);
    }
  }

  async function submitVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? 'Doğrulama başarısız');
      toast.success('Hesabınız oluşturuldu');
      router.replace(homeFor((data.user as User)?.role));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Doğrulama başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-navy">Hesap Oluştur</h1>
          <p className="text-sm text-slate-500">Bayi başvurusu</p>
        </div>
        {step === 1 ? (
          <form
            onSubmit={submitRegister}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="fullName">Ad Soyad</Label>
              <Input
                id="fullName"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre (min 8)</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? '…' : 'Doğrulama Kodu Gönder'}
            </Button>
            <p className="text-center text-sm text-slate-500">
              Zaten hesabın var mı?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Giriş yap
              </Link>
            </p>
          </form>
        ) : (
          <form
            onSubmit={submitVerify}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-5"
          >
            <p className="text-sm text-slate-600">
              <strong>{form.email}</strong> adresine gönderilen 6 haneli kodu girin.
            </p>
            <div className="space-y-2">
              <Label htmlFor="code">Doğrulama Kodu</Label>
              <Input
                id="code"
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? '…' : 'Doğrula & Kayıt Ol'}
            </Button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-sm text-slate-500 hover:underline"
            >
              Geri dön
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
