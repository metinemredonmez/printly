'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, CircleCheck, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LangSwitcher } from '@/components/lang-switcher';
import { PasswordStrength, scorePassword } from '@/components/password-strength';
import { LogoMark } from '@/components/logo';
import { api } from '@/lib/api';

export default function ForgotPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
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
    if (scorePassword(newPassword) < 2) {
      toast.error(t('pwWeak'));
      return;
    }
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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Sol marka paneli */}
      <div className="relative hidden lg:flex flex-col justify-between bg-navy text-white p-12 overflow-hidden">
        <Link href="/" className="relative z-10 flex items-center gap-3 w-fit">
          <span className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center">
            <LogoMark className="h-7 w-7" />
          </span>
          <span className="font-extrabold text-xl">{tc('appName')}</span>
        </Link>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-extrabold leading-tight">{t('brandHeadline')}</h2>
          <p className="text-slate-300 text-lg">{t('brandSub')}</p>
          <ul className="space-y-3 pt-2">
            {[t('feat1'), t('feat2'), t('feat3')].map((x) => (
              <li key={x} className="flex items-center gap-3 text-slate-200">
                <CircleCheck className="h-5 w-5 text-brand-accent shrink-0" />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 text-xs text-slate-500">© 2026 Ortak Doku — B2B Print-on-Demand</div>
        <svg className="absolute -right-24 -bottom-24 w-[28rem] h-[28rem] opacity-30" viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="160" stroke="#1F5EFF" strokeWidth="2" strokeDasharray="8 8" />
          <circle cx="200" cy="200" r="100" stroke="#6B8E23" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="200" cy="200" r="40" fill="#1F5EFF" opacity="0.4" />
        </svg>
      </div>

      {/* Sağ form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> {t('backToLogin')}
            </Link>
            <LangSwitcher />
          </div>

          <div className="mb-6">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center mb-3">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-navy">{t('forgotTitle')}</h1>
            <p className="text-sm text-slate-500">
              {step === 1 ? t('forgotHint1') : t('forgotHint2')}
            </p>
          </div>

          <form onSubmit={step === 1 ? sendCode : reset} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                required
                disabled={step === 2}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-slate-50"
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
                    className="h-11 bg-slate-50"
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
                    className="h-11 bg-slate-50"
                  />
                  <PasswordStrength value={newPassword} />
                </div>
              </>
            )}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {step === 1 ? t('sendResetCode') : t('updatePassword')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
