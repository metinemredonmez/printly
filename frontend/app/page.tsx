import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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

const CAP_ICONS: LucideIcon[] = [Factory, LineChart, Settings2, Truck, Code2, Handshake];
// her kapasite kartı için ilgili blurlu arka görsel
const CARD_BG = [
  '/banners/hero-1.jpg', // Üretim Ağı (duvar kağıdı)
  '/banners/blog.jpg', // Sipariş Yönetimi (masa)
  '/banners/pricing.jpg', // Operasyonel Sistemler
  '/banners/careers.jpg', // Fulfillment
  '/banners/about.jpg', // Teknoloji
  '/banners/etsy.jpg', // İş Ortaklıkları
];
const PLAN_COLORS = ['border-slate-200', 'border-primary ring-2 ring-primary/20', 'border-amber-200'];

type Cap = { title: string; desc: string };
type Plan = { name: string; badge: string; price: string; features: string[] };

export default async function Home() {
  const t = await getTranslations('landing');
  const tc = await getTranslations('common');
  const caps = t.raw('caps') as Cap[];
  const plans = t.raw('plans') as Plan[];

  const nav = [
    { href: '#ecosystem', label: t('navEcosystem') },
    { href: '#operations', label: t('navOperations') },
    { href: '#production', label: t('navProduction') },
    { href: '#technology', label: t('navTechnology') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      {/* NAV */}
      <header className="h-20 bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Logo className="h-11 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-primary transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
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
        {/* HERO */}
        <section id="ecosystem" className="relative overflow-hidden">
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
                className="od-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-primary"
                style={{ animationDelay: '0.05s' }}
              >
                <Rocket className="h-3.5 w-3.5" /> {t('badge')}
              </span>
              <h1
                className="od-fade-up text-4xl sm:text-5xl lg:text-6xl font-semibold text-navy leading-tight tracking-tight"
                style={{ animationDelay: '0.15s' }}
              >
                {t('heroTitle')}
              </h1>
              <p
                className="od-fade-up text-lg text-slate-600 font-medium leading-relaxed"
                style={{ animationDelay: '0.25s' }}
              >
                {t('heroDesc1')}
              </p>
              <p className="od-fade-up text-slate-500 leading-relaxed" style={{ animationDelay: '0.32s' }}>
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
                  <line x1="200" y1="40" x2="40" y2="200" stroke="#0B1F3A" strokeWidth="2" opacity="0.3" />
                  <line x1="200" y1="40" x2="360" y2="200" stroke="#0B1F3A" strokeWidth="2" opacity="0.3" />
                  <line x1="40" y1="200" x2="200" y2="360" stroke="#1F5EFF" strokeWidth="2" opacity="0.3" />
                  <line x1="360" y1="200" x2="200" y2="360" stroke="#6B8E23" strokeWidth="2" opacity="0.3" />
                  <circle cx="200" cy="40" r="12" fill="#0B1F3A" />
                  <circle cx="200" cy="360" r="12" fill="#0B1F3A" />
                  <circle cx="40" cy="200" r="12" fill="#1F5EFF" />
                  <circle cx="360" cy="200" r="12" fill="#6B8E23" />
                  <circle cx="100" cy="100" r="8" fill="#1F5EFF" />
                  <circle cx="300" cy="300" r="8" fill="#1F5EFF" />
                  <circle cx="300" cy="100" r="8" fill="#6B8E23" />
                  <circle cx="100" cy="300" r="8" fill="#0B1F3A" />
                  <circle cx="200" cy="200" r="40" fill="#0B1F3A" />
                  <circle cx="200" cy="200" r="30" fill="#1F5EFF" />
                  <circle cx="200" cy="200" r="15" fill="#6B8E23" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* 6 KAPASİTE */}
        <section id="operations" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-3xl font-semibold text-navy">{t('capsTitle')}</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">{t('capsSubtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {caps.map((c, i) => {
              const Icon = CAP_ICONS[i] ?? Factory;
              return (
                <div
                  key={c.title}
                  className="od-fade-up group relative overflow-hidden bg-white p-7 rounded-3xl border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all"
                  style={{ animationDelay: `${0.08 + i * 0.07}s` }}
                >
                  {/* ilgili blurlu arka görsel (faint) */}
                  <div className="pointer-events-none absolute inset-0">
                    <div
                      className="absolute inset-0 bg-cover bg-center blur-[3px] scale-110 opacity-30 group-hover:opacity-50 transition-opacity duration-300"
                      style={{ backgroundImage: `url(${CARD_BG[i % CARD_BG.length]})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-white/45" />
                  </div>
                  <div className="relative space-y-4">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-navy">{c.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ÜYELİK PLANLARI */}
        <section id="production" className="bg-white border-y border-slate-100 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-semibold text-navy mb-2">{t('plansTitle')}</h2>
              <p className="text-slate-500">{t('plansSubtitle')}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((p, i) => (
                <div
                  key={p.name}
                  className={`od-fade-up rounded-3xl border-2 ${PLAN_COLORS[i]} p-7 bg-white hover:-translate-y-1 transition-transform`}
                  style={{ animationDelay: `${0.1 + i * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-semibold text-navy">{p.name}</h3>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      {p.badge}
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-primary mb-4">{p.price}</div>
                  <ul className="space-y-2 mb-6">
                    {p.features.map((ft) => (
                      <li key={ft} className="flex items-center gap-2 text-sm text-slate-600">
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
          </div>
        </section>

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
