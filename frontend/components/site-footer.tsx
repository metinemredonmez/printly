'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Mail, MapPin, Apple, Play, Send, ShieldCheck } from 'lucide-react';
import { LogoMark } from '@/components/logo';

const SOCIALS: { label: string; href: string; path: string }[] = [
  { label: 'LinkedIn', href: '#', path: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C20.4 8.65 22 10.7 22 14v7h-4v-6.2c0-1.48-.03-3.38-2.06-3.38-2.06 0-2.38 1.6-2.38 3.27V21H9V9Z' },
  { label: 'Instagram', href: '#', path: 'M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.5.01-4.74.07-.9.04-1.38.19-1.7.32-.43.16-.74.36-1.06.68-.32.32-.52.63-.68 1.06-.13.32-.28.8-.32 1.7C3.21 8.5 3.2 8.85 3.2 12s.01 3.5.07 4.74c.04.9.19 1.38.32 1.7.16.43.36.74.68 1.06.32.32.63.52 1.06.68.32.13.8.28 1.7.32 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.9-.04 1.38-.19 1.7-.32.43-.16.74-.36 1.06-.68.32-.32.52-.63.68-1.06.13-.32.28-.8.32-1.7.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.9-.19-1.38-.32-1.7a2.85 2.85 0 0 0-.68-1.06 2.85 2.85 0 0 0-1.06-.68c-.32-.13-.8-.28-1.7-.32C15.5 4.01 15.15 4 12 4Zm0 3.06A4.94 4.94 0 1 1 12 17a4.94 4.94 0 0 1 0-9.94Zm0 1.8a3.14 3.14 0 1 0 0 6.28 3.14 3.14 0 0 0 0-6.28Zm5.13-.36a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z' },
  { label: 'X', href: '#', path: 'M18.9 2H22l-7.5 8.6L23 22h-6.9l-5.4-7-6.2 7H1.4l8-9.2L1 2h7l4.9 6.5L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z' },
];

type Item = { tr: string; en: string; href: string };
type Col = { titleTr: string; titleEn: string; items: Item[] };

const COLS: Col[] = [
  {
    titleTr: 'Platform',
    titleEn: 'Platform',
    items: [
      { tr: 'Özellikler', en: 'Features', href: '/#operations' },
      { tr: 'Üyelik Planları', en: 'Plans', href: '/#production' },
      { tr: 'Fiyatlandırma', en: 'Pricing', href: '/pricing' },
      { tr: 'Bayi Başvurusu', en: 'Apply', href: '/register' },
    ],
  },
  {
    titleTr: 'Çözümler',
    titleEn: 'Solutions',
    items: [
      { tr: 'Üretim Ağı', en: 'Production Network', href: '/#operations' },
      { tr: 'Etsy Entegrasyonu', en: 'Etsy Integration', href: '/etsy' },
      { tr: 'Mağaza Bağlama', en: 'Connect Store', href: '/etsy#connect' },
      { tr: 'Sipariş Çekme', en: 'Order Sync', href: '/etsy#sync' },
    ],
  },
  {
    titleTr: 'Kurumsal',
    titleEn: 'Company',
    items: [
      { tr: 'Hakkımızda', en: 'About', href: '/about' },
      { tr: 'Blog', en: 'Blog', href: '/blog' },
      { tr: 'Kariyer', en: 'Careers', href: '/careers' },
      { tr: 'İletişim', en: 'Contact', href: '/contact' },
    ],
  },
  {
    titleTr: 'Kaynaklar',
    titleEn: 'Resources',
    items: [
      { tr: 'SSS', en: 'FAQ', href: '/faq' },
      { tr: 'Güvenlik', en: 'Security', href: '/security' },
      { tr: 'Giriş Yap', en: 'Sign In', href: '/login' },
    ],
  },
  {
    titleTr: 'Yasal',
    titleEn: 'Legal',
    items: [
      { tr: 'Gizlilik Politikası', en: 'Privacy Policy', href: '/privacy' },
      { tr: 'Kullanım Şartları', en: 'Terms of Use', href: '/terms' },
      { tr: 'Çerez Politikası', en: 'Cookie Policy', href: '/cookies' },
    ],
  },
];

export function SiteFooter() {
  const tr = useLocale() === 'tr';
  const [email, setEmail] = useState('');

  function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error(tr ? 'Geçerli bir e-posta girin.' : 'Enter a valid email.');
      return;
    }
    toast.success(tr ? 'Kaydınız alındı, bülten çok yakında! 🎉' : 'You are on the list — newsletter coming soon! 🎉');
    setEmail('');
  }

  return (
    <footer className="bg-navy text-slate-300">
      {/* ÜST BAND: bülten + uygulama */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 lg:grid-cols-2 items-center">
          {/* Bülten */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold text-lg">
              {tr ? 'Bültenimize kayıt olun' : 'Subscribe to our newsletter'}
            </h3>
            <p className="text-sm text-slate-400">
              {tr
                ? 'Üretim, e-ticaret ve operasyon üzerine güncellemeleri ilk siz öğrenin.'
                : 'Be the first to get updates on production, e-commerce and operations.'}
            </p>
            <form onSubmit={subscribe} className="flex max-w-md gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tr ? 'E-posta adresiniz' : 'Your email address'}
                className="flex-1 h-11 rounded-xl bg-white/10 border border-white/15 px-4 text-sm text-white placeholder:text-slate-400 outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="h-11 px-5 inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm transition-colors"
              >
                <Send className="h-4 w-4" /> {tr ? 'Abone Ol' : 'Subscribe'}
              </button>
            </form>
          </div>

          {/* Uygulama — çok yakında */}
          <div className="lg:text-right space-y-3">
            <h3 className="text-white font-semibold text-lg">
              {tr ? 'Mobil uygulama çok yakında' : 'Mobile app coming soon'}
            </h3>
            <p className="text-sm text-slate-400">
              {tr
                ? 'Üretim takibi ve QR okutma cebinizde. App Store ve Google Play’de yakında.'
                : 'Production tracking and QR scanning in your pocket. Soon on the App Store and Google Play.'}
            </p>
            <div className="flex gap-3 lg:justify-end flex-wrap">
              <StoreBadge icon={<Apple className="h-5 w-5" />} store="App Store" soon={tr ? 'Çok Yakında' : 'Coming Soon'} />
              <StoreBadge icon={<Play className="h-5 w-5" />} store="Google Play" soon={tr ? 'Çok Yakında' : 'Coming Soon'} />
            </div>
          </div>
        </div>
      </div>

      {/* SÜTUNLAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-1 space-y-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center">
              <LogoMark className="h-7 w-7" />
            </span>
            <span className="font-semibold text-white text-lg">Ortak Doku</span>
          </Link>
          <div className="space-y-1.5 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> info@ortakdoku.com
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {tr ? 'İstanbul, Türkiye' : 'Istanbul, Türkiye'}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-slate-300 hover:bg-white/20 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d={s.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {COLS.map((col) => (
          <div key={col.titleEn} className="space-y-3">
            <h3 className="text-white font-semibold text-sm">{tr ? col.titleTr : col.titleEn}</h3>
            <ul className="space-y-2">
              {col.items.map((it) => (
                <li key={it.href + it.en}>
                  <Link href={it.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {tr ? it.tr : it.en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ÖDEME GÜVENİ */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ShieldCheck className="h-4 w-4 text-brand-accent" />
            {tr ? 'Güvenli ödeme altyapısı' : 'Secure payment infrastructure'}
          </div>
          <div className="flex items-center gap-x-5 gap-y-1 flex-wrap justify-center text-slate-500">
            {['Visa', 'Mastercard', 'Amex', 'Stripe', 'QuickBooks'].map((m) => (
              <span key={m} className="text-sm">{m}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© 2026 Ortak Doku — B2B Print-on-Demand</span>
          <span>{tr ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}</span>
        </div>
      </div>
    </footer>
  );
}

function StoreBadge({ icon, store, soon }: { icon: React.ReactNode; store: string; soon: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 opacity-90">
      <span className="text-white">{icon}</span>
      <span className="text-left leading-tight">
        <span className="block text-[10px] text-amber-300 font-semibold uppercase tracking-wide">{soon}</span>
        <span className="block text-sm text-white font-semibold">{store}</span>
      </span>
    </div>
  );
}
