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
    a: 'Duvar kağıdı m² bazlı, decal ve ahşap sabit fiyatlıdır. Ekip üyeleri 1× (yarı) fiyat öder; bakiyene $100/$200/$300 yükleyince %20/%30/%40 indirim açılır (bakiye bitince biter).',
    qEn: 'How does pricing work?',
    aEn: 'Wallpaper is priced per m², decals and wood are flat-priced. Team members pay 1× (half) price; loading $100/$200/$300 unlocks 20%/30%/40% off (ends when balance is used up).',
  },
  {
    q: 'Teslimat ne kadar sürer?',
    a: 'Üretim genellikle 2–5 iş günüdür; ABD içi kargo taşıyıcıya göre 3–7 iş günü sürer. Her aşamada durum güncellemesi alırsın.',
    qEn: 'How long does delivery take?',
    aEn: 'Production is typically 2–5 business days; domestic US shipping takes 3–7 business days depending on the carrier. You get status updates at every stage.',
  },
  {
    q: 'Sipariş iptal veya iade nasıl olur?',
    a: 'Üretime girmeden iptal edilen bakiye siparişlerinde tutar otomatik cüzdana iade edilir. Üretim sonrası kusurlu işlerde yeniden baskı veya iade değerlendirilir.',
    qEn: 'How do cancellations and refunds work?',
    aEn: 'Balance orders cancelled before production are auto-refunded to your wallet. For defective items after production, a reprint or refund is evaluated.',
  },
];

export function LandingFaq({ tr, faqs }: { tr: boolean; faqs?: Faq[] }) {
  const list = Array.isArray(faqs) && faqs.length ? faqs : DEFAULT_FAQS;

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center space-y-3 mb-10">
        <h2 className="text-2xl font-semibold text-navy dark:text-white">{tr ? 'Sıkça Sorulan Sorular' : 'Frequently Asked Questions'}</h2>
        <p className="text-slate-500 dark:text-slate-400">
          {tr ? 'Aklındaki ilk sorular — gerisi için ' : 'The first questions — for more see the '}
          <a href="/faq" className="text-primary hover:underline">{tr ? 'tüm SSS' : 'full FAQ'}</a>.
        </p>
      </div>

      <div className="space-y-3">
        {list.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 [&_summary]:list-none open:shadow-sm"
          >
            <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer text-sm font-medium text-navy dark:text-white">
              {tr ? f.q : f.qEn}
              <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="pb-4 -mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{tr ? f.a : f.aEn}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
