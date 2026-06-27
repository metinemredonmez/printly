'use client';

import { LegalShell, Section, useTr } from '@/components/legal-shell';

export default function PricingPage() {
  const tr = useTr();
  return (
    <LegalShell
      title={tr ? 'Fiyatlandırma' : 'Pricing'}
      updated={tr ? 'Son güncelleme: 27 Haziran 2026' : 'Last updated: June 27, 2026'}
    >
      <Section heading={tr ? '1. Şeffaf Fiyat' : '1. Transparent Pricing'}>
        <p>
          {tr
            ? 'Ortak Doku B2B Print-on-Demand platformunda tüm fiyatlar USD üzerinden ve ölçü bazlı belirlenir. Duvar kağıdı ve benzeri yüzey ürünleri metrekare (m²) başına, decal ve ahşap/CNC ürünleri ise adet başına fiyatlandırılır. Ödeyeceğiniz tutar sipariş anında nettir; gizli ek ücret yoktur.'
            : 'On the Ortak Doku B2B Print-on-Demand platform all prices are set in USD and based on measurement. Wallpaper and similar surface products are priced per square meter (m²), while decals and wood/CNC products are priced per unit. The amount you pay is clear at checkout, with no hidden fees.'}
        </p>
      </Section>
      <Section heading={tr ? '2. Üyelik Planları' : '2. Membership Plans'}>
        <p>
          {tr
            ? 'Fiyatınız üyelik planınıza bağlı bir çarpanla hesaplanır:'
            : 'Your price is calculated using a multiplier tied to your membership plan:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Kullanıcı — Ücretsiz üyelik, baz fiyatın 2× katı uygulanır. Hesabınıza $250 yükleme yaptığınızda %40 indirim kazanırsınız.'
              : 'User — Free membership, charged at 2× the base price. Load $250 to your account to unlock a 40% discount.'}
          </li>
          <li>
            {tr
              ? 'Ekip Üyesi — Aylık $30 abonelik, baz fiyatın 1× katı (tam liste fiyatı) uygulanır.'
              : 'Team Member — $30/month subscription, charged at 1× the base price (full list price).'}
          </li>
          <li>
            {tr
              ? 'Ekip Lideri — Aidatsız, baz fiyatın 1× katı (tam liste fiyatı) uygulanır.'
              : 'Team Lead — No membership fee, charged at 1× the base price (full list price).'}
          </li>
        </ul>
      </Section>
      <Section heading={tr ? '3. Örnek Ürün Fiyatları' : '3. Example Product Prices'}>
        <p>
          {tr
            ? 'Aşağıdaki tutarlar baz (1×) fiyatlardır ve referans amaçlıdır:'
            : 'The amounts below are base (1×) prices and are for reference only:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr
              ? 'Duvar Kağıdı — ~$23/m² (1×, ölçü bazlı)'
              : 'Wallpaper — ~$23/m² (1×, measurement-based)'}
          </li>
          <li>
            {tr
              ? 'Wall Decal — $15 (sabit/flat, adet)'
              : 'Wall Decal — $15 (flat, per unit)'}
          </li>
          <li>
            {tr
              ? 'Ahşap / CNC — $35 (sabit/flat, adet)'
              : 'Wood / CNC — $35 (flat, per unit)'}
          </li>
        </ul>
        <p>
          {tr
            ? 'Opsiyonel ekstralar:'
            : 'Optional extras:'}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{tr ? 'Kargo kutusu — $2.50' : 'Shipping box — $2.50'}</li>
          <li>{tr ? 'Kurulum kiti — $3.00' : 'Installation kit — $3.00'}</li>
          <li>{tr ? 'Numune — $2.50' : 'Sample — $2.50'}</li>
        </ul>
      </Section>
      <Section heading={tr ? '4. Not' : '4. Note'}>
        <p>
          {tr
            ? 'Fiyatlar; seçtiğiniz plan ve üyelik çarpanına (1× veya 2×), yükleme indirimlerine ve seçilen ekstralara göre değişir. Nihai tutar, ölçüleriniz ve seçimleriniz baz alınarak panelde canlı olarak hesaplanır. Sorularınız için: info@ortakdoku.com'
            : 'Prices vary based on your selected plan and membership multiplier (1× or 2×), top-up discounts and chosen extras. The final amount is calculated live in your dashboard based on your measurements and selections. Questions: info@ortakdoku.com'}
        </p>
      </Section>
    </LegalShell>
  );
}
