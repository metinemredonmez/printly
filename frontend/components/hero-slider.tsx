'use client';

import { useEffect, useState } from 'react';

const SLIDES = [
  '/banners/hero-1.jpg',
  '/banners/hero-2.jpg',
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
      {/* sol opak → sağ görsel NET görünür (yazı okunur, görsel belirgin) */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#F8F9FA]/95 from-20% via-[#F8F9FA]/55 to-[#F8F9FA]/10" />

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
