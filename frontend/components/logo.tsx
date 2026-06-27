// Ortak Doku gerçek logosu — kaynak: ortak_doku_sipari_ve_operasyon_portal.html
// Renkler: navy #0B1F3A, zeytin yeşili #6B8E23

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
