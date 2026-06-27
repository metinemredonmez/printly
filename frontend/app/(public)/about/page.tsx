'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function AboutPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Hakkımızda' : 'About Us'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
      banner="/banners/about.jpg"
    >
      <Section heading={tr ? 'Biz Kimiz' : 'Who We Are'}>
        <p>
          {tr
            ? 'Ortak Doku, e-ticaret girişimcilerini güçlü bir üretim ve operasyon ekosistemiyle buluşturan bir B2B Print-on-Demand platformudur. İstanbul merkezli ekibimiz; tasarımı satışa, satışı da fiziksel ürüne dönüştürmenin önündeki tüm operasyonel yükü tek bir panelin altında topluyor. Tedarikçi aramak, fiyat pazarlığı yapmak, üretim takibi ve kargo süreçleriyle ayrı ayrı uğraşmak yerine, satıcılar tek bir entegre ağ üzerinden üretim yaptırıp büyümeye odaklanabiliyor.'
            : 'Ortak Doku is a B2B Print-on-Demand platform that connects e-commerce entrepreneurs with a powerful production and operations ecosystem. Based in Istanbul, our team consolidates the entire operational burden of turning designs into sales — and sales into physical products — under a single dashboard. Instead of separately sourcing suppliers, negotiating prices, tracking production and managing shipping, sellers can produce through one integrated network and focus on growth.'}
        </p>
      </Section>

      <Section heading={tr ? 'Misyonumuz' : 'Our Mission'}>
        <p>
          {tr
            ? 'Misyonumuz; ölçeği ne olursa olsun her satıcının daha hızlı, daha verimli ve daha güvenli üretim yaparak büyüyebilmesini sağlamaktır. Üretim ağına erişimin yalnızca büyük markaların ayrıcalığı olmaması gerektiğine inanıyoruz. Bu yüzden bağımsız bir Etsy satıcısının da kurumsal bir markanın da aynı kalite, şeffaflık ve güven standartlarına ulaşabileceği eşit bir oyun alanı kuruyoruz.'
            : 'Our mission is to enable every seller — at any scale — to grow by producing faster, more efficiently and more securely. We believe access to a production network should not be a privilege reserved for large brands. That is why we build a level playing field where an independent Etsy seller and an enterprise brand alike can reach the same standards of quality, transparency and trust.'}
        </p>
      </Section>

      <Section heading={tr ? 'Ne Yapıyoruz' : 'What We Do'}>
        <p>
          {tr
            ? 'Ortak Doku; duvar kağıdı (metrekare bazlı), wall decal ve CNC ahşap üretimini tek bir panelde bir araya getirir. Sipariş anından teslimat anına kadar tüm süreç şeffaf ve takip edilebilirdir:'
            : 'Ortak Doku brings wallpaper (priced per square meter), wall decal and CNC wood production together in a single dashboard. From the moment an order is placed to delivery, the entire process stays transparent and traceable:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Canlı fiyatlandırma: Ölçü, malzeme ve adet seçimine göre anlık ve net maliyet hesabı.'
              : 'Live pricing: instant, clear cost calculation based on size, material and quantity selections.'}
          </li>
          <li>
            {tr
              ? 'Üretim takibi: Her siparişin hangi aşamada olduğunu gerçek zamanlı izleme.'
              : 'Production tracking: real-time visibility into the stage of every order.'}
          </li>
          <li>
            {tr
              ? 'Etsy entegrasyonu: Mağazanızdaki siparişleri otomatik olarak üretim ağına aktarma.'
              : 'Etsy integration: automatically push your store orders into the production network.'}
          </li>
        </ul>
      </Section>

      <Section heading={tr ? 'Neden Ortak Doku' : 'Why Ortak Doku'}>
        <p>
          {tr
            ? 'Ortak Doku’yu tek bir tedarikçiden çok daha fazlası yapan, satıcının operasyonunu uçtan uca devralan bütünleşik bir model sunmasıdır:'
            : 'What makes Ortak Doku far more than a single supplier is its integrated model that takes over the seller’s operation end to end:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Entegre üretim ağı: Duvar kağıdı, decal ve CNC ahşap üreticilerini tek noktada birleştirir.'
              : 'Integrated production network: unites wallpaper, decal and CNC wood manufacturers in one place.'}
          </li>
          <li>
            {tr
              ? 'Şeffaf fiyat: Gizli ücret yok; her kalemin maliyetini sipariş öncesinde görürsünüz.'
              : 'Transparent pricing: no hidden fees — you see the cost of every line item before ordering.'}
          </li>
          <li>
            {tr
              ? 'White-label fulfillment: Ürünler kendi markanızla, sizin adınıza üretilip gönderilir.'
              : 'White-label fulfillment: products are produced and shipped under your own brand, on your behalf.'}
          </li>
          <li>
            {tr
              ? 'Bayi ve kredi sistemi: Esnek ödeme, kredi limitleri ve bayilere özel koşullarla nakit akışınızı yönetin.'
              : 'Dealer and credit system: manage your cash flow with flexible payment, credit limits and dealer-specific terms.'}
          </li>
        </ul>
      </Section>

      <Section heading={tr ? 'İletişim' : 'Contact'}>
        <p>
          {tr
            ? 'Bizimle iletişime geçmek için: genel sorular info@ortakdoku.com, teknik destek support@ortakdoku.com, güvenlik bildirimleri security@ortakdoku.com. Merkez ofisimiz İstanbul’dadır.'
            : 'To get in touch with us: general inquiries info@ortakdoku.com, technical support support@ortakdoku.com, security reports security@ortakdoku.com. Our head office is located in Istanbul.'}
        </p>
      </Section>
    </LegalShell>
  );
}
