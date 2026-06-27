import type { Integration } from '@/lib/public';

const DEFAULT_INTEGRATIONS: Integration[] = [
  { name: 'Etsy', status: 'soon' },
  { name: 'QuickBooks', status: 'soon' },
  { name: 'Stripe', status: 'soon' },
  { name: 'Cloudflare R2', status: 'connected' },
];

export function IntegrationsBand({ tr, integrations }: { tr: boolean; integrations?: Integration[] }) {
  const list = Array.isArray(integrations) && integrations.length ? integrations : DEFAULT_INTEGRATIONS;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center space-y-3 mb-8">
        <h2 className="text-3xl font-semibold text-navy">{tr ? 'Entegrasyonlar' : 'Integrations'}</h2>
        <p className="text-slate-500 max-w-2xl mx-auto">
          {tr
            ? 'Ekosistemi tamamlayan servisler — bağlı olanlar ve yakında gelenler.'
            : 'Services that complete the ecosystem — connected and coming soon.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {list.map((i) => (
          <div
            key={i.name}
            className="inline-flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-5 py-3"
          >
            <span className="text-sm font-medium text-navy">{i.name}</span>
            {i.status === 'connected' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {tr ? 'bağlı' : 'connected'}
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {tr ? 'yakında' : 'soon'}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
