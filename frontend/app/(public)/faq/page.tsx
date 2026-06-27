'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function FaqPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Sıkça Sorulan Sorular' : 'Frequently Asked Questions'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? 'Ortak Doku nedir?' : 'What is Ortak Doku?'}>
        <p>
          {tr
            ? 'Ortak Doku, bayiler ve tasarımcılar için bir B2B Print-on-Demand (talebe göre üretim) portalıdır. Kendi tasarımlarınızı duvar kağıdı, wall decal ve CNC ahşap ürünlere dönüştürür; siparişi, fiyatlandırmayı ve üretim takibini tek panelden yönetmenizi sağlarız.'
            : 'Ortak Doku is a B2B Print-on-Demand portal for resellers and designers. We turn your designs into wallpaper, wall decals and CNC wood products, and let you manage ordering, pricing and production tracking from a single dashboard.'}
        </p>
      </Section>
      <Section heading={tr ? 'Nasıl başvururum?' : 'How do I apply?'}>
        <p>
          {tr
            ? '/register adresindeki kayıt sihirbazını adım adım tamamlamanız yeterli. Firma ve iletişim bilgilerinizi girdikten sonra hesabınız incelenir; onaylanınca panele erişim kazanır ve sipariş vermeye başlayabilirsiniz.'
            : 'Just complete the step-by-step registration wizard at /register. After you enter your company and contact details, your account is reviewed; once approved, you gain dashboard access and can start placing orders.'}
        </p>
      </Section>
      <Section heading={tr ? 'Hangi ürünleri üretiyorsunuz?' : 'Which products do you produce?'}>
        <p>
          {tr
            ? 'Üç ana ürün kategorimiz var:'
            : 'We have three main product categories:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{tr ? 'Duvar kağıdı — metrekare (m²) bazında, ölçüye göre üretilir.' : 'Wallpaper — produced to measure, priced per square meter (m²).'}</li>
          <li>{tr ? 'Wall decal (duvar çıkartması) — kesim ve uygulamaya hazır.' : 'Wall decals — ready to cut and apply.'}</li>
          <li>{tr ? 'CNC ahşap — desen ve ölçüye göre işlenmiş ahşap paneller.' : 'CNC wood — wood panels machined to your pattern and dimensions.'}</li>
        </ul>
      </Section>
      <Section heading={tr ? 'Fiyatlar nasıl belirlenir?' : 'How are prices determined?'}>
        <p>
          {tr
            ? 'Fiyat, ürünün ölçüsü (m² veya boyut) ile üyelik seviyenize bağlı çarpanın bir araya gelmesiyle hesaplanır. Ölçülerinizi girdikçe panelde fiyat canlı olarak güncellenir; sipariş öncesi net tutarı görürsünüz.'
            : 'Price is calculated from the product size (m² or dimensions) combined with the multiplier tied to your membership tier. As you enter your measurements, the price updates live in the dashboard, so you see the exact amount before ordering.'}
        </p>
      </Section>
      <Section heading={tr ? 'Etsy mağazamı bağlayabilir miyim?' : 'Can I connect my Etsy store?'}>
        <p>
          {tr
            ? 'Evet. Mağazalar ekranından Etsy mağazanızı tanımlayabilirsiniz. Tam otomatik senkronizasyon (sipariş aktarımı) yakında devreye girecek; o zamana kadar mağaza bağlantınızı buradan yönetebilirsiniz.'
            : 'Yes. You can link your Etsy store from the Stores screen. Fully automatic synchronization (order import) is coming soon; until then you can manage your store connection there.'}
        </p>
      </Section>
      <Section heading={tr ? 'Ödeme nasıl yapılır?' : 'How do payments work?'}>
        <p>
          {tr
            ? 'Ödemeyi iki şekilde yapabilirsiniz: hesabınızdaki bakiyeyi kullanarak veya kredi/banka kartıyla. Bakiyenizi önceden yükleyip siparişlerde otomatik düşülmesini sağlayabilir ya da her sipariş için kartla ödeyebilirsiniz.'
            : 'You can pay in two ways: using your account balance, or by credit/debit card. You may top up your balance in advance and have it deducted automatically per order, or pay by card for each order.'}
        </p>
      </Section>
      <Section heading={tr ? 'Üretim takibini nasıl yaparım?' : 'How do I track production?'}>
        <p>
          {tr
            ? 'Her siparişin güncel durumunu panelden takip edebilirsiniz. Üretim aşamaları durum etiketleriyle gösterilir; ayrıca siparişe bağlı QR kod ile fiziksel üretim sürecini anlık olarak izleyebilirsiniz.'
            : 'You can follow each order’s current status from the dashboard. Production stages are shown with status labels, and the QR code attached to each order lets you monitor the physical production process in real time.'}
        </p>
      </Section>
      <Section heading={tr ? 'Daha fazla sorum var, kime ulaşırım?' : 'I have more questions — who do I contact?'}>
        <p>
          {tr
            ? 'Cevabını bulamadığınız her şey için ekibimize yazabilirsiniz: info@ortakdoku.com'
            : 'For anything you couldn’t find an answer to, you can reach our team: info@ortakdoku.com'}
        </p>
      </Section>
    </LegalShell>
  );
}
