'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { setLocale } from '@/app/actions/locale';

export function LangSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const change = (l: 'tr' | 'en') => {
    if (l === locale) return;
    start(async () => {
      await setLocale(l);
      router.refresh();
    });
  };

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold ${className}`}
      aria-busy={pending}
    >
      {(['tr', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          className={`px-2.5 py-1 transition-colors ${
            locale === l ? 'bg-primary text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
