'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const tr = useLocale() === 'tr';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-white rounded-2xl border border-slate-100 shadow-sm p-10">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-50 flex items-center justify-center mb-5">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
        </div>
        <h1 className="text-xl font-extrabold text-navy">
          {tr ? 'Bir şeyler ters gitti' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {tr
            ? 'Beklenmeyen bir hata oluştu. Tekrar deneyebilir veya sayfayı yenileyebilirsiniz.'
            : 'An unexpected error occurred. You can try again or reload the page.'}
        </p>
        {error.digest && (
          <p className="text-[11px] text-slate-300 mt-3 font-mono">#{error.digest}</p>
        )}
        <div className="mt-6">
          <Button onClick={reset}>
            <RotateCw className="h-4 w-4 mr-1" />
            {tr ? 'Tekrar dene' : 'Try again'}
          </Button>
        </div>
      </div>
    </div>
  );
}
