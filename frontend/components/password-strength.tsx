'use client';

import { useTranslations } from 'next-intl';

export function scorePassword(pw: string): number {
  let s = 0;
  if (!pw) return 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4); // 0-4
}

const BAR_COLORS = ['bg-slate-200', 'bg-rose-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500'];

export function PasswordStrength({ value }: { value: string }) {
  const t = useTranslations('auth');
  const score = scorePassword(value);
  const labels = [t('pwNone'), t('pwWeak'), t('pwFair'), t('pwGood'), t('pwStrong')];
  if (!value) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score ? BAR_COLORS[score] : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        {t('pwStrength')}: <span className="font-medium">{labels[score]}</span>
      </p>
    </div>
  );
}
