import Link from 'next/link';
import {
  Factory,
  ClipboardList,
  Cog,
  Truck,
  Cpu,
  Handshake,
  CircleCheck,
} from 'lucide-react';

const CAPS = [
  { icon: Factory, title: 'Üretim Ağı', desc: 'm² duvar kağıdı, decal ve CNC ahşap — tek üretim hattında.' },
  { icon: ClipboardList, title: 'Sipariş Yönetimi', desc: 'Canlı fiyat, durum makinesi, onay ve iade akışları.' },
  { icon: Cog, title: 'Operasyonel Sistemler', desc: 'Kanban, QR istasyon takibi, üretim kuyrukları.' },
  { icon: Truck, title: 'Fulfillment', desc: 'Etiket, packing slip, kargo takibi ve white-label.' },
  { icon: Cpu, title: 'Teknoloji', desc: 'R2 büyük dosya yönetimi, webhook, partner API.' },
  { icon: Handshake, title: 'İş Ortaklıkları', desc: 'Etsy entegrasyonu, bayi kredi/üyelik sistemi.' },
];

const PLANS = [
  {
    name: 'Kullanıcı',
    badge: 'Ücretsiz',
    color: 'border-slate-200',
    price: '2× fiyat',
    features: ['Ücretsiz kayıt', '$250 yükle → %40 indirim', 'Tüm temel özellikler'],
  },
  {
    name: 'Ekip Üyesi',
    badge: 'Tavsiye edilen',
    color: 'border-primary ring-2 ring-primary/20',
    price: '$30 / ay',
    features: ['1× fiyat (yarı fiyat)', 'Bir ekip liderine bağlı', 'Öncelikli destek'],
  },
  {
    name: 'Ekip Lideri',
    badge: 'Koordinatör',
    color: 'border-amber-200',
    price: 'Aidatsız',
    features: ['1× fiyat', 'Üyelerini yönet', 'Aidat yok'],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 flex items-center justify-between px-6 md:px-10 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-extrabold">
            OD
          </div>
          <span className="font-extrabold text-navy">Ortak Doku</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-primary">
            Giriş Yap
          </Link>
          <Link
            href="/register"
            className="px-5 h-10 inline-flex items-center text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors"
          >
            Başvur
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 py-16 max-w-6xl mx-auto grid lg:grid-cols-2 items-center gap-10">
        <div className="space-y-6">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-primary">
            B2B Print-on-Demand
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy leading-tight tracking-tight">
            Tek ekosistem. Çoklu yetenek.
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
      </section>

      {/* Yetenekler */}
      <section className="px-6 md:px-10 py-12 max-w-6xl mx-auto w-full">
        <h2 className="text-3xl font-extrabold text-navy text-center mb-10">
          Tek Ekosistem. Çoklu Yetenek.
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CAPS.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="bg-white p-6 rounded-2xl border border-slate-100 hover:shadow-xl transition-shadow"
              >
                <div className="h-12 w-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-navy">{c.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Üyelik modelleri */}
      <section className="px-6 md:px-10 py-12 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-extrabold text-navy text-center mb-2">Üyelik Modelleri</h2>
          <p className="text-center text-slate-500 mb-10">Size en uygun planla başlayın.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((p) => (
              <div key={p.name} className={`rounded-3xl border-2 ${p.color} p-7 bg-white`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-extrabold text-navy">{p.name}</h3>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {p.badge}
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-primary mb-4">{p.price}</div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <CircleCheck className="h-4 w-4 text-brand-accent shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="block text-center px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-colors"
                >
                  Bu planla başla
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 md:px-10 py-8 text-center text-sm text-slate-400">
        © 2026 Ortak Doku — B2B Print-on-Demand Platformu
      </footer>
    </div>
  );
}
