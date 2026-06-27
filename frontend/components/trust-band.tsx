import { ShieldCheck } from 'lucide-react';
import type { Bilingual } from '@/lib/public';

const DEFAULT_BADGES: Bilingual[] = [
  { label: 'Etsy entegre', labelEn: 'Etsy integrated' },
  { label: 'R2 güvenli depolama', labelEn: 'R2 secure storage' },
  { label: 'ABD’ye kargo', labelEn: 'Ships to US' },
  { label: 'TIFF/DPI doğrulama', labelEn: 'TIFF/DPI validation' },
  { label: 'Dijital proof onayı', labelEn: 'Digital proof approval' },
];

export function TrustBand({ tr, badges }: { tr: boolean; badges?: Bilingual[] }) {
  const list = badges && badges.length ? badges : DEFAULT_BADGES;

  return (
    <div className="border-y border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {list.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck className="h-4 w-4 text-brand-accent shrink-0" />
            {tr ? b.label : b.labelEn}
          </span>
        ))}
      </div>
    </div>
  );
}
