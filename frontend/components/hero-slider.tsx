'use client';

import { useEffect, useState } from 'react';

// hero-2.jpg = hero.jpg'in birebir kopyasıydı → 3 farklı slayt
const SLIDES = [
  '/banners/hero-1.jpg',
  '/banners/hero-3.jpg',
  '/banners/hero-4.jpg',
];

// Hero arka plan slaytı — otomatik cross-fade, okunabilirlik için açık gradient overlay.
export function HeroSlider() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      {SLIDES.map((s, idx) => (
        <div
          key={s}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1200ms] ease-in-out scale-105"
          style={{ backgroundImage: `url(${s})`, opacity: idx === i ? 1 : 0 }}
        />
      ))}
      {/* sol koyu (yazı net okunur) → sağ görsel CANLI kalır */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy/92 from-0% via-navy/50 via-45% to-transparent to-75%" />
      {/* alt yumuşak geçiş (bir sonraki bölüme) */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F8F9FA]" />

      {/* slayt göstergeleri */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {SLIDES.map((s, idx) => (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-6 bg-primary' : 'w-1.5 bg-slate-300'}`}
          />
        ))}
      </div>
    </div>
  );
}
