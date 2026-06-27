// Ortak Doku gerçek logosu — kaynak: ortak_doku_sipari_ve_operasyon_portal.html
// Renkler: navy #0B1F3A, zeytin yeşili #6B8E23

/** Apple amblemi (App Store rozeti için) */
export function AppleLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/** Google Play amblemi (4 renk üçgen) */
export function GooglePlayLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4.6 3.36C4.32 3.53 4.16 3.87 4.16 4.32v15.36c0 .45.16.79.45.96l8.45-8.34L4.6 3.36z" fill="#00D2FF" />
      <path d="M12.95 11.62l2.96-2.96L6.36 3.29c-.63-.34-1.23-.39-1.75-.02l8.34 8.35z" fill="#00E676" />
      <path d="M12.95 11.85l-8.34 8.34c.52.37 1.12.32 1.75-.02l9.55-5.37-2.96-2.95z" fill="#FF3D44" />
      <path d="M16.42 15.08l3.07-1.73c.6-.34.93-.81.93-1.35 0-.53-.34-1.01-.93-1.34l-2.95-1.66-3.18 3.18 3.06 2.9z" fill="#FFC500" />
    </svg>
  );
}

/** Sadece amblem (kare alanlarda + koyu zeminde metinle yan yana) */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="100 8 195 164" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="180" y="20" width="24" height="140" rx="12" fill="#6B8E23" />
      <rect x="220" y="20" width="24" height="140" rx="12" fill="#6B8E23" />
      <rect x="260" y="20" width="24" height="140" rx="12" fill="#6B8E23" />
      <path d="M120 50 C 160 50, 160 130, 120 130" stroke="#0B1F3A" strokeWidth="24" strokeLinecap="round" fill="none" />
      <path d="M110 90 L 190 90" stroke="#0B1F3A" strokeWidth="24" strokeLinecap="round" />
      <path d="M180 90 C 210 60, 230 60, 260 90" stroke="#6B8E23" strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M180 90 C 210 120, 230 120, 260 90" stroke="#0B1F3A" strokeWidth="12" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Tam logo (amblem + yazı) — açık zeminde kullan (yazı navy). */
export function Logo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(10, 10) scale(0.9)">
        <rect x="180" y="20" width="24" height="140" rx="12" fill="#6B8E23" />
        <rect x="220" y="20" width="24" height="140" rx="12" fill="#6B8E23" />
        <rect x="260" y="20" width="24" height="140" rx="12" fill="#6B8E23" />
        <path d="M120 50 C 160 50, 160 130, 120 130" stroke="#0B1F3A" strokeWidth="24" strokeLinecap="round" fill="none" />
        <path d="M110 90 L 190 90" stroke="#0B1F3A" strokeWidth="24" strokeLinecap="round" />
        <path d="M180 90 C 210 60, 230 60, 260 90" stroke="#6B8E23" strokeWidth="12" strokeLinecap="round" fill="none" />
        <path d="M180 90 C 210 120, 230 120, 260 90" stroke="#0B1F3A" strokeWidth="12" strokeLinecap="round" fill="none" />
      </g>
      <text x="320" y="110" fontFamily="Inter, sans-serif" fontSize="44" fontWeight="800" fill="#0B1F3A" letterSpacing="1">
        ORTAK DOKU
      </text>
      <text x="325" y="150" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="600" fill="#6B8E23" letterSpacing="4">
        BİRLİKTE ÜRETİR, BİRLİKTE BÜYÜRÜZ
      </text>
    </svg>
  );
}
