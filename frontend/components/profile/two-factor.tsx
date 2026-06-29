'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Setup = { otpauthUrl: string; qrDataUrl: string; secret: string };

// 2FA (TOTP) kurulum/yönetim — backend /auth/2fa/{status,setup,enable,disable}.
export function TwoFactor() {
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: () => api<{ enabled: boolean }>('/auth/2fa/status'),
  });
  const enabled = !!status.data?.enabled;

  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['2fa', 'status'] });
  const err = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Hata');

  const begin = useMutation({
    mutationFn: () => api<Setup>('/auth/2fa/setup', { method: 'POST' }),
    onSuccess: (d) => setSetup(d),
    onError: err,
  });
  const enable = useMutation({
    mutationFn: () => api<{ recoveryCodes: string[] }>('/auth/2fa/enable', { method: 'POST', json: { code } }),
    onSuccess: (d) => {
      setRecovery(d.recoveryCodes);
      setSetup(null);
      setCode('');
      refresh();
      toast.success(tr ? '2FA açıldı' : '2FA enabled');
    },
    onError: err,
  });
  const disable = useMutation({
    mutationFn: () => api('/auth/2fa/disable', { method: 'POST', json: { code } }),
    onSuccess: () => {
      setCode('');
      refresh();
      toast.success(tr ? '2FA kapatıldı' : '2FA disabled');
    },
    onError: err,
  });

  const fieldCls = 'max-w-[150px] bg-slate-50 dark:bg-slate-800';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-xl bg-violet-50 dark:bg-violet-500/15 text-violet-600 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="font-semibold text-navy dark:text-white">
          {tr ? 'İki Adımlı Doğrulama (2FA)' : 'Two-Factor Authentication'}
        </div>
        {enabled && (
          <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            {tr ? 'Açık' : 'On'}
          </span>
        )}
      </div>

      {recovery ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {tr ? 'Kurtarma kodlarını güvenli bir yere kaydet — bir daha gösterilmez:' : 'Save your recovery codes — shown only once:'}
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recovery.map((c) => (
              <div key={c} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-navy dark:text-slate-200">
                {c}
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setRecovery(null)}>
            {tr ? 'Tamam' : 'Done'}
          </Button>
        </div>
      ) : enabled ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {tr ? 'Hesabın 2FA ile korunuyor. Kapatmak için authenticator kodunu gir.' : 'Your account is protected by 2FA. Enter your code to disable.'}
          </p>
          <div className="flex items-center gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" className={fieldCls} />
            <Button size="sm" variant="outline" onClick={() => disable.mutate()} disabled={disable.isPending || code.length < 6}>
              {tr ? '2FA Kapat' : 'Disable'}
            </Button>
          </div>
        </div>
      ) : setup ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {tr ? 'Authenticator uygulamasıyla (Google Authenticator/Authy) QR’ı tara, sonra 6 haneli kodu gir:' : 'Scan the QR with an authenticator app, then enter the 6-digit code:'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrDataUrl} alt="2FA QR" className="h-40 w-40 rounded-lg border border-slate-100 dark:border-slate-800" />
            <div className="space-y-2 text-sm">
              <div className="text-slate-500 dark:text-slate-400">{tr ? 'Manuel anahtar:' : 'Manual key:'}</div>
              <code className="block px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-navy dark:text-slate-200 break-all">
                {setup.secret}
              </code>
              <div className="flex items-center gap-2 pt-1">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" className={fieldCls} />
                <Button size="sm" onClick={() => enable.mutate()} disabled={enable.isPending || code.length < 6}>
                  {tr ? 'Etkinleştir' : 'Enable'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {tr ? 'Girişte ek güvenlik için authenticator tabanlı 2FA aç.' : 'Add authenticator-based 2FA for extra login security.'}
          </p>
          <Button size="sm" onClick={() => begin.mutate()} disabled={begin.isPending}>
            {begin.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
            {tr ? '2FA’yı Aç' : 'Enable 2FA'}
          </Button>
        </div>
      )}
    </div>
  );
}
