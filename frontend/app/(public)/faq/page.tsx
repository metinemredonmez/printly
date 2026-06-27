'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function FaqPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Sıkça Sorulan Sorular' : 'Frequently Asked Questions'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      {/* 1. Genel */}
      <Section heading={tr ? 'Genel' : 'General'}>
        <p>
          <b>{tr ? 'Ortak Doku nedir?' : 'What is Ortak Doku?'}</b>
        </p>
        <p>
          {tr
            ? 'Ortak Doku, bayiler ve tasarımcılar için bir B2B Print-on-Demand (talebe göre üretim) portalıdır. Kendi tasarımlarınızı duvar kağıdı, wall decal ve CNC ahşap ürünlere dönüştürür; siparişi, fiyatlandırmayı ve üretim takibini tek panelden yönetmenizi sağlarız.'
            : 'Ortak Doku is a B2B Print-on-Demand portal for resellers and designers. We turn your designs into wallpaper, wall decals and CNC wood products, and let you manage ordering, pricing and production tracking from a single dashboard.'}
        </p>
        <p>
          <b>{tr ? 'Bu portalı kimler kullanır?' : 'Who uses this portal?'}</b>
        </p>
        <p>
          {tr
            ? 'Platform; Etsy ve benzeri pazaryerlerinde satış yapan ABD’li mağaza sahipleri, iç mimarlar, bayiler ve tasarım stüdyoları için kurgulanmıştır. Son tüketiciye değil, kendi müşterisine üreten profesyonellere (B2B) hizmet veririz.'
            : 'The platform is built for U.S.-based store owners selling on Etsy and similar marketplaces, interior designers, resellers and design studios. We serve professionals who produce for their own customers (B2B), not end consumers.'}
        </p>
        <p>
          <b>{tr ? 'Nasıl başvururum?' : 'How do I apply?'}</b>
        </p>
        <p>
          {tr
            ? '/register adresindeki kayıt sihirbazını adım adım tamamlamanız yeterli. Firma ve iletişim bilgilerinizi girdikten sonra hesabınız incelenir; onaylanınca panele erişim kazanır ve sipariş vermeye başlayabilirsiniz.'
            : 'Just complete the step-by-step registration wizard at /register. After you enter your company and contact details, your account is reviewed; once approved, you gain dashboard access and can start placing orders.'}
        </p>
      </Section>

      {/* 2. Sipariş & Üretim */}
      <Section heading={tr ? 'Sipariş & Üretim' : 'Orders & Production'}>
        <p>
          <b>{tr ? 'Hangi ürünleri üretiyorsunuz?' : 'Which products do you produce?'}</b>
        </p>
        <p>{tr ? 'Üç ana ürün kategorimiz var:' : 'We have three main product categories:'}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{tr ? 'Duvar kağıdı — metrekare (m²) bazında, ölçüye göre üretilir.' : 'Wallpaper — produced to measure, priced per square meter (m²).'}</li>
          <li>{tr ? 'Wall decal (duvar çıkartması) — kesim ve uygulamaya hazır.' : 'Wall decals — ready to cut and apply.'}</li>
          <li>{tr ? 'CNC ahşap — desen ve ölçüye göre işlenmiş ahşap paneller.' : 'CNC wood — wood panels machined to your pattern and dimensions.'}</li>
        </ul>
        <p>
          <b>{tr ? 'Üretim takibini nasıl yaparım?' : 'How do I track production?'}</b>
        </p>
        <p>
          {tr
            ? 'Her siparişin güncel durumunu panelden takip edebilirsiniz. Üretim aşamaları durum etiketleriyle gösterilir; ayrıca siparişe bağlı QR kod ile fiziksel üretim sürecini anlık olarak izleyebilirsiniz.'
            : 'You can follow each order’s current status from the dashboard. Production stages are shown with status labels, and the QR code attached to each order lets you monitor the physical production process in real time.'}
        </p>
        <p>
          <b>{tr ? 'Teslim süresi ne kadar?' : 'What is the delivery time?'}</b>
        </p>
        <p>
          {tr
            ? 'Teslim süresi ürün tipine, ölçüye ve sipariş yoğunluğuna göre değişir. Tasarım onayından sonra üretim başlar; tahmini hazır olma tarihini sipariş detayında görür, kargoya verildiğinde takip bilgisiyle bilgilendirilirsiniz.'
            : 'Delivery time depends on the product type, size and order volume. Production begins after design approval; you see the estimated ready date on the order detail and are notified with tracking information once it ships.'}
        </p>
      </Section>

      {/* 3. Etsy */}
      <Section heading={tr ? 'Etsy' : 'Etsy'}>
        <p>
          <b>{tr ? 'Etsy mağazamı bağlayabilir miyim?' : 'Can I connect my Etsy store?'}</b>
        </p>
        <p>
          {tr
            ? 'Evet. Mağazalar ekranından Etsy mağazanızı tanımlayıp hesabınıza bağlayabilirsiniz. Bağlı mağazalarınızı tek panelden yönetir, hangi mağazadan hangi siparişin geldiğini ayrı ayrı görebilirsiniz.'
            : 'Yes. From the Stores screen you can define and link your Etsy store to your account. You manage your connected stores from a single dashboard and can see which order came from which store separately.'}
        </p>
        <p>
          <b>{tr ? 'Siparişler otomatik aktarılıyor mu?' : 'Are orders imported automatically?'}</b>
        </p>
        <p>
          {tr
            ? 'Tam otomatik senkronizasyon (Etsy siparişlerinin panele otomatik düşmesi) yakında devreye girecek. O zamana kadar mağaza bağlantınızı yönetebilir, siparişlerinizi panel üzerinden hızlıca oluşturabilirsiniz.'
            : 'Fully automatic synchronization (Etsy orders dropping into the dashboard automatically) is coming soon. Until then you can manage your store connection and quickly create your orders through the dashboard.'}
        </p>
      </Section>

      {/* 4. Ödeme & Üyelik */}
      <Section heading={tr ? 'Ödeme & Üyelik' : 'Payment & Membership'}>
        <p>
          <b>{tr ? 'Ödemeyi nasıl yaparım?' : 'How do I pay?'}</b>
        </p>
        <p>
          {tr
            ? 'Ödemeyi iki şekilde yapabilirsiniz: hesabınızdaki bakiyeyi kullanarak veya kredi/banka kartıyla. Bakiyenizi önceden yükleyip siparişlerde otomatik düşülmesini sağlayabilir ya da her sipariş için kartla ödeyebilirsiniz.'
            : 'You can pay in two ways: using your account balance, or by credit/debit card. You may top up your balance in advance and have it deducted automatically per order, or pay by card for each order.'}
        </p>
        <p>
          <b>{tr ? 'Üyelik planları nelerdir?' : 'What are the membership plans?'}</b>
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{tr ? 'Kullanıcı — bireysel hesap; kendi siparişlerinizi oluşturur ve yönetirsiniz.' : 'User — individual account; you create and manage your own orders.'}</li>
          <li>{tr ? 'Ekip Üyesi — bir ekibe bağlı çalışır; ekip içindeki siparişlere ortak erişir.' : 'Team Member — works within a team; shares access to the team’s orders.'}</li>
          <li>{tr ? 'Ekip Lideri — ekibi yönetir; üyeleri, yetkileri ve ekip bakiyesini kontrol eder.' : 'Team Leader — manages the team; controls members, permissions and the team balance.'}</li>
        </ul>
        <p>
          <b>{tr ? '%40 indirim nasıl kazanılır?' : 'How do I earn the 40% discount?'}</b>
        </p>
        <p>
          {tr
            ? 'Hesabınıza tek seferde $250 bakiye yüklediğinizde %40 indirim avantajından yararlanırsınız. Yüklediğiniz bakiye siparişlerinizde otomatik kullanılır ve indirimli fiyatlandırma uygulanır.'
            : 'When you top up your account with $250 in a single load, you unlock the 40% discount. The balance you loaded is used automatically on your orders and discounted pricing is applied.'}
        </p>
      </Section>

      {/* 5. Güvenlik */}
      <Section heading={tr ? 'Güvenlik' : 'Security'}>
        <p>
          <b>{tr ? 'Verilerim şifreli mi saklanıyor?' : 'Is my data stored encrypted?'}</b>
        </p>
        <p>
          {tr
            ? 'Evet. Hassas alanlar (iki adımlı doğrulama, kimlik/vergi numarası gibi) AES-GCM ile şifreli saklanır. Tasarım dosyalarınız erişim-kontrollü nesne depolamada tutulur ve veri iletimi TLS ile korunur.'
            : 'Yes. Sensitive fields (such as two-factor authentication and tax/ID numbers) are stored AES-GCM encrypted. Your design files are kept in access-controlled object storage and data in transit is protected with TLS.'}
        </p>
        <p>
          <b>{tr ? 'KVKK ve GDPR’ye uyuyor musunuz?' : 'Are you KVKK and GDPR compliant?'}</b>
        </p>
        <p>
          {tr
            ? 'Evet. Verilerinize erişme, düzeltme, silme ve dışa aktarma haklarınız vardır. Talepleriniz ve güvenlik bildirimleri için bizimle iletişime geçebilirsiniz: security@ortakdoku.com'
            : 'Yes. You have the right to access, correct, delete and export your data. For your requests and security disclosures you can contact us: security@ortakdoku.com'}
        </p>
        <p>
          <b>{tr ? 'Daha fazla sorum var, kime ulaşırım?' : 'I have more questions — who do I contact?'}</b>
        </p>
        <p>
          {tr
            ? 'Genel sorular için info@ortakdoku.com, destek için support@ortakdoku.com adresine yazabilirsiniz. Ekibimiz İstanbul merkezlidir.'
            : 'For general questions write to info@ortakdoku.com, and for support support@ortakdoku.com. Our team is based in İstanbul.'}
        </p>
      </Section>
    </LegalShell>
  );
}
