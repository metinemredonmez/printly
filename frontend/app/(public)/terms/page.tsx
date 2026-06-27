'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function TermsPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Kullanım Şartları' : 'Terms of Use'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? '1. Hizmet' : '1. The Service'}>
        <p>
          {tr
            ? 'Ortak Doku, bayilere duvar kağıdı, wall decal ve ahşap (CNC) ürünlerinde sipariş, üretim ve operasyon yönetimi sağlayan bir B2B platformudur.'
            : 'Ortak Doku is a B2B platform providing order, production and operations management for wallpaper, wall decal and wood (CNC) products to dealers.'}
        </p>
      </Section>
      <Section heading={tr ? '2. Hesap & Üyelik' : '2. Account & Membership'}>
        <p>
          {tr
            ? 'Başvurunuz onaylandıktan sonra hesabınız aktifleşir. Üyelik planı fiyat çarpanınızı belirler. Hesabınızın güvenliğinden siz sorumlusunuz.'
            : 'Your account is activated after your application is approved. Your membership plan determines your price multiplier. You are responsible for your account security.'}
        </p>
      </Section>
      <Section heading={tr ? '3. Siparişler & Ödeme' : '3. Orders & Payment'}>
        <p>
          {tr
            ? 'Fiyatlar USD üzerinden, ölçüye (m²/adet) göre hesaplanır. Bakiye veya kart ile ödenir. Üretime başlanmış siparişler iptal edilemez; iptal kuralları sipariş durumuna bağlıdır.'
            : 'Prices are in USD, calculated by size (m²/unit). Paid by balance or card. Orders in production cannot be cancelled; cancellation rules depend on order status.'}
        </p>
      </Section>
      <Section heading={tr ? '4. Tasarım Dosyaları' : '4. Design Files'}>
        <p>
          {tr
            ? 'Yüklediğiniz dosyaların haklarına sahip olduğunuzu beyan edersiniz. Telif ihlali içeren içeriklerden kullanıcı sorumludur. Dosyalar yalnızca siparişinizin üretimi için kullanılır.'
            : 'You declare that you own the rights to the files you upload. The user is responsible for content that infringes copyright. Files are used only to produce your order.'}
        </p>
      </Section>
      <Section heading={tr ? '5. Sorumluluk' : '5. Liability'}>
        <p>
          {tr
            ? 'Hizmet "olduğu gibi" sunulur. Onayladığınız dijital provaya göre üretilen işlerde renk/ölçü farklarından doğan sorumluluk sınırlıdır.'
            : 'The service is provided "as is". Liability for color/size differences in work produced per the digital proof you approved is limited.'}
        </p>
      </Section>
    </LegalShell>
  );
}
