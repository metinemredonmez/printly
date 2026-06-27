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
            ? 'Ortak Doku; duvar kağıdı (metrekare bazlı), wall decal ve CNC ahşap üretimini tek bir panelde bir araya getirir. Sipariş anından teslimat anına kadar tüm süreç şeffaf ve takip edilebilirdir. Tek bir entegrasyonla şu ürün gruplarını üretebilirsiniz:'
            : 'Ortak Doku brings wallpaper (priced per square meter), wall decal and CNC wood production together in a single dashboard. From the moment an order is placed to delivery, the entire process stays transparent and traceable. With a single integration you can produce the following product groups:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Duvar kağıdı (m² bazlı): Ölçüye göre metrekare üzerinden anlık fiyatlandırılan, baskı kalitesi yüksek özel üretim.'
              : 'Wallpaper (per m²): high-quality custom production priced instantly per square meter based on dimensions.'}
          </li>
          <li>
            {tr
              ? 'Wall decal: Farklı boyut ve malzeme seçenekleriyle uygulanması kolay, kesime hazır duvar çıkartmaları.'
              : 'Wall decal: easy-to-apply, cut-ready wall stickers with a range of size and material options.'}
          </li>
          <li>
            {tr
              ? 'CNC ahşap: Hassas CNC işçiliğiyle üretilen, dekoratif ve fonksiyonel özel ahşap ürünler.'
              : 'CNC wood: decorative and functional custom wood products crafted with precision CNC machining.'}
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
              ? 'Şeffaf m² fiyat: Gizli ücret yok; her kalemin metrekare maliyetini sipariş öncesinde net olarak görürsünüz.'
              : 'Transparent per-m² pricing: no hidden fees — you see the per-square-meter cost of every line item clearly before ordering.'}
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

      <Section heading={tr ? 'Değerlerimiz' : 'Our Values'}>
        <p>
          {tr
            ? 'İş yapış biçimimizi belirleyen ve her kararda bize yol gösteren dört temel değerimiz var:'
            : 'Four core values shape the way we work and guide us in every decision:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Şeffaflık: Fiyattan üretim aşamasına kadar her şeyi açıkça görünür kılarız.'
              : 'Transparency: we keep everything — from pricing to the production stage — openly visible.'}
          </li>
          <li>
            {tr
              ? 'Kalite: Her siparişi ilk günkü özenle, yüksek üretim standartlarıyla tamamlarız.'
              : 'Quality: we complete every order with first-day care and high production standards.'}
          </li>
          <li>
            {tr
              ? 'Hız: Siparişten kargoya kadar süreci kısaltarak teslimatı hızlandırırız.'
              : 'Speed: we shorten the path from order to shipment and accelerate delivery.'}
          </li>
          <li>
            {tr
              ? 'Güvenilirlik: Verdiğimiz sözü tutar, satıcının operasyonunu güvenle taşırız.'
              : 'Reliability: we keep our promises and carry the seller’s operation with confidence.'}
          </li>
        </ul>
      </Section>

      <Section heading={tr ? 'Nasıl Çalışır' : 'How It Works'}>
        <p>
          {tr
            ? 'Ortak Doku ile çalışmaya başlamak dört basit adımdan oluşur:'
            : 'Getting started with Ortak Doku takes just four simple steps:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Başvur: Satıcı hesabınızı oluşturup başvurunuzu gönderin.'
              : 'Apply: create your seller account and submit your application.'}
          </li>
          <li>
            {tr
              ? 'Mağaza bağla: Etsy mağazanızı tek tıkla platforma entegre edin.'
              : 'Connect your store: integrate your Etsy store with the platform in one click.'}
          </li>
          <li>
            {tr
              ? 'Sipariş düşer: Mağazanızdaki siparişler otomatik olarak üretim ağına aktarılır.'
              : 'Orders flow in: your store orders are automatically routed into the production network.'}
          </li>
          <li>
            {tr
              ? 'Üret & kargola: Ürün sizin adınıza üretilir ve doğrudan müşterinize gönderilir.'
              : 'Produce & ship: the product is made on your behalf and shipped directly to your customer.'}
          </li>
        </ul>
      </Section>

      <Section heading={tr ? 'İletişim' : 'Contact'}>
        <p>
          {tr
            ? 'Bizimle iletişime geçmek için: genel sorular ve iş birliği talepleri için info@ortakdoku.com adresine yazabilirsiniz. Teknik destek için support@ortakdoku.com, güvenlik bildirimleri için security@ortakdoku.com adreslerini kullanabilirsiniz. Merkez ofisimiz İstanbul’dadır.'
            : 'To get in touch with us: for general inquiries and partnership requests, write to info@ortakdoku.com. For technical support use support@ortakdoku.com, and for security reports use security@ortakdoku.com. Our head office is located in Istanbul.'}
        </p>
      </Section>
    </LegalShell>
  );
}
