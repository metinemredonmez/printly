'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function ContactPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'İletişim' : 'Contact'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? '1. Bize Ulaşın' : '1. Get in Touch'}>
        <p>
          {tr
            ? 'Ortak Doku, duvar kağıdı, decal ve ahşap baskı üretim ağıyla ABD pazarındaki Etsy satıcılarına hizmet veren bir B2B Print-on-Demand platformudur. Genel sorularınız, iş birliği talepleriniz ve ticari görüşmeleriniz için aşağıdaki e-posta adresleri üzerinden bizimle iletişime geçebilirsiniz.'
            : 'Ortak Doku is a B2B Print-on-Demand platform serving Etsy sellers in the US market through a production network for wallpaper, decals and wood printing. For general questions, partnership requests and commercial inquiries, you can reach us through the email addresses below.'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr ? 'Genel sorular: ' : 'General inquiries: '}
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
            {tr ? 'Güvenlik bildirimleri: ' : 'Security reports: '}
            <a className="text-primary hover:underline" href="mailto:security@ortakdoku.com">
              security@ortakdoku.com
            </a>
          </li>
        </ul>
        <p>
          {tr
            ? 'E-postalarınızı yanıtlarken siparişlerinizi ve hesabınızı doğru eşleştirebilmemiz için lütfen kayıtlı firma adınızı ve varsa sipariş numaranızı belirtin.'
            : 'When emailing us, please include your registered company name and order number (if any) so we can correctly match your orders and account.'}
        </p>
      </Section>

      <Section heading={tr ? '2. Adres' : '2. Address'}>
        <p>
          {tr
            ? 'Ortak Doku — İstanbul, Türkiye. Üretim ve operasyon ekibimiz İstanbul merkezli olarak çalışır. Tüm yazışmalar, resmi başvurular ve fatura talepleri için lütfen yukarıdaki e-posta adreslerini kullanın; ziyaretler yalnızca önceden randevuyla kabul edilir.'
            : 'Ortak Doku — Istanbul, Türkiye. Our production and operations team is based in Istanbul. Please use the email addresses above for all correspondence, official requests and invoicing matters; visits are accepted by prior appointment only.'}
        </p>
      </Section>

      <Section heading={tr ? '3. Çalışma Saatleri' : '3. Working Hours'}>
        <p>
          {tr
            ? 'Hafta içi 09:00–18:00 (TRT) saatleri arasında hizmet veriyoruz. Bu saatler dışında gönderilen mesajlar bir sonraki iş gününde sırayla yanıtlanır. Hafta sonu ve Türkiye resmi tatillerinde destek ekibimiz çevrimdışıdır; bu dönemlerde panel üzerinden açılan talepler önceliklendirilerek işleme alınır.'
            : 'We operate on weekdays from 09:00 to 18:00 (TRT). Messages sent outside these hours are answered in order on the next business day. Our support team is offline on weekends and Turkish public holidays; during those periods, requests opened through the panel are prioritized when we return.'}
        </p>
      </Section>

      <Section heading={tr ? '4. Destek' : '4. Support'}>
        <p>
          {tr
            ? 'En hızlı yardım yöntemi panel içi destek talebidir. Giriş yaptıktan sonra hesabınızın paneli üzerinden bir destek talebi (ticket) açabilirsiniz; siparişiniz, dosyalarınız ve hesap geçmişiniz talebe otomatik bağlandığı için çözüm süresi en kısa şekilde sağlanır.'
            : 'The fastest way to get help is through an in-panel support request. After signing in, you can open a support ticket from your account panel; because your order, files and account history are automatically attached to the ticket, resolution times are kept as short as possible.'}
        </p>
        <p>
          {tr
            ? 'Bir talep oluştururken aşağıdaki bilgileri eklemeniz çözümü hızlandırır:'
            : 'Including the following details when you open a ticket helps us resolve it faster:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{tr ? 'İlgili sipariş veya ürün numarası' : 'The related order or product number'}</li>
          <li>{tr ? 'Sorunun kısa açıklaması ve varsa ekran görüntüsü' : 'A short description of the issue and a screenshot if available'}</li>
          <li>{tr ? 'Beklediğiniz sonuç veya talebiniz' : 'The outcome or action you expect'}</li>
        </ul>
        <p>
          {tr
            ? 'Henüz hesabınız yoksa veya panele erişemiyorsanız support@ortakdoku.com adresine yazabilirsiniz.'
            : 'If you do not yet have an account or cannot access the panel, you can write to support@ortakdoku.com.'}
        </p>
      </Section>

      <Section heading={tr ? '5. Sık Sorulanlar' : '5. Frequently Asked Questions'}>
        <p>
          {tr
            ? 'Üretim süreleri, dosya formatları, kargo, iade ve faturalandırma gibi konularda en sık sorulan soruların yanıtlarının çoğu hazır olarak sizi bekliyor. Bize yazmadan önce SSS sayfamıza göz atın; aradığınız yanıtı büyük olasılıkla orada anında bulabilirsiniz.'
            : 'Answers to the most common questions — production times, file formats, shipping, returns and billing — are already prepared and waiting for you. Before writing to us, take a look at our FAQ page; you will most likely find the answer you are looking for there instantly.'}
        </p>
      </Section>
    </LegalShell>
  );
}
