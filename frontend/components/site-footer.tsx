'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Mail, MapPin } from 'lucide-react';

type Item = { tr: string; en: string; href: string };
type Col = { titleTr: string; titleEn: string; items: Item[] };

const COLS: Col[] = [
  {
    titleTr: 'Kurumsal',
    titleEn: 'Company',
    items: [
      { tr: 'Hakkımızda', en: 'About', href: '/about' },
      { tr: 'Blog', en: 'Blog', href: '/blog' },
      { tr: 'İletişim', en: 'Contact', href: '/contact' },
    ],
  },
  {
    titleTr: 'Platform',
    titleEn: 'Platform',
    items: [
      { tr: 'Özellikler', en: 'Features', href: '/#operations' },
      { tr: 'Üyelik Planları', en: 'Plans', href: '/#production' },
      { tr: 'Bayi Başvurusu', en: 'Apply', href: '/register' },
      { tr: 'Giriş Yap', en: 'Sign In', href: '/login' },
    ],
  },
  {
    titleTr: 'Etsy',
    titleEn: 'Etsy',
    items: [
      { tr: 'Etsy Entegrasyonu', en: 'Etsy Integration', href: '/etsy' },
      { tr: 'Mağaza Bağlama', en: 'Connect Store', href: '/etsy#connect' },
      { tr: 'Sipariş Çekme', en: 'Order Sync', href: '/etsy#sync' },
    ],
  },
  {
    titleTr: 'Yasal & Güvenlik',
    titleEn: 'Legal & Security',
    items: [
      { tr: 'Gizlilik Politikası', en: 'Privacy Policy', href: '/privacy' },
      { tr: 'Kullanım Şartları', en: 'Terms of Use', href: '/terms' },
      { tr: 'Çerez Politikası', en: 'Cookie Policy', href: '/cookies' },
      { tr: 'Güvenlik', en: 'Security', href: '/security' },
    ],
  },
];

export function SiteFooter() {
  const tr = useLocale() === 'tr';
  return (
    <footer className="bg-navy text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-6">
        {/* Marka */}
        <div className="lg:col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center font-extrabold">
              OD
            </div>
            <span className="font-extrabold text-white text-lg">Ortak Doku</span>
          </Link>
          <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
            {tr
              ? 'Birlikte üreten, birlikte büyüyen B2B üretim ve operasyon ekosistemi.'
              : 'A B2B production and operations ecosystem that produces and grows together.'}
          </p>
          <div className="space-y-1.5 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> info@ortakdoku.com
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {tr ? 'İstanbul, Türkiye' : 'Istanbul, Türkiye'}
            </div>
          </div>
        </div>

        {/* Sütunlar */}
        {COLS.map((col) => (
          <div key={col.titleEn} className="space-y-3">
            <h3 className="text-white font-bold text-sm">{tr ? col.titleTr : col.titleEn}</h3>
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

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© 2026 Ortak Doku — B2B Print-on-Demand</span>
          <span>{tr ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}</span>
        </div>
      </div>
    </footer>
  );
}
