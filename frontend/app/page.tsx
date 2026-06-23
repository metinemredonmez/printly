import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Factory,
  ClipboardList,
  Cog,
  Truck,
  Cpu,
  Handshake,
  CircleCheck,
  type LucideIcon,
} from 'lucide-react';
import { LangSwitcher } from '@/components/lang-switcher';

const CAP_ICONS: LucideIcon[] = [Factory, ClipboardList, Cog, Truck, Cpu, Handshake];
const PLAN_COLORS = ['border-slate-200', 'border-primary ring-2 ring-primary/20', 'border-amber-200'];

type Cap = { title: string; desc: string };
type Plan = { name: string; badge: string; price: string; features: string[] };

export default async function Home() {
  const t = await getTranslations('landing');
  const tc = await getTranslations('common');
  const caps = t.raw('caps') as Cap[];
  const plans = t.raw('plans') as Plan[];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 flex items-center justify-between px-6 md:px-10 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-extrabold">
            OD
          </div>
          <span className="font-extrabold text-navy">{tc('appName')}</span>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitcher />
          <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-primary">
            {tc('login')}
          </Link>
          <Link
            href="/register"
            className="px-5 h-10 inline-flex items-center text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors"
          >
            {tc('register')}
          </Link>
        </div>
      </header>

      <section className="px-6 md:px-10 py-16 max-w-6xl mx-auto grid lg:grid-cols-2 items-center gap-10">
        <div className="space-y-6">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-primary">
            {t('badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy leading-tight tracking-tight">
            {t('heroTitle')}
          </h1>
          <p className="text-lg text-slate-600">{t('heroDesc')}</p>
          <div className="flex gap-3">
            <Link
              href="/register"
              className="px-7 py-3.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-colors"
            >
              {t('applyNow')}
            </Link>
            <Link
              href="/login"
              className="px-7 py-3.5 border border-primary text-primary font-bold rounded-xl hover:bg-blue-50 transition-colors"
            >
              {tc('login')}
            </Link>
          </div>
        </div>
        <div className="hidden lg:flex justify-center">
          <div className="h-72 w-72 rounded-full border-4 border-dashed border-primary/30 flex items-center justify-center">
            <div className="h-40 w-40 rounded-full bg-navy flex items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-brand-accent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 py-12 max-w-6xl mx-auto w-full">
        <h2 className="text-3xl font-extrabold text-navy text-center mb-10">{t('capsTitle')}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {caps.map((c, i) => {
            const Icon = CAP_ICONS[i] ?? Factory;
            return (
              <div
                key={c.title}
                className="bg-white p-6 rounded-2xl border border-slate-100 hover:shadow-xl transition-shadow"
              >
                <div className="h-12 w-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-navy">{c.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-6 md:px-10 py-12 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-extrabold text-navy text-center mb-2">{t('plansTitle')}</h2>
          <p className="text-center text-slate-500 mb-10">{t('plansSubtitle')}</p>
          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((p, i) => (
              <div key={p.name} className={`rounded-3xl border-2 ${PLAN_COLORS[i]} p-7 bg-white`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-extrabold text-navy">{p.name}</h3>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {p.badge}
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-primary mb-4">{p.price}</div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <CircleCheck className="h-4 w-4 text-brand-accent shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="block text-center px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-colors"
                >
                  {t('startWithPlan')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 md:px-10 py-8 text-center text-sm text-slate-400">{t('footer')}</footer>
    </div>
  );
}
