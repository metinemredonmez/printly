'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Bağımsız tema toggle — localStorage('od_theme') + <html>.dark. Flash önleme layout <head> script'inde.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  const toggle = () => {
    const el = document.documentElement;
    const next = !el.classList.contains('dark');
    el.classList.toggle('dark', next);
    try {
      localStorage.setItem('od_theme', next ? 'dark' : 'light');
    } catch {}
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Açık tema' : 'Koyu tema'}
      title={dark ? 'Açık tema' : 'Koyu tema'}
      className={`h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${className}`}
    >
      {/* mounted olana kadar sabit ikon → hydration uyumsuzluğu yok */}
      {mounted && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
