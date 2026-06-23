'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LangSwitcher } from '@/components/lang-switcher';
import { api } from '@/lib/api';
import { homeFor, type User } from '@/lib/types';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
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
      toast.success(t('otpSent'));
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('registerFailed'));
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
      if (!res.ok) throw new Error(data?.message ?? t('verifyFailed'));
      toast.success(t('accountCreated'));
      router.replace(homeFor((data.user as User)?.role));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('verifyFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <LangSwitcher />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-navy">{t('registerTitle')}</h1>
          <p className="text-sm text-slate-500">{t('registerSubtitle')}</p>
        </div>
        {step === 1 ? (
          <form
            onSubmit={submitRegister}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('fullName')}</Label>
              <Input
                id="fullName"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('passwordHint')}</Label>
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
              {loading ? '…' : t('sendCode')}
            </Button>
            <p className="text-center text-sm text-slate-500">
              {t('haveAccount')}{' '}
              <Link href="/login" className="text-primary hover:underline">
                {t('loginTitle')}
              </Link>
            </p>
          </form>
        ) : (
          <form
            onSubmit={submitVerify}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-5"
          >
            <p className="text-sm text-slate-600">
              <strong>{form.email}</strong> {t('enterOtp')}
            </p>
            <div className="space-y-2">
              <Label htmlFor="code">{t('verifyCode')}</Label>
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
              {loading ? '…' : t('verifyRegister')}
            </Button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-sm text-slate-500 hover:underline"
            >
              {tc('back')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
