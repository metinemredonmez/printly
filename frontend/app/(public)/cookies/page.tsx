'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function CookiesPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Çerez Politikası' : 'Cookie Policy'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? '1. Çerez Nedir?' : '1. What Are Cookies?'}>
        <p>
          {tr
            ? 'Çerezler, oturumunuzu ve tercihlerinizi hatırlamak için tarayıcınıza kaydedilen küçük dosyalardır.'
            : 'Cookies are small files stored in your browser to remember your session and preferences.'}
        </p>
      </Section>
      <Section heading={tr ? '2. Kullandığımız Çerezler' : '2. Cookies We Use'}>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>{tr ? 'Zorunlu:' : 'Essential:'}</b>{' '}
            {tr
              ? 'oturum (od_token) ve dil tercihi (od_locale) — site çalışması için gereklidir.'
              : 'session (od_token) and language preference (od_locale) — required for the site to work.'}
          </li>
          <li>
            <b>{tr ? 'İşlevsel:' : 'Functional:'}</b>{' '}
            {tr ? 'arayüz tercihleri.' : 'interface preferences.'}
          </li>
        </ul>
      </Section>
      <Section heading={tr ? '3. Yönetim' : '3. Managing Cookies'}>
        <p>
          {tr
            ? 'Çerezleri tarayıcı ayarlarınızdan silebilir veya engelleyebilirsiniz; ancak zorunlu çerezler olmadan giriş yapılamaz.'
            : 'You can delete or block cookies in your browser settings; however, you cannot sign in without essential cookies.'}
        </p>
      </Section>
    </LegalShell>
  );
}
