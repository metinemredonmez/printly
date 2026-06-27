'use client';

import { useLocale } from 'next-intl';
import { Check, Minus } from 'lucide-react';

// 3 üyelik: Kullanıcı (free, 2×) · Ekip Üyesi ($30/ay, 1×, tavsiye) · Ekip Lideri (aidatsız, 1×)
const COLS = [
  { tr: 'Kullanıcı', en: 'User', sub: 'Ücretsiz', subEn: 'Free' },
  { tr: 'Ekip Üyesi', en: 'Team Member', sub: '$30/ay', subEn: '$30/mo', highlight: true },
  { tr: 'Ekip Lideri', en: 'Team Leader', sub: 'Aidatsız', subEn: 'No fee' },
];

// values: true=✓, false=—, ya da metin
const ROWS: { tr: string; en: string; v: (boolean | string)[] }[] = [
  { tr: 'Fiyat çarpanı', en: 'Price multiplier', v: ['2×', '1×', '1×'] },
  { tr: 'Aylık aidat', en: 'Monthly fee', v: ['—', '$30', '—'] },
  { tr: '$250 yükle → %40 indirim', en: 'Load $250 → 40% off', v: [true, true, true] },
  { tr: 'Etsy mağaza bağlama', en: 'Connect Etsy stores', v: [true, true, true] },
  { tr: 'Canlı m² fiyatlandırma', en: 'Live m² pricing', v: [true, true, true] },
  { tr: 'Güvenli dosya yükleme (R2)', en: 'Secure file upload (R2)', v: [true, true, true] },
  { tr: 'Öncelikli destek', en: 'Priority support', v: [false, true, true] },
  { tr: 'Öncelikli üretim kuyruğu', en: 'Priority production queue', v: [false, true, true] },
  { tr: 'Hacim indirimi', en: 'Volume discount', v: [false, true, true] },
  { tr: 'Ekip yönetimi (üye davet)', en: 'Team management (invite)', v: [false, false, true] },
];

function Cell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (value === true)
    return <Check className={`h-4 w-4 mx-auto ${highlight ? 'text-primary' : 'text-brand-accent'}`} />;
  if (value === false) return <Minus className="h-4 w-4 mx-auto text-slate-300" />;
  return <span className={`text-sm font-medium ${highlight ? 'text-primary' : 'text-navy'}`}>{value}</span>;
}

export function PlanComparison() {
  const tr = useLocale() === 'tr';

  return (
    <div className="mt-12 overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-4 pl-1">
              {tr ? 'Özellik' : 'Feature'}
            </th>
            {COLS.map((c) => (
              <th key={c.tr} className="pb-4 px-3 text-center">
                <div
                  className={`text-sm font-semibold ${c.highlight ? 'text-primary' : 'text-navy'}`}
                >
                  {tr ? c.tr : c.en}
                </div>
                <div className="text-[11px] text-slate-400">{tr ? c.sub : c.subEn}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, ri) => (
            <tr key={r.tr} className={ri % 2 ? 'bg-slate-50/60' : ''}>
              <td className="py-3 pl-3 pr-4 text-sm text-slate-600 rounded-l-lg">{tr ? r.tr : r.en}</td>
              {r.v.map((val, ci) => (
                <td
                  key={ci}
                  className={`py-3 px-3 text-center ${ci === COLS.length - 1 ? 'rounded-r-lg' : ''} ${
                    COLS[ci].highlight ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <Cell value={val} highlight={COLS[ci].highlight} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-slate-400 mt-3 pl-1">
        {tr
          ? 'Tüm planlar $250 yükleme sonrası %40 indirim ve canlı fiyatlandırmadan yararlanır.'
          : 'All plans benefit from the 40% discount after a $250 load and live pricing.'}
      </p>
    </div>
  );
}
