// Sayfa üstü banner — minimal, koyu overlay'li (opsiyonel blur).
// image yoksa navy gradient'e düşer (kırık görsel olmaz). Görseller: /public/banners/*.jpg

export function PageBanner({
  title,
  subtitle,
  image,
  blur = false,
}: {
  title: string;
  subtitle?: string;
  image?: string;
  blur?: boolean;
}) {
  return (
    <div className="relative h-52 sm:h-64 flex items-center overflow-hidden bg-navy">
      {/* arka görsel */}
      {image && (
        <div
          className={`absolute inset-0 bg-cover bg-center scale-105 ${blur ? 'blur-[2px]' : ''}`}
          style={{ backgroundImage: `url(${image})` }}
        />
      )}
      {/* koyu overlay (metin okunsun + minimal his) */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/75 to-navy/60" />
      {/* dekoratif marka mesh */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(40% 60% at 90% 20%, rgba(31,94,255,0.25), transparent 70%), radial-gradient(30% 50% at 75% 90%, rgba(107,142,35,0.2), transparent 70%)',
        }}
      />
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-300 mt-2 max-w-2xl">{subtitle}</p>}
      </div>
    </div>
  );
}
