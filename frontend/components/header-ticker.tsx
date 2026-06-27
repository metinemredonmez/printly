'use client';

import { useEffect, useState } from 'react';

type Rate = { pair: string; value: number };

// Canlı döviz kuru — backend /public/ticker'dan (proxy ile), auth gerektirmez.
export function HeaderTicker() {
  const [rates, setRates] = useState<Rate[]>([]);

  useEffect(() => {
    let on = true;
    fetch('/api/be/public/ticker')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (on && Array.isArray(d?.rates)) setRates(d.rates.slice(0, 2));
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  if (!rates.length) return null;

  return (
    <div className="hidden lg:flex items-center gap-3 pr-1 text-xs text-slate-500 dark:text-slate-400">
      {rates.map((r) => (
        <span key={r.pair} className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-medium text-slate-600 dark:text-slate-300">{r.pair}</span>
          {r.value.toFixed(2)}
        </span>
      ))}
    </div>
  );
}
