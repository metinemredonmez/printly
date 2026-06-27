'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function EtsyPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Etsy Entegrasyonu' : 'Etsy Integration'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
      banner="/banners/etsy.jpg"
    >
      <Section heading={tr ? '1. Etsy Entegrasyonu Nedir?' : '1. What Is the Etsy Integration?'}>
        <p>
          {tr
            ? 'Etsy entegrasyonu, Etsy mağazanızı Ortak Doku B2B Print-on-Demand altyapısına bağlamanızı sağlar. Bağlantı kurulduğunda Etsy’de aldığınız siparişler üretim ağımıza otomatik olarak akar; duvar kağıdı, decal ve ahşap ürünleriniz baskıya alınır, paketlenir ve ABD’deki müşterinize gönderilir.'
            : 'The Etsy integration lets you connect your Etsy store to the Ortak Doku B2B Print-on-Demand network. Once linked, the orders you receive on Etsy flow automatically into our production network; your wallpaper, decal and wood products are printed, packed and shipped to your customer in the US.'}
        </p>
        <p>
          {tr
            ? 'Amacımız, Etsy satıcılarının üretim ve kargo operasyonunu sıfır manuel iş ile yürütmesidir. Sipariş kopyalama, dosya iletme ve takip kodu girme gibi tekrarlı adımlar tamamen otomatikleşir; siz tasarımınıza ve satışınıza odaklanırsınız.'
            : 'Our goal is to let Etsy sellers run their production and shipping operations with zero manual work. Repetitive steps such as copying orders, forwarding files and entering tracking codes are fully automated, so you can focus on your designs and your sales.'}
        </p>
        <p>
          {tr
            ? 'Entegrasyon iki yönlü çalışır: siparişler Etsy’den Ortak Doku’ya gelir, üretim ve kargo durumu ise Ortak Doku’dan Etsy’ye geri yazılır. Böylece tek bir panelden tüm mağazalarınızı yönetirsiniz.'
            : 'The integration works in both directions: orders come from Etsy into Ortak Doku, while production and shipping status is written back from Ortak Doku to Etsy. This way you manage all your stores from a single panel.'}
        </p>
      </Section>

      <Section heading={tr ? '2. Adım Adım Kurulum' : '2. Step-by-Step Setup'}>
        <p>
          {tr
            ? 'Etsy mağazanızı yalnızca dört adımda canlıya alabilirsiniz:'
            : 'You can take your Etsy store live in just four steps:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? '1. Mağaza adınızı ve Etsy API anahtarınızı girin.'
              : '1. Enter your shop name and your Etsy API key.'}
          </li>
          <li>
            {tr
              ? '2. Etsy ürünlerinizi Ortak Doku kataloğundaki ürünlerle eşleyin.'
              : '2. Map your Etsy products to the products in the Ortak Doku catalog.'}
          </li>
          <li>
            {tr
              ? '3. Otomatik sipariş çekmeyi açın.'
              : '3. Turn on automatic order sync.'}
          </li>
          <li>
            {tr
              ? '4. Kargo takip kodunun Etsy’ye geri yazılmasını açın.'
              : '4. Turn on writing the shipping tracking code back to Etsy.'}
          </li>
        </ul>
        <p>
          {tr
            ? 'Adımları tamamladığınızda mağazanız canlıdır; sonraki tüm siparişler otomatik olarak akmaya başlar ve ek bir işlem yapmanız gerekmez.'
            : 'Once you complete these steps your store is live; all subsequent orders start flowing automatically and you need to take no further action.'}
        </p>
      </Section>

      <Section heading={tr ? '3. Mağaza Bağlama' : '3. Connecting Your Store'}>
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
        <p>
          {tr
            ? 'Bağlantı doğrulandığında mağazanın durumu Mağazalar ekranında “Bağlı” olarak görünür; bağlantıyı dilediğiniz zaman buradan duraklatabilir veya kaldırabilirsiniz.'
            : 'Once the connection is verified, the store’s status shows as “Connected” on the Stores screen; you can pause or remove the connection from here at any time.'}
        </p>
      </Section>

      <Section heading={tr ? '4. Otomatik Sipariş Çekme' : '4. Automatic Order Sync'}>
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
        <p>
          {tr
            ? 'Adım 2’de yaptığınız ürün eşlemesi sayesinde Etsy varyantları doğru Ortak Doku ürünüyle eşleşir; yanlış ürün veya yanlış ölçü riski ortadan kalkar.'
            : 'Thanks to the product mapping you set up in Step 2, your Etsy variants match the correct Ortak Doku product; the risk of the wrong product or wrong size is eliminated.'}
        </p>
      </Section>

      <Section heading={tr ? '5. Kargo & Takip' : '5. Shipping & Tracking'}>
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
        <p>
          {tr
            ? 'Takip kodu Etsy siparişine yazıldığı an sipariş “Kargolandı” durumuna geçer ve Etsy’nin standart bildirimleri müşterinize tetiklenir. Süreci panelinizden uçtan uca izleyebilirsiniz.'
            : 'The moment the tracking code is written to the Etsy order, the order moves to “Shipped” and Etsy’s standard notifications are triggered for your customer. You can follow the whole process end to end from your panel.'}
        </p>
      </Section>

      <Section heading={tr ? '6. Etsy SSS' : '6. Etsy FAQ'}>
        <p>
          {tr
            ? 'Birden çok Etsy mağazası bağlayabilir miyim?'
            : 'Can I connect more than one Etsy store?'}
        </p>
        <p>
          {tr
            ? 'Evet. Aynı Ortak Doku hesabına birden çok Etsy mağazası ekleyebilir ve her mağazanın siparişlerini, eşlemelerini ve kargolarını ayrı ayrı yönetebilirsiniz.'
            : 'Yes. You can add multiple Etsy stores to the same Ortak Doku account and manage each store’s orders, mappings and shipments separately.'}
        </p>
        <p>
          {tr
            ? 'API anahtarım güvende mi?'
            : 'Is my API key secure?'}
        </p>
        <p>
          {tr
            ? 'Evet. Etsy API anahtarınız şifreli olarak saklanır ve yalnızca sipariş çekme ile takip yazımı için kullanılır; panelde açık metin olarak gösterilmez.'
            : 'Yes. Your Etsy API key is stored encrypted and is used only to sync orders and write tracking codes; it is never displayed in plain text in the panel.'}
        </p>
        <p>
          {tr
            ? 'Komisyon nasıl hesaplanır?'
            : 'How is the commission calculated?'}
        </p>
        <p>
          {tr
            ? 'Komisyon, üyelik planınıza göre belirlenir. Planınızın koşullarını panelinizdeki üyelik ekranından görebilir, ayrıntılar için bizimle iletişime geçebilirsiniz.'
            : 'The commission is determined by your membership plan. You can see your plan’s terms on the membership screen in your panel, and contact us for details.'}
        </p>
      </Section>

      <Section heading={tr ? '7. Yayın Durumu' : '7. Availability Status'}>
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
