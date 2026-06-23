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

export default function ForgotPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', json: { email } });
      toast.success(t('resetSent'));
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', json: { email, code, newPassword } });
      toast.success(t('passwordUpdated'));
      router.replace('/login');
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
        <h1 className="text-2xl font-extrabold text-navy text-center mb-8">{t('forgotTitle')}</h1>
        <form
          onSubmit={step === 1 ? sendCode : reset}
          className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              required
              disabled={step === 2}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">{t('verifyCode')}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np">{t('newPassword')}</Label>
                <Input
                  id="np"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </>
          )}
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? '…' : step === 1 ? t('sendResetCode') : t('updatePassword')}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              {t('backToLogin')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
