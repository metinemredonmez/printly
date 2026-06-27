'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function SecurityPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Güvenlik' : 'Security'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? '1. Veri Şifreleme' : '1. Data Encryption'}>
        <p>
          {tr
            ? 'Ortak Doku platformunda hassas alanlar (2FA secret değerleri, kimlik ve vergi numaraları gibi) veritabanında AES-GCM ile at-rest (durağan halde) şifrelenerek saklanır; bu sayede depolama katmanına erişilse dahi veriler okunamaz kalır.'
            : 'On the Ortak Doku platform, sensitive fields (such as 2FA secrets, identity and tax numbers) are stored encrypted at rest in the database using AES-GCM, so the data stays unreadable even if the storage layer is accessed.'}
        </p>
        <p>
          {tr
            ? 'Oturum bilgileri httpOnly çerezlerde tutulur; bu çerezler JavaScript ile okunamadığı için XSS (siteler arası betik) saldırılarına karşı dayanıklıdır. Tüm trafik aktarım sırasında TLS ile şifrelenir.'
            : 'Session data is held in httpOnly cookies; because these cookies cannot be read by JavaScript, they are resilient against XSS (cross-site scripting) attacks. All traffic is encrypted in transit with TLS.'}
        </p>
      </Section>
      <Section heading={tr ? '2. Kimlik Doğrulama' : '2. Authentication'}>
        <p>
          {tr
            ? 'Kullanıcı kimlik doğrulaması JWT (JSON Web Token) tabanlıdır ve erişim, rol ile izin tabanlı (RBAC) olarak denetlenir. Her kullanıcı yalnızca kendi rolünün ve izinlerinin kapsadığı kaynaklara erişebilir.'
            : 'User authentication is JWT (JSON Web Token) based, and access is governed by role and permission-based access control (RBAC). Each user can only reach resources covered by their role and permissions.'}
        </p>
        <p>
          {tr
            ? 'Hesaplarınız için opsiyonel iki adımlı doğrulama (2FA) sunulur. TOTP (zaman tabanlı tek kullanımlık parola) standardını destekleyen herhangi bir kimlik doğrulayıcı uygulamayı kullanarak ek bir güvenlik katmanı ekleyebilirsiniz.'
            : 'Optional two-factor authentication (2FA) is available for your accounts. You can add an extra layer of security using any authenticator app that supports the TOTP (time-based one-time password) standard.'}
        </p>
      </Section>
      <Section heading={tr ? '3. Altyapı' : '3. Infrastructure'}>
        <p>
          {tr
            ? 'Altyapımız, üretim ağını oluşturan B2B Print-on-Demand iş akışını güvenli biçimde yürütmek üzere katmanlı koruma ilkeleriyle tasarlanmıştır:'
            : 'Our infrastructure is designed with layered protection principles to securely run the B2B Print-on-Demand workflow that powers the production network:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Büyük tasarım dosyaları, erişim kontrollü ve izole nesne depolamada (object storage) tutulur; doğrudan açık internete açılmaz.'
              : 'Large design files are kept in access-controlled, isolated object storage and are never directly exposed to the public internet.'}
          </li>
          <li>
            {tr
              ? 'API uç noktalarında rate-limit (hız sınırlama) uygulanarak kötüye kullanım ve kaba kuvvet denemeleri engellenir.'
              : 'Rate limiting is applied to API endpoints to prevent abuse and brute-force attempts.'}
          </li>
          <li>
            {tr
              ? 'Kritik işlemler için denetim (audit) kayıtları tutulur; kim, ne zaman, hangi eylemi gerçekleştirdi izlenebilir.'
              : 'Audit logs are kept for critical operations, making it traceable who performed which action and when.'}
          </li>
        </ul>
      </Section>
      <Section heading={tr ? '4. Uyumluluk' : '4. Compliance'}>
        <p>
          {tr
            ? 'Veri işleme süreçlerimiz KVKK ve GDPR düzenlemeleriyle uyumlu olacak şekilde yürütülür. Bu kapsamda verilerinize erişme, düzeltme, silme ve dışa aktarma (taşınabilirlik) haklarına sahipsiniz.'
            : 'Our data processing practices are run in line with KVKK and GDPR regulations. Within this scope, you have the rights to access, correct, delete and export (portability of) your data.'}
        </p>
        <p>
          {tr
            ? 'Veri erişim, silme veya dışa aktarma taleplerinizi info@ortakdoku.com veya support@ortakdoku.com adreslerine iletebilirsiniz; başvurularınız yasal süreler içinde yanıtlanır.'
            : 'You can send your data access, deletion or export requests to info@ortakdoku.com or support@ortakdoku.com; your requests are answered within the legally required timeframes.'}
        </p>
      </Section>
      <Section heading={tr ? '5. Sorumlu Açıklama' : '5. Responsible Disclosure'}>
        <p>
          {tr
            ? 'Güvenliği ciddiye alıyoruz. Platformumuzda bir güvenlik açığı bulduğunuzu düşünüyorsanız, lütfen bunu kamuya açıklamadan önce security@ortakdoku.com adresine bildirin. Detayları ve yeniden üretim adımlarını paylaşmanız incelemeyi hızlandırır.'
            : 'We take security seriously. If you believe you have found a vulnerability on our platform, please report it to security@ortakdoku.com before disclosing it publicly. Sharing details and reproduction steps helps us investigate faster.'}
        </p>
        <p>
          {tr
            ? 'İyi niyetle yapılan bildirimleri değerlendirir ve raporunuzu en kısa sürede yanıtlamaya özen gösteririz. Ortak Doku, İstanbul.'
            : 'We review good-faith reports and aim to respond to your report as soon as possible. Ortak Doku, Istanbul.'}
        </p>
      </Section>
    </LegalShell>
  );
}
