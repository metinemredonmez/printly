'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function CareersPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Kariyer' : 'Careers'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? 'Neden Ortak Doku?' : 'Why Ortak Doku?'}>
        <p>
          {tr
            ? 'Ortak Doku, duvar kağıdı, decal ve ahşap baskı ürünlerini Etsy ve kendi kanallarımız üzerinden dünyaya ulaştıran, hızla büyüyen bir B2B Print-on-Demand üretim ekosistemidir.'
            : 'Ortak Doku is a fast-growing B2B Print-on-Demand production ecosystem, delivering wallpaper, decal and wood print products to the world through Etsy and our own channels.'}
        </p>
        <p>
          {tr
            ? 'Ekibimiz üretim ve teknolojinin kesiştiği noktada çalışır: bir yanda gerçek üretim hattı ve sevkiyat, diğer yanda bu operasyonu uçtan uca yöneten modern bir yazılım platformu. Burada yaptığınız iş hem ekranda hem de fabrika zemininde karşılığını bulur.'
            : 'Our team works at the intersection of manufacturing and technology: a real production line and fulfillment on one side, and a modern software platform that runs the entire operation end to end on the other. What you build here shows up both on the screen and on the factory floor.'}
        </p>
      </Section>
      <Section heading={tr ? 'Açık Pozisyonlar' : 'Open Positions'}>
        <p>
          {tr
            ? 'Şu anda aktif bir ilanımız bulunmuyor; ancak yetenek havuzumuz her zaman açık. Aşağıdaki alanlarda kendinizi geliştiren biriyseniz başvurunuzu bekliyoruz:'
            : "We don't have an active opening right now, but our talent pool is always open. If you're growing in one of the areas below, we'd love to hear from you:"}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Üretim & Operasyon — baskı, sevkiyat ve kalite süreçleri'
              : 'Production & Operations — print, fulfillment and quality processes'}
          </li>
          <li>
            {tr
              ? 'Frontend Geliştirme — Next.js ile müşteri ve admin arayüzleri'
              : 'Frontend Development — customer and admin interfaces with Next.js'}
          </li>
          <li>
            {tr
              ? 'Backend Geliştirme — NestJS ile sipariş, üretim ve entegrasyon servisleri'
              : 'Backend Development — order, production and integration services with NestJS'}
          </li>
          <li>
            {tr
              ? 'Müşteri Başarısı — B2B müşteri ilişkileri ve destek'
              : 'Customer Success — B2B client relationships and support'}
          </li>
        </ul>
      </Section>
      <Section heading={tr ? 'Başvuru' : 'How to Apply'}>
        <p>
          {tr
            ? 'CV’nizi ve kısa bir tanıtım yazınızı '
            : 'Send your CV and a short introduction to '}
          <a href="mailto:info@ortakdoku.com" className="text-primary font-medium hover:underline">
            info@ortakdoku.com
          </a>
          {tr
            ? ' adresine gönderin. İlginizi çeken alanı e-postanızın konu satırında belirtirseniz değerlendirme sürecimiz hızlanır.'
            : '. Mentioning the area you’re interested in within the subject line helps speed up our review.'}
        </p>
      </Section>
    </LegalShell>
  );
}
