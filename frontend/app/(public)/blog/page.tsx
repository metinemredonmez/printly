'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function BlogPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Blog' : 'Blog'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? 'Yakında' : 'Coming Soon'}>
        <p>
          {tr
            ? 'Yakında — üretim, e-ticaret ve operasyon üzerine içerikler. Ortak Doku ekibi olarak duvar kağıdı, decal ve ahşap üretim ağımızdan; Etsy satıcıları için pratik rehberler hazırlıyoruz.'
            : 'Coming soon — content on production, e-commerce and operations. The Ortak Doku team is preparing practical guides drawn from our wallpaper, decal and wood production network for Etsy sellers.'}
        </p>
      </Section>

      <Section heading={tr ? 'Hazırladığımız konular' : 'Topics in the Works'}>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? "Etsy'de duvar kağıdı satışına başlangıç — Mağaza açılışından ilk listeye, ürünlerinizi Ortak Doku üretim ağına bağlamanın adım adım yol haritası."
              : 'Getting started with wallpaper sales on Etsy — A step-by-step roadmap from opening a shop to your first listing, connecting your products to the Ortak Doku production network.'}
          </li>
          <li>
            {tr
              ? 'm² fiyatlandırma nasıl çalışır — Metrekare bazlı fiyat hesaplama, malzeme katsayıları ve kâr marjınızı koruyan satış fiyatı belirleme yöntemleri.'
              : 'How per-square-meter pricing works — Area-based price calculation, material coefficients and methods to set a retail price that protects your margin.'}
          </li>
          <li>
            {tr
              ? 'Üretim ağı ile sipariş akışı — Siparişin alınmasından üretim, kalite kontrol ve kargoya çıkışına kadar arka plandaki operasyonun nasıl ilerlediği.'
              : 'Order flow with the production network — How the behind-the-scenes operation moves from order intake through production, quality control and dispatch.'}
          </li>
          <li>
            {tr
              ? 'White-label kargo ve takip — Paketlerin sizin markanızla çıkması, gönderi etiketleri ve müşterinize sunulan takip deneyiminin kurgusu.'
              : 'White-label shipping and tracking — Shipping packages under your own brand, dispatch labels and the tracking experience presented to your customer.'}
          </li>
          <li>
            {tr
              ? 'Bayi üyelik modelleri — Ortak Doku bayi paketleri arasındaki farklar, hacim avantajları ve işletmenize en uygun planı seçme kriterleri.'
              : 'Reseller membership models — The differences between Ortak Doku reseller tiers, volume advantages and criteria for choosing the plan that fits your business.'}
          </li>
        </ul>
      </Section>

      <Section heading={tr ? 'İçerikler yakında yayında' : 'Content Publishing Soon'}>
        <p>
          {tr
            ? 'Bu yazılar üzerinde çalışıyoruz; içerikler yakında yayında olacak. Yeni bir yazı duyurusu veya iş birliği önerileriniz için bizimle iletişime geçebilirsiniz: info@ortakdoku.com. İstanbul.'
            : 'We are working on these articles; the content will be published soon. For announcements of a new post or collaboration proposals, you can reach us at info@ortakdoku.com. Istanbul.'}
        </p>
      </Section>
    </LegalShell>
  );
}
