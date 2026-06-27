'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function ContactPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'İletişim' : 'Contact'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? 'Bize Ulaşın' : 'Get in Touch'}>
        <p>
          {tr
            ? 'Ortak Doku, duvar kağıdı, decal ve ahşap baskı üretim ağıyla Etsy satıcılarına hizmet veren bir B2B Print-on-Demand platformudur. Genel sorularınız ve iş birliği talepleriniz için bizimle e-posta üzerinden iletişime geçebilirsiniz.'
            : 'Ortak Doku is a B2B Print-on-Demand platform serving Etsy sellers through a production network for wallpaper, decals and wood printing. For general questions and partnership requests, you can reach us by email.'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr ? 'Genel: ' : 'General: '}
            <a className="text-primary hover:underline" href="mailto:info@ortakdoku.com">
              info@ortakdoku.com
            </a>
          </li>
          <li>
            {tr ? 'Destek: ' : 'Support: '}
            <a className="text-primary hover:underline" href="mailto:support@ortakdoku.com">
              support@ortakdoku.com
            </a>
          </li>
          <li>
            {tr ? 'Güvenlik: ' : 'Security: '}
            <a className="text-primary hover:underline" href="mailto:security@ortakdoku.com">
              security@ortakdoku.com
            </a>
          </li>
        </ul>
      </Section>
      <Section heading={tr ? 'Adres' : 'Address'}>
        <p>
          {tr
            ? 'Ortak Doku — İstanbul, Türkiye. Üretim ve operasyon ekibimiz İstanbul merkezli olarak çalışır; tüm yazışmalar ve resmi başvurular için lütfen yukarıdaki e-posta adreslerini kullanın.'
            : 'Ortak Doku — Istanbul, Türkiye. Our production and operations team is based in Istanbul; please use the email addresses above for all correspondence and official requests.'}
        </p>
      </Section>
      <Section heading={tr ? 'Çalışma Saatleri' : 'Working Hours'}>
        <p>
          {tr
            ? 'Hafta içi 09:00–18:00 (TRT) saatleri arasında hizmet veriyoruz. Bu saatler dışında gönderilen mesajlar bir sonraki iş gününde yanıtlanır. Hafta sonu ve resmi tatillerde destek ekibimiz çevrimdışıdır.'
            : 'We operate on weekdays from 09:00 to 18:00 (TRT). Messages sent outside these hours are answered on the next business day. Our support team is offline on weekends and public holidays.'}
        </p>
      </Section>
      <Section heading={tr ? 'Destek' : 'Support'}>
        <p>
          {tr
            ? 'En hızlı yardım yöntemi panel içi destek talebidir. Giriş yaptıktan sonra hesabınızın paneli üzerinden bir destek talebi (ticket) açabilirsiniz; siparişiniz, dosyalarınız ve hesap geçmişiniz talebe otomatik bağlandığı için çözüm süresi en kısa şekilde sağlanır.'
            : 'The fastest way to get help is through an in-panel support request. After signing in, you can open a support ticket from your account panel; because your order, files and account history are automatically attached to the ticket, resolution times are kept as short as possible.'}
        </p>
        <p>
          {tr
            ? 'Henüz hesabınız yoksa veya panele erişemiyorsanız support@ortakdoku.com adresine yazabilirsiniz.'
            : 'If you do not yet have an account or cannot access the panel, you can write to support@ortakdoku.com.'}
        </p>
      </Section>
    </LegalShell>
  );
}
