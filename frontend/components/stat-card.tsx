import { type LucideIcon } from 'lucide-react';

const ACCENTS: Record<string, string> = {
  primary: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  navy: 'bg-slate-100 text-navy dark:bg-slate-800 dark:text-white',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 hover:shadow-lg dark:hover:shadow-black/20 transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
          <div className="text-2xl font-semibold text-navy dark:text-white mt-1.5">{value}</div>
          {sub && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
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
