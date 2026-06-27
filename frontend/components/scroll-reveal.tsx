'use client';

import { useEffect } from 'react';

// Modern kademeli giriş — viewport'a giren bölümler yumuşakça belirir.
// Flash önleme: yalnız fold ALTINDAKİ bölümlere uygulanır (görünür olanlar dokunulmaz).
export function ScrollReveal() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('main section')).filter(
      (s) => s.id !== 'ecosystem',
    );
    if (!sections.length) return;

    if (!('IntersectionObserver' in window)) {
      sections.forEach((s) => s.classList.add('od-in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('od-in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    );

    const vh = window.innerHeight;
    sections.forEach((s) => {
      const top = s.getBoundingClientRect().top;
      if (top > vh * 0.85) {
        s.classList.add('od-reveal'); // fold altı → gizle + gözlemle
        io.observe(s);
      }
    });

    return () => io.disconnect();
  }, []);

  return null;
}
