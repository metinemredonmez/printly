'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  ShoppingCart,
  PlusCircle,
  Store,
  Wallet,
  User as UserIcon,
  FileText,
  LifeBuoy,
  KanbanSquare,
  Factory,
  Package,
  Users,
  BarChart3,
  Settings,
  Map as MapIcon,
  ScrollText,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { logout } from '@/lib/api';
import { useMe } from '@/lib/useMe';
import { LangSwitcher } from '@/components/lang-switcher';

type NavItem = { href: string; key: string; icon: LucideIcon };

const DEALER_NAV: NavItem[] = [
  { href: '/app', key: 'panel', icon: LayoutDashboard },
  { href: '/app/orders/new', key: 'newOrder', icon: PlusCircle },
  { href: '/app/orders', key: 'myOrders', icon: ShoppingCart },
  { href: '/app/stores', key: 'stores', icon: Store },
  { href: '/app/credits', key: 'creditsMembership', icon: Wallet },
  { href: '/app/billing', key: 'billing', icon: FileText },
  { href: '/app/tickets', key: 'support', icon: LifeBuoy },
  { href: '/app/profile', key: 'profile', icon: UserIcon },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', key: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', key: 'orders', icon: ShoppingCart },
  { href: '/admin/board', key: 'kanban', icon: KanbanSquare },
  { href: '/admin/production', key: 'production', icon: Factory },
  { href: '/admin/catalog', key: 'catalog', icon: Package },
  { href: '/admin/users', key: 'users', icon: Users },
  { href: '/admin/reports', key: 'reports', icon: BarChart3 },
  { href: '/admin/tickets', key: 'support', icon: LifeBuoy },
  { href: '/admin/map', key: 'map', icon: MapIcon },
  { href: '/admin/audit', key: 'audit', icon: ScrollText },
  { href: '/admin/settings', key: 'settings', icon: Settings },
];

export function AppShell({
  area,
  children,
}: {
  area: 'dealer' | 'admin';
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const nav = area === 'admin' ? ADMIN_NAV : DEALER_NAV;

  async function onLogout() {
    await logout();
    router.replace('/login');
    router.refresh();
  }

  const root = area === 'admin' ? '/admin' : '/app';
  const isActive = (href: string) =>
    href === root ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-64 bg-navy text-white flex-col shrink-0 shadow-2xl">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center font-extrabold">
            OD
          </div>
          <div>
            <div className="font-bold leading-none">{tc('appName')}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
              {area === 'admin' ? t('operations') : t('dealerPortal')}
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary text-white font-semibold'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={onLogout}
          className="m-3 flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {tc('logout')}
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-100 sticky top-0 z-30 flex items-center justify-between px-6 shadow-sm">
          <div className="font-bold text-navy">
            {area === 'admin' ? t('opsConsole') : t('dealerPortal')}
          </div>
          <div className="flex items-center gap-4">
            <LangSwitcher />
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-navy">{me?.email ?? '—'}</div>
              <div className="text-[11px] text-slate-400">{me?.role ?? ''}</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
              {(me?.email ?? '?').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
