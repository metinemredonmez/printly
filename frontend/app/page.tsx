import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import {
  Rocket,
  ArrowRight,
  Factory,
  LineChart,
  Settings2,
  Truck,
  Code2,
  Handshake,
  LogIn,
  type LucideIcon,
} from 'lucide-react';
import { LangSwitcher } from '@/components/lang-switcher';
import { SiteFooter } from '@/components/site-footer';
import { Logo } from '@/components/logo';
import { HeroSlider } from '@/components/hero-slider';
import { ProfitCalculator } from '@/components/profit-calculator';
import { PlanComparison } from '@/components/plan-comparison';
import { ProductShowcase } from '@/components/product-showcase';
import { TrustBand } from '@/components/trust-band';
import { LandingFaq } from '@/components/landing-faq';
import { IntegrationsBand } from '@/components/integrations-band';
import { getLandingData } from '@/lib/public';
import { ThemeToggle } from '@/components/theme-toggle';
import { HeaderTicker } from '@/components/header-ticker';
import { ScrollReveal } from '@/components/scroll-reveal';

const CAP_ICONS: LucideIcon[] = [Factory, LineChart, Settings2, Truck, Code2, Handshake];
// her kapasite kartı için başlığa uygun renk vurgusu (ikon + ince blob)
const CAP_ACCENT = [
  { tile: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15', blob: 'bg-blue-200 dark:bg-blue-500/25' },
  { tile: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15', blob: 'bg-emerald-200 dark:bg-emerald-500/25' },
  { tile: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15', blob: 'bg-violet-200 dark:bg-violet-500/25' },
  { tile: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15', blob: 'bg-amber-200 dark:bg-amber-500/25' },
  { tile: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15', blob: 'bg-sky-200 dark:bg-sky-500/25' },
  { tile: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15', blob: 'bg-rose-200 dark:bg-rose-500/25' },
];
// başlıkla alakalı blurlu arka görseller (sırayla kartlarla eşleşir)
const CARD_IMG = [
  '/banners/card-uretim.jpg', // Üretim Ağı
  '/banners/card-siparis.jpg', // Sipariş Yönetimi
  '/banners/card-operasyon.jpg', // Operasyonel Sistemler
  '/banners/card-fulfillment.jpg', // Fulfillment
  '/banners/card-teknoloji.jpg', // Teknoloji
  '/banners/card-ortaklik.jpg', // İş Ortaklıkları
];
const PLAN_COLORS = ['border-slate-200 dark:border-slate-800', 'border-primary ring-2 ring-primary/20', 'border-amber-200'];

type Cap = { title: string; desc: string };
type Plan = { name: string; badge: string; price: string; features: string[] };

export default async function Home() {
  const t = await getTranslations('landing');
  const tc = await getTranslations('common');
  const caps = t.raw('caps') as Cap[];
  const plans = t.raw('plans') as Plan[];
  const i18nStats = t.raw('stats') as { value: string; label: string }[];
  const steps = t.raw('steps') as { title: string; desc: string }[];
  const testimonials = t.raw('testimonials') as { quote: string; name: string; role: string }[];
  const locale = await getLocale();
  const tr = locale === 'tr';
  // Canlı landing verisi (backend kapalıysa null → bileşenler varsayılana düşer)
  const landing = await getLandingData();
  // İstatistik bandı: admin landing.stats varsa canlı, yoksa i18n varsayılan
  const liveStats = landing?.content?.stats;
  const stats =
    Array.isArray(liveStats) && liveStats.length
      ? liveStats.map((s) => ({ value: s.value, label: tr ? s.label : s.labelEn }))
      : i18nStats;

  const nav = [
    { href: '#ecosystem', label: t('navEcosystem') },
    { href: '#operations', label: t('navOperations') },
    { href: '#production', label: t('navProduction') },
    { href: '#technology', label: t('navTechnology') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] dark:bg-slate-950">
      {/* NAV */}
      <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Logo className="h-11 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-primary transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <HeaderTicker />
            <ThemeToggle />
            <LangSwitcher />
            <Link
              href="/login"
              className="px-4 h-9 inline-flex items-center gap-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
            >
              <LogIn className="h-4 w-4" />
              {tc('login')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <ScrollReveal />
        {/* HERO */}
        <section id="ecosystem" className="relative isolate overflow-hidden">
          {/* arka plan slaytı (otomatik geçiş) */}
          <HeroSlider />
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(55% 50% at 12% 8%, rgba(31,94,255,0.10), transparent 70%), radial-gradient(45% 50% at 90% 25%, rgba(107,142,35,0.10), transparent 70%)',
            }}
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-7">
              <span
                className="od-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-sm"
                style={{ animationDelay: '0.05s' }}
              >
                <Rocket className="h-3.5 w-3.5" /> {t('badge')}
              </span>
              <h1
                className="od-fade-up text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-tight tracking-tight"
                style={{ animationDelay: '0.15s' }}
              >
                {t('heroTitle')}
              </h1>
              <p
                className="od-fade-up text-lg text-slate-100 font-medium leading-relaxed"
                style={{ animationDelay: '0.25s' }}
              >
                {t('heroDesc1')}
              </p>
              <p className="od-fade-up text-slate-200 leading-relaxed" style={{ animationDelay: '0.32s' }}>
                {t('heroDesc2')}
              </p>
              <div className="od-fade-up pt-2" style={{ animationDelay: '0.4s' }}>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {t('applyNow')} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Network illüstrasyonu */}
            <div className="lg:col-span-5 hidden lg:flex items-center justify-center">
              <div className="od-float relative w-full max-w-md">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-emerald-100 rounded-full blur-3xl opacity-60" />
                <svg className="relative w-full h-auto" viewBox="0 0 400 400" fill="none">
                  <circle cx="200" cy="200" r="160" stroke="#1F5EFF" strokeWidth="2" strokeDasharray="8 8" className="od-spin-slow" style={{ transformOrigin: '200px 200px' }} />
                  <circle cx="200" cy="200" r="100" stroke="#6B8E23" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="200" y1="40" x2="40" y2="200" stroke="#CBD5E1" strokeWidth="2" opacity="0.3" />
                  <line x1="200" y1="40" x2="360" y2="200" stroke="#CBD5E1" strokeWidth="2" opacity="0.3" />
                  <line x1="40" y1="200" x2="200" y2="360" stroke="#1F5EFF" strokeWidth="2" opacity="0.3" />
                  <line x1="360" y1="200" x2="200" y2="360" stroke="#6B8E23" strokeWidth="2" opacity="0.3" />
                  <circle cx="200" cy="40" r="12" fill="#CBD5E1" />
                  <circle cx="200" cy="360" r="12" fill="#CBD5E1" />
                  <circle cx="40" cy="200" r="12" fill="#1F5EFF" />
                  <circle cx="360" cy="200" r="12" fill="#6B8E23" />
                  <circle cx="100" cy="100" r="8" fill="#1F5EFF" />
                  <circle cx="300" cy="300" r="8" fill="#1F5EFF" />
                  <circle cx="300" cy="100" r="8" fill="#6B8E23" />
                  <circle cx="100" cy="300" r="8" fill="#CBD5E1" />
                  <circle cx="200" cy="200" r="40" fill="#CBD5E1" />
                  <circle cx="200" cy="200" r="30" fill="#1F5EFF" />
                  <circle cx="200" cy="200" r="15" fill="#6B8E23" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        <TrustBand tr={tr} badges={landing?.content.trustBadges} />

        {/* İSTATİSTİK BANDI */}
        <section className="border-y border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-semibold text-primary">{s.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 6 KAPASİTE */}
        <section id="operations" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-3xl font-semibold text-navy dark:text-white">{t('capsTitle')}</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">{t('capsSubtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {caps.map((c, i) => {
              const Icon = CAP_ICONS[i] ?? Factory;
              const a = CAP_ACCENT[i % CAP_ACCENT.length];
              return (
                <div
                  key={c.title}
                  className="od-fade-up group relative overflow-hidden bg-white dark:bg-slate-900 p-7 rounded-3xl border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all"
                  style={{ animationDelay: `${0.08 + i * 0.07}s` }}
                >
                  {/* başlığa uygun blurlu arka görsel (hafif) */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.55] dark:opacity-[0.6] blur-[1px] scale-110 group-hover:opacity-75 transition-opacity duration-300"
                    style={{ backgroundImage: `url(${CARD_IMG[i % CARD_IMG.length]})` }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/92 via-white/72 to-white/30 dark:from-slate-900/92 dark:via-slate-900/72 dark:to-slate-900/30" />
                  {/* başlık konusuna uygun ince renk vurgusu */}
                  <div
                    className={`pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full blur-2xl opacity-50 group-hover:opacity-70 transition-opacity ${a.blob}`}
                  />
                  <div className="relative space-y-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${a.tile}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-navy dark:text-white">{c.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ÜRÜN VİTRİNİ */}
        <ProductShowcase tr={tr} categories={landing?.categories} products={landing?.products} />

        {/* NASIL ÇALIŞIR */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-3xl font-semibold text-navy dark:text-white">{t('howTitle')}</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">{t('howSubtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center font-semibold mb-4">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-navy dark:text-white">{s.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{s.desc}</p>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute top-1/2 -right-3 h-5 w-5 text-slate-300 dark:text-slate-600" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* KÂR HESAPLAYICI */}
        <ProfitCalculator categories={landing?.categories} />

        {/* ÜYELİK PLANLARI */}
        <section id="production" className="bg-white dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-semibold text-navy dark:text-white mb-2">{t('plansTitle')}</h2>
              <p className="text-slate-500 dark:text-slate-400">{t('plansSubtitle')}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((p, i) => (
                <div
                  key={p.name}
                  className={`od-fade-up rounded-3xl border-2 ${PLAN_COLORS[i]} p-7 bg-white dark:bg-slate-900 hover:-translate-y-1 transition-transform`}
                  style={{ animationDelay: `${0.1 + i * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-semibold text-navy dark:text-white">{p.name}</h3>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:text-slate-300">
                      {p.badge}
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-primary mb-4">{p.price}</div>
                  <ul className="space-y-2 mb-6">
                    {p.features.map((ft) => (
                      <li key={ft} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-accent shrink-0" />
                        {ft}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className="block text-center px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm transition-colors"
                  >
                    {t('startWithPlan')}
                  </Link>
                </div>
              ))}
            </div>

            {/* Plan karşılaştırma matrisi */}
            <PlanComparison tiers={landing?.tiers} featureMatrix={landing?.featureMatrix} />
          </div>
        </section>

        {/* SSS */}
        <LandingFaq tr={tr} faqs={landing?.content.faqs} />

        {/* MÜŞTERİ YORUMLARI */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-3 mb-10">
            <h2 className="text-3xl font-semibold text-navy dark:text-white">{t('testiTitle')}</h2>
            <p className="text-slate-500 dark:text-slate-400">{t('testiSubtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((tt) => (
              <figure key={tt.name} className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 flex flex-col">
                <div className="text-primary text-3xl leading-none font-serif">&ldquo;</div>
                <blockquote className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1 -mt-2">{tt.quote}</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <span className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                    {tt.name.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-navy dark:text-white">{tt.name}</span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">{tt.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ENTEGRASYONLAR */}
        <IntegrationsBand tr={tr} integrations={landing?.content.integrations} />

        {/* CTA */}
        <section id="technology" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="bg-navy text-white p-10 md:p-14 rounded-3xl grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <h2 className="text-2xl md:text-3xl font-semibold">{t('ctaTitle')}</h2>
              <p className="text-slate-300 leading-relaxed">{t('ctaDesc')}</p>
            </div>
            <div className="lg:col-span-4 lg:text-right">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t('applyNow')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
