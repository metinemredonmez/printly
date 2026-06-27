'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { LangSwitcher } from '@/components/lang-switcher';
import { SiteFooter } from '@/components/site-footer';
import { PageBanner } from '@/components/page-banner';
import { Logo } from '@/components/logo';

export function useTr() {
  return useLocale() === 'tr';
}

export function LegalShell({
  title,
  updated,
  subtitle,
  banner,
  children,
}: {
  title: string;
  updated: string;
  subtitle?: string;
  banner?: string;
  children: React.ReactNode;
}) {
  const tr = useTr();
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="h-16 bg-white border-b border-slate-100 sticky top-0 z-20 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <Logo className="h-9 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <LangSwitcher />
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {tr ? 'Ana sayfa' : 'Home'}
          </Link>
        </div>
      </header>
      <PageBanner title={title} subtitle={subtitle} image={banner} blur />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-400">{updated}</p>
        <div className="mt-6 space-y-7">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-navy mb-2">{heading}</h2>
      <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
