'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const tr = useLocale() === 'tr';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-white rounded-2xl border border-slate-100 shadow-sm p-10">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
          <Compass className="h-8 w-8 text-primary" />
        </div>
        <div className="text-5xl font-extrabold text-navy tracking-tight">404</div>
        <h1 className="text-lg font-bold text-navy mt-2">
          {tr ? 'Sayfa bulunamadı' : 'Page not found'}
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {tr
            ? 'Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.'
            : 'The page you are looking for may have moved or never existed.'}
        </p>
        <div className="mt-6">
          <Button render={<Link href="/" />}>
            <Home className="h-4 w-4 mr-1" />
            {tr ? 'Ana sayfaya dön' : 'Back to home'}
          </Button>
        </div>
      </div>
    </div>
  );
}
