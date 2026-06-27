import { ChevronDown } from 'lucide-react';
import type { Faq } from '@/lib/public';

const DEFAULT_FAQS: Faq[] = [
  {
    q: 'Ortak Doku nedir?',
    a: 'Bayilerin Etsy mağazalarında ABD pazarına duvar kağıdı, wall decal ve ahşap/CNC ürünleri sattığı bir B2B print-on-demand üretim ve operasyon altyapısıdır.',
    qEn: 'What is Ortak Doku?',
    aEn: 'A B2B print-on-demand production & operations platform where resellers sell wallpaper, wall decals and wood/CNC products to the US market via their Etsy stores.',
  },
  {
    q: 'Nasıl başlarım?',
    a: 'Başvuru formunu doldur, üyelik planını seç, Etsy mağazanı bağla ve ilk siparişini ver.',
    qEn: 'How do I start?',
    aEn: 'Fill the application, pick a membership plan, connect your Etsy store and place your first order.',
  },
  {
    q: 'Fiyatlandırma nasıl çalışır?',
    a: 'Duvar kağıdı m² bazlı, decal ve ahşap sabit fiyatlıdır. Ekip üyeleri 1× (yarı) fiyat öder; $250 yükleyince %40 indirim açılır.',
    qEn: 'How does pricing work?',
    aEn: 'Wallpaper is priced per m², decals and wood are flat-priced. Team members pay 1× (half) price; loading $250 unlocks a 40% discount.',
  },
];

export function LandingFaq({ tr, faqs }: { tr: boolean; faqs?: Faq[] }) {
  const list = faqs && faqs.length ? faqs : DEFAULT_FAQS;

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center space-y-3 mb-10">
        <h2 className="text-3xl font-semibold text-navy">{tr ? 'Sıkça Sorulan Sorular' : 'Frequently Asked Questions'}</h2>
        <p className="text-slate-500">
          {tr ? 'Aklındaki ilk sorular — gerisi için ' : 'The first questions — for more see the '}
          <a href="/faq" className="text-primary hover:underline">{tr ? 'tüm SSS' : 'full FAQ'}</a>.
        </p>
      </div>

      <div className="space-y-3">
        {list.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-slate-100 bg-white px-5 [&_summary]:list-none open:shadow-sm"
          >
            <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer text-sm font-medium text-navy">
              {tr ? f.q : f.qEn}
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="pb-4 -mt-1 text-sm text-slate-500 leading-relaxed">{tr ? f.a : f.aEn}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
