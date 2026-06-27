'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function PrivacyPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Gizlilik Politikası' : 'Privacy Policy'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? '1. Topladığımız Veriler' : '1. Data We Collect'}>
        <p>
          {tr
            ? 'Hesap bilgileri (ad, e-posta, telefon, firma), sipariş ve fatura verileri, yüklediğiniz tasarım dosyaları ve kullanım kayıtları (IP, oturum) işlenir.'
            : 'We process account details (name, email, phone, company), order and billing data, design files you upload, and usage logs (IP, session).'}
        </p>
      </Section>
      <Section heading={tr ? '2. Kullanım Amacı' : '2. How We Use It'}>
        <p>
          {tr
            ? 'Veriler; siparişlerin üretimi ve teslimi, fatura kesimi, destek, güvenlik ve yasal yükümlülükler için kullanılır. Pazarlama iletileri yalnızca onayınızla gönderilir.'
            : 'Data is used to produce and deliver orders, issue invoices, provide support, ensure security and meet legal obligations. Marketing messages are sent only with your consent.'}
        </p>
      </Section>
      <Section heading={tr ? '3. Saklama & Güvenlik' : '3. Storage & Security'}>
        <p>
          {tr
            ? 'Hassas alanlar (2FA, kimlik/vergi no) AES-GCM ile şifreli saklanır. Dosyalar erişim-kontrollü nesne depolamada tutulur. Veriler yasal süre boyunca saklanır.'
            : 'Sensitive fields (2FA, tax/ID numbers) are stored AES-GCM encrypted. Files are kept in access-controlled object storage. Data is retained for the legally required period.'}
        </p>
      </Section>
      <Section heading={tr ? '4. Paylaşım' : '4. Sharing'}>
        <p>
          {tr
            ? 'Verileriniz; ödeme, kargo ve üretim iş ortaklarıyla yalnızca hizmetin gerektirdiği ölçüde paylaşılır. Üçüncü taraflara satılmaz.'
            : 'Your data is shared with payment, shipping and production partners only as needed to deliver the service. It is never sold to third parties.'}
        </p>
      </Section>
      <Section heading={tr ? '5. Haklarınız (KVKK/GDPR)' : '5. Your Rights (KVKK/GDPR)'}>
        <p>
          {tr
            ? 'Verilerinize erişme, düzeltme, silme ve dışa aktarma hakkınız vardır. Talepleriniz için: privacy@ortakdoku.com'
            : 'You have the right to access, correct, delete and export your data. Requests: privacy@ortakdoku.com'}
        </p>
      </Section>
    </LegalShell>
  );
}
