import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 flex items-center justify-between px-6 md:px-10 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-extrabold">
            OD
          </div>
          <span className="font-extrabold text-navy">Ortak Doku</span>
        </div>
        <Link
          href="/login"
          className="px-5 h-10 inline-flex items-center text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors"
        >
          Giriş Yap
        </Link>
      </header>

      <main className="flex-1 grid lg:grid-cols-2 items-center gap-10 px-6 md:px-10 py-16 max-w-6xl mx-auto">
        <div className="space-y-6">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-primary">
            B2B Print-on-Demand
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy leading-tight tracking-tight">
            Sipariş, üretim ve operasyon — tek ekosistemde.
          </h1>
          <p className="text-lg text-slate-600">
            Duvar kağıdı (m²), wall decal ve CNC ahşap üretiminizi; canlı fiyat, dosya
            yönetimi, üretim takibi ve bayi yönetimiyle baştan sona yönetin.
          </p>
          <div className="flex gap-3">
            <Link
              href="/register"
              className="px-7 py-3.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-colors"
            >
              Şimdi Başvur
            </Link>
            <Link
              href="/login"
              className="px-7 py-3.5 border border-primary text-primary font-bold rounded-xl hover:bg-blue-50 transition-colors"
            >
              Giriş Yap
            </Link>
          </div>
        </div>
        <div className="hidden lg:flex justify-center">
          <div className="h-72 w-72 rounded-full border-4 border-dashed border-primary/30 flex items-center justify-center">
            <div className="h-40 w-40 rounded-full bg-navy flex items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-brand-accent" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
