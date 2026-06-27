'use client';

import { useLocale } from 'next-intl';
import { Check, Minus } from 'lucide-react';

type Tier = {
  name: string;
  nameEn: string;
  badge: string;
  badgeEn: string;
  monthlyFee: number;
  highlight: boolean;
};
type Row = {
  label: string;
  labelEn: string;
  user: boolean | string;
  member: boolean | string;
  leader: boolean | string;
};

// Canlı veri (backend/public) yoksa bu varsayılanlara düşülür.
const DEFAULT_TIERS: Tier[] = [
  { name: 'Kullanıcı', nameEn: 'User', badge: 'Ücretsiz', badgeEn: 'Free', monthlyFee: 0, highlight: false },
  { name: 'Ekip Üyesi', nameEn: 'Team Member', badge: 'Tavsiye', badgeEn: 'Recommended', monthlyFee: 30, highlight: true },
  { name: 'Ekip Lideri', nameEn: 'Team Leader', badge: 'Aidatsız', badgeEn: 'No fee', monthlyFee: 0, highlight: false },
];

const DEFAULT_ROWS: Row[] = [
  { label: 'Fiyat çarpanı', labelEn: 'Price multiplier', user: '2×', member: '1×', leader: '1×' },
  { label: 'Aylık aidat', labelEn: 'Monthly fee', user: '—', member: '$30', leader: '—' },
  { label: '$250 yükle → %40 indirim', labelEn: 'Load $250 → 40% off', user: true, member: true, leader: true },
  { label: 'Etsy mağaza bağlama', labelEn: 'Connect Etsy stores', user: true, member: true, leader: true },
  { label: 'Canlı m² fiyatlandırma', labelEn: 'Live m² pricing', user: true, member: true, leader: true },
  { label: 'Güvenli dosya yükleme (R2)', labelEn: 'Secure file upload (R2)', user: true, member: true, leader: true },
  { label: 'Öncelikli destek', labelEn: 'Priority support', user: false, member: true, leader: true },
  { label: 'Öncelikli üretim kuyruğu', labelEn: 'Priority production queue', user: false, member: true, leader: true },
  { label: 'Hacim indirimi', labelEn: 'Volume discount', user: false, member: true, leader: true },
  { label: 'Ekip yönetimi (üye davet)', labelEn: 'Team management', user: false, member: false, leader: true },
];

function Cell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (value === true)
    return <Check className={`h-4 w-4 mx-auto ${highlight ? 'text-primary' : 'text-brand-accent'}`} />;
  if (value === false) return <Minus className="h-4 w-4 mx-auto text-slate-300" />;
  return <span className={`text-sm font-medium ${highlight ? 'text-primary' : 'text-navy'}`}>{value}</span>;
}

export function PlanComparison({
  tiers,
  featureMatrix,
}: {
  tiers?: Tier[];
  featureMatrix?: Row[];
}) {
  const tr = useLocale() === 'tr';
  const cols = Array.isArray(tiers) && tiers.length === 3 ? tiers : DEFAULT_TIERS;
  const rows = Array.isArray(featureMatrix) && featureMatrix.length ? featureMatrix : DEFAULT_ROWS;

  const sub = (t: Tier) =>
    t.monthlyFee > 0 ? `$${t.monthlyFee}/${tr ? 'ay' : 'mo'}` : tr ? t.badge : t.badgeEn;

  return (
    <div className="mt-12 overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-4 pl-1">
              {tr ? 'Özellik' : 'Feature'}
            </th>
            {cols.map((c) => (
              <th key={c.name} className="pb-4 px-3 text-center">
                <div className={`text-sm font-semibold ${c.highlight ? 'text-primary' : 'text-navy'}`}>
                  {tr ? c.name : c.nameEn}
                </div>
                <div className="text-[11px] text-slate-400">{sub(c)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const vals: (boolean | string)[] = [r.user, r.member, r.leader];
            return (
              <tr key={r.label} className={ri % 2 ? 'bg-slate-50/60' : ''}>
                <td className="py-3 pl-3 pr-4 text-sm text-slate-600 rounded-l-lg">
                  {tr ? r.label : r.labelEn}
                </td>
                {vals.map((val, ci) => (
                  <td
                    key={ci}
                    className={`py-3 px-3 text-center ${ci === cols.length - 1 ? 'rounded-r-lg' : ''} ${
                      cols[ci]?.highlight ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <Cell value={val} highlight={cols[ci]?.highlight} />
                  </td>
                ))}
              </tr>
            );
          })}
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
