'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowRight, TrendingUp } from 'lucide-react';

// Üye (1×) maliyet fiyatları — canlı katalog verisi yoksa bu varsayılanlara düşer
type LiveCat = { key: string; minPrice: number | null };
const BASE = [
  { key: 'wallpaper', cat: 'WALLPAPER', tr: 'Duvar Kağıdı', en: 'Wallpaper', unit: 'm2' as const, fallback: 23 },
  { key: 'decal', cat: 'WALL_DECAL', tr: 'Wall Decal', en: 'Wall Decal', unit: 'flat' as const, fallback: 15 },
  { key: 'wood', cat: 'WOOD', tr: 'Wood / CNC', en: 'Wood / CNC', unit: 'flat' as const, fallback: 35 },
];

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function ProfitCalculator({ categories }: { categories?: LiveCat[] }) {
  const tr = useLocale() === 'tr';
  // Canlı kategori fiyatı (en düşük 1× fiyat) varsa onu, yoksa varsayılanı kullan
  const PRODUCTS = BASE.map((b) => {
    const live = categories?.find((c) => c.key === b.cat);
    return { ...b, price: live?.minPrice && live.minPrice > 0 ? live.minPrice : b.fallback };
  });
  const [pi, setPi] = useState(0);
  const [w, setW] = useState(24);
  const [h, setH] = useState(36);
  const [markup, setMarkup] = useState(2.6);
  const [perMonth, setPerMonth] = useState(20);

  const p = PRODUCTS[pi];
  const sqm = p.unit === 'm2' ? ((w * h) / 144) * 0.092903 : 1;
  const cost = p.unit === 'm2' ? sqm * p.price : p.price;
  const sell = cost * markup;
  const unitProfit = Math.max(0, sell - cost);
  const annual = unitProfit * perMonth * 12;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center space-y-3 mb-10">
        <h2 className="text-3xl font-semibold text-navy dark:text-white">
          {tr ? 'Ne kadar kazanırsın?' : 'How much can you earn?'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          {tr
            ? 'Üye (1×) maliyetin ile Etsy satış fiyatın arasındaki kârı anında gör.'
            : 'See the profit between your member (1×) cost and your Etsy selling price instantly.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Sol: girdiler */}
        <div className="bg-white dark:bg-slate-900 p-7 sm:p-9 space-y-6">
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{tr ? 'Ürün' : 'Product'}</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {PRODUCTS.map((pr, i) => (
                <button
                  key={pr.key}
                  type="button"
                  onClick={() => setPi(i)}
                  className={`px-2 py-2 rounded-xl text-xs font-medium border-2 transition-all ${
                    pi === i ? 'border-primary bg-blue-50 dark:bg-blue-500/10 text-primary' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  {tr ? pr.tr : pr.en}
                </button>
              ))}
            </div>
          </div>

          {p.unit === 'm2' && (
            <div className="grid grid-cols-2 gap-3">
              <Range label={tr ? 'Genişlik (inç)' : 'Width (in)'} value={w} min={6} max={120} onChange={setW} />
              <Range label={tr ? 'Yükseklik (inç)' : 'Height (in)'} value={h} min={6} max={120} onChange={setH} />
              <p className="col-span-2 text-xs text-slate-400 dark:text-slate-500">
                {tr ? 'Alan' : 'Area'}: {sqm.toFixed(2)} m²
              </p>
            </div>
          )}

          <Range
            label={tr ? 'Satış fiyatı çarpanı' : 'Sell price multiplier'}
            value={markup}
            min={1.5}
            max={5}
            step={0.1}
            onChange={setMarkup}
            suffix="×"
          />
          <Range
            label={tr ? 'Aylık satış adedi' : 'Sales per month'}
            value={perMonth}
            min={1}
            max={200}
            onChange={setPerMonth}
          />
        </div>

        {/* Sağ: sonuç */}
        <div className="bg-navy text-white p-7 sm:p-9 flex flex-col justify-center">
          <div className="space-y-3 text-sm">
            <Row label={tr ? 'Senin maliyetin (1× üye)' : 'Your cost (1× member)'} value={money(cost)} />
            <Row label={tr ? 'Etsy satış fiyatın' : 'Your Etsy price'} value={money(sell)} />
            <Row label={tr ? 'Birim kâr' : 'Profit per unit'} value={money(unitProfit)} accent />
            <div className="border-t border-white/10 pt-4">
              <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-brand-accent" />
                {tr ? 'Yaklaşık yıllık kârın' : 'Approx. annual profit'}
              </div>
              <div className="text-4xl sm:text-5xl font-semibold mt-1">{money(annual)}</div>
            </div>
          </div>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
          >
            {tr ? 'Şimdi Başvur' : 'Apply Now'} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
            {tr
              ? '* Tahmini. Etsy komisyonu, kargo ve vergiler hariç. Üye (1×) fiyat baz alınmıştır.'
              : '* Estimate. Excludes Etsy fees, shipping and taxes. Based on member (1×) price.'}
          </p>
        </div>
      </div>
    </section>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-semibold text-navy dark:text-white">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-300">{label}</span>
      <span className={`font-semibold ${accent ? 'text-brand-accent' : 'text-white'}`}>{value}</span>
    </div>
  );
}
