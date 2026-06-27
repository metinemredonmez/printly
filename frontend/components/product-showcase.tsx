import Link from 'next/link';
import { Square, Sticker, TreePine, ArrowRight, type LucideIcon } from 'lucide-react';
import type { LandingCategory, LandingProduct } from '@/lib/public';

type Meta = { tr: string; en: string; descTr: string; descEn: string; unitTr: string; unitEn: string; icon: LucideIcon; grad: string; chip: string };

const CAT_META: Record<string, Meta> = {
  WALLPAPER: {
    tr: 'Duvar Kağıdı', en: 'Wallpaper',
    descTr: 'm² bazlı, ölçüye göre üretilen büyük format duvar kağıtları.',
    descEn: 'Large-format wallpapers produced to size, priced per m².',
    unitTr: '/m²', unitEn: '/m²', icon: Square,
    grad: 'from-blue-500/90 to-blue-700/90', chip: 'bg-blue-50 text-blue-700',
  },
  WALL_DECAL: {
    tr: 'Wall Decal', en: 'Wall Decal',
    descTr: 'Kolay uygulanan, çıkarılabilir duvar sticker’ları.',
    descEn: 'Easy-apply, removable wall stickers.',
    unitTr: 'sabit', unitEn: 'flat', icon: Sticker,
    grad: 'from-emerald-500/90 to-emerald-700/90', chip: 'bg-emerald-50 text-emerald-700',
  },
  WOOD: {
    tr: 'Ahşap / CNC', en: 'Wood / CNC',
    descTr: 'CNC ile oyulan ahşap dekoratif paneller ve tabelalar.',
    descEn: 'CNC-carved decorative wood panels and signs.',
    unitTr: 'sabit', unitEn: 'flat', icon: TreePine,
    grad: 'from-amber-500/90 to-amber-700/90', chip: 'bg-amber-50 text-amber-700',
  },
};

const ORDER = ['WALLPAPER', 'WALL_DECAL', 'WOOD'];
const money = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export function ProductShowcase({
  tr,
  categories,
  products,
}: {
  tr: boolean;
  categories?: LandingCategory[];
  products?: LandingProduct[];
}) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center space-y-3 mb-10">
        <h2 className="text-3xl font-semibold text-navy">{tr ? 'Ürün Kategorileri' : 'Product Categories'}</h2>
        <p className="text-slate-500 max-w-2xl mx-auto">
          {tr
            ? 'Üç çekirdek üretim hattı — her biri Etsy’de satışa hazır.'
            : 'Three core production lines — each ready to sell on Etsy.'}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {ORDER.map((key) => {
          const meta = CAT_META[key];
          const Icon = meta.icon;
          const cat = categories?.find((c) => c.key === key);
          const items = (products ?? []).filter((p) => p.category === key);
          const img = items.find((p) => p.imageUrl)?.imageUrl ?? null;
          const names = items.slice(0, 3).map((p) => p.name);
          const minPrice = cat?.minPrice ?? null;
          const unit = tr ? meta.unitTr : meta.unitEn;

          return (
            <div
              key={key}
              className="group rounded-3xl border border-slate-100 bg-white overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col"
            >
              {/* Görsel başlık: admin ürün görseli set ettiyse foto, yoksa markalı gradient */}
              <div className="relative h-40 overflow-hidden">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={meta.tr} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${meta.grad}`} />
                )}
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute top-4 left-4 h-11 w-11 rounded-2xl bg-white/90 backdrop-blur flex items-center justify-center text-navy">
                  <Icon className="h-5 w-5" />
                </div>
                {minPrice != null && (
                  <span className="absolute bottom-3 right-3 text-xs font-medium px-2.5 py-1 rounded-full bg-white/90 text-navy">
                    {tr ? 'başlangıç' : 'from'} {money(minPrice)} {unit}
                  </span>
                )}
              </div>

              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-navy">{tr ? meta.tr : meta.en}</h3>
                  {cat && cat.count > 0 && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.chip}`}>
                      {cat.count} {tr ? 'ürün' : 'products'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{tr ? meta.descTr : meta.descEn}</p>
                {names.length > 0 && (
                  <ul className="text-xs text-slate-400 space-y-1">
                    {names.map((n) => (
                      <li key={n} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-brand-accent" />
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/register"
                  className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  {tr ? 'Satışa başla' : 'Start selling'} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
