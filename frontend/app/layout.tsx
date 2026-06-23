import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Ortak Doku — Sipariş & Operasyon Portalı',
  description: 'B2B Print-on-Demand sipariş ve üretim yönetim platformu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#F8F9FA] text-[#2C3E50] font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
