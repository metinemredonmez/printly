'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function EtsyPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Etsy Entegrasyonu' : 'Etsy Integration'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? '1. Etsy Entegrasyonu Nedir?' : '1. What Is the Etsy Integration?'}>
        <p>
          {tr
            ? 'Etsy entegrasyonu, Etsy mağazanızı Ortak Doku B2B Print-on-Demand altyapısına bağlamanızı sağlar. Bağlantı kurulduğunda Etsy’de aldığınız siparişler üretim ağımıza otomatik olarak akar; duvar kağıdı, decal ve ahşap ürünleriniz baskıya alınır, paketlenir ve müşterinize gönderilir.'
            : 'The Etsy integration lets you connect your Etsy store to the Ortak Doku B2B Print-on-Demand network. Once linked, the orders you receive on Etsy flow automatically into our production network; your wallpaper, decal and wood products are printed, packed and shipped to your customer.'}
        </p>
        <p>
          {tr
            ? 'Amacımız, Etsy satıcılarının üretim ve kargo operasyonunu sıfır manuel iş ile yürütmesidir. Sipariş kopyalama, dosya iletme ve takip kodu girme gibi tekrarlı adımlar tamamen otomatikleşir.'
            : 'Our goal is to let Etsy sellers run their production and shipping operations with zero manual work. Repetitive steps such as copying orders, forwarding files and entering tracking codes are fully automated.'}
        </p>
      </Section>

      <Section heading={tr ? '2. Mağaza Bağlama' : '2. Connecting Your Store'}>
        <p>
          {tr
            ? 'Panelinizdeki Mağazalar ekranından Etsy mağazanızı saniyeler içinde bağlayabilirsiniz. Bağlantı için iki bilgi yeterlidir:'
            : 'You can connect your Etsy store in seconds from the Stores screen in your panel. Two pieces of information are enough to link it:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Etsy mağaza adınız (shop name)'
              : 'Your Etsy shop name'}
          </li>
          <li>
            {tr
              ? 'Etsy API anahtarınız (API key)'
              : 'Your Etsy API key'}
          </li>
        </ul>
        <p>
          {tr
            ? 'Mağazalar ekranında “Etsy Bağla” adımını izleyin, bilgileri girin ve bağlantıyı doğrulayın. Birden fazla Etsy mağazasını aynı hesaba ekleyebilir, her mağazayı ayrı ayrı yönetebilirsiniz.'
            : 'On the Stores screen, follow the “Connect Etsy” step, enter the details and verify the connection. You can add multiple Etsy stores to the same account and manage each one separately.'}
        </p>
      </Section>

      <Section heading={tr ? '3. Otomatik Sipariş Çekme' : '3. Automatic Order Sync'}>
        <p>
          {tr
            ? 'Mağazanız bağlandığında Etsy siparişleriniz otomatik olarak sisteme düşer. Yeni bir sipariş oluştuğunda Ortak Doku bunu algılar, ürün ve adet bilgilerini eşler ve siparişi doğrudan üretim akışına yönlendirir.'
            : 'Once your store is connected, your Etsy orders drop into the system automatically. When a new order is created, Ortak Doku detects it, matches the product and quantity details, and routes the order straight into the production flow.'}
        </p>
        <p>
          {tr
            ? 'Siparişleri tek tek girmenize gerek kalmaz; her sipariş, ürün tipine uygun üretim hattına (duvar kağıdı, decal veya ahşap) otomatik olarak atanır ve durumunu panelden takip edebilirsiniz.'
            : 'You no longer need to enter orders one by one; each order is automatically assigned to the production line matching its product type (wallpaper, decal or wood), and you can track its status from the panel.'}
        </p>
      </Section>

      <Section heading={tr ? '4. Kargo & Takip' : '4. Shipping & Tracking'}>
        <p>
          {tr
            ? 'Üretim tamamlandığında kargo takip kodu otomatik olarak üretilir ve ilgili Etsy siparişine geri yazılır. Böylece müşteriniz, gönderi bilgisini doğrudan Etsy üzerinden görür ve siz hiçbir manuel giriş yapmazsınız.'
            : 'When production is complete, a shipping tracking code is generated automatically and written back to the related Etsy order. Your customer then sees the shipment information directly on Etsy, with no manual entry from your side.'}
        </p>
        <p>
          {tr
            ? 'Tüm süreç white-label çalışır: paket, irsaliye ve gönderi bilgilerinde Ortak Doku markası görünmez; müşteriniz yalnızca sizin markanızı görür.'
            : 'The entire process runs white-label: the Ortak Doku brand does not appear on packages, delivery notes or shipment details; your customer sees only your brand.'}
        </p>
      </Section>

      <Section heading={tr ? '5. Yayın Durumu' : '5. Availability Status'}>
        <p>
          {tr
            ? 'Etsy API erişimi onay sürecindedir, yayında kademeli açılır. Erişim onaylandıkça entegrasyon hesaplara aşamalı olarak açılacaktır; mağazanızı şimdiden bağlamak veya bilgi almak için bizimle iletişime geçebilirsiniz.'
            : 'Etsy API access is in the approval process and will be rolled out gradually. As access is approved, the integration will be enabled for accounts in stages; you can contact us to pre-register your store or get more information.'}
        </p>
        <p>
          {tr
            ? 'Sorularınız için info@ortakdoku.com, teknik destek için support@ortakdoku.com, güvenlik bildirimleri için security@ortakdoku.com adreslerine ulaşabilirsiniz. Ortak Doku — İstanbul.'
            : 'For questions reach info@ortakdoku.com, for technical support support@ortakdoku.com, and for security reports security@ortakdoku.com. Ortak Doku — Istanbul.'}
        </p>
      </Section>
    </LegalShell>
  );
}
