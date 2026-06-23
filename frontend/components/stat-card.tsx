import { type LucideIcon } from 'lucide-react';

const ACCENTS: Record<string, string> = {
  primary: 'bg-blue-50 text-primary',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  navy: 'bg-slate-100 text-navy',
  rose: 'bg-rose-50 text-rose-600',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  accent = 'primary',
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  sub?: string;
  accent?: keyof typeof ACCENTS | string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="text-2xl font-extrabold text-navy mt-1.5">{value}</div>
          {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
        </div>
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center ${
            ACCENTS[accent] ?? ACCENTS.primary
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
