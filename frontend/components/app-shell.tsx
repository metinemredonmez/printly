'use client';

import { useState } from 'react';
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
  Crown,
  Webhook,
  Receipt,
  Building2,
  GraduationCap,
  CalendarDays,
  Headset,
  Network,
  Undo2,
  Bell,
  Search,
  TrendingUp,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, logout } from '@/lib/api';
import { useMe } from '@/lib/useMe';
import { LangSwitcher } from '@/components/lang-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoMark } from '@/components/logo';

type NavItem = { href: string; key: string; icon: LucideIcon };

const DEALER_NAV: NavItem[] = [
  { href: '/app', key: 'panel', icon: LayoutDashboard },
  { href: '/app/orders/new', key: 'newOrder', icon: PlusCircle },
  { href: '/app/orders', key: 'myOrders', icon: ShoppingCart },
  { href: '/app/stores', key: 'stores', icon: Store },
  { href: '/app/integrations', key: 'integrations', icon: Webhook },
  { href: '/app/credits', key: 'creditsMembership', icon: Wallet },
  { href: '/app/membership', key: 'membership', icon: Crown },
  { href: '/app/transactions', key: 'transactions', icon: Receipt },
  { href: '/app/profit', key: 'netProfit', icon: TrendingUp },
  { href: '/app/billing', key: 'billing', icon: FileText },
  { href: '/app/returns', key: 'returns', icon: Undo2 },
  { href: '/app/education', key: 'education', icon: GraduationCap },
  { href: '/app/consulting', key: 'consulting', icon: Headset },
  { href: '/app/events', key: 'events', icon: CalendarDays },
  { href: '/app/network', key: 'network', icon: Network },
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
  { href: '/admin/organizations', key: 'organizations', icon: Building2 },
  { href: '/admin/reports', key: 'reports', icon: BarChart3 },
  { href: '/admin/tickets', key: 'support', icon: LifeBuoy },
  { href: '/admin/returns', key: 'adminReturns', icon: Undo2 },
  { href: '/admin/education', key: 'adminEducation', icon: GraduationCap },
  { href: '/admin/events', key: 'adminEvents', icon: CalendarDays },
  { href: '/admin/consulting', key: 'adminConsulting', icon: Headset },
  { href: '/admin/map', key: 'map', icon: MapIcon },
  { href: '/admin/audit', key: 'audit', icon: ScrollText },
  { href: '/admin/settings', key: 'settings', icon: Settings },
  { href: '/admin/profile', key: 'profile', icon: UserIcon },
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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  // Okunmamış bildirim sayısı (rozet) — 30sn'de bir tazelenir
  const { data: unread } = useQuery({
    queryKey: ['notif', 'unread'],
    queryFn: () => api<{ unread: number }>('/notifications/center/unread-count'),
    refetchInterval: 30000,
    staleTime: 20000,
  });
  const unreadCount = unread?.unread ?? 0;

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`${area === 'admin' ? '/admin' : '/app'}/search?q=${encodeURIComponent(term)}`);
  };

  async function onLogout() {
    await logout();
    router.replace('/login');
    router.refresh();
  }

  const root = area === 'admin' ? '/admin' : '/app';
  const isActive = (href: string) =>
    href === root ? pathname === href : pathname.startsWith(href);

  const SidebarInner = (
    <>
      <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10">
        <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center">
          <LogoMark className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="font-semibold leading-none">{tc('appName')}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">
            {area === 'admin' ? t('operations') : t('dealerPortal')}
          </div>
        </div>
        <button className="md:hidden text-slate-300" onClick={() => setOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
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
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-navy text-white flex-col shrink-0 shadow-2xl">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-navy text-white flex flex-col shadow-2xl">
            {SidebarInner}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FA] dark:bg-slate-950">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button className="md:hidden text-navy dark:text-white" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="font-semibold text-navy dark:text-white hidden sm:block whitespace-nowrap">
              {area === 'admin' ? t('opsConsole') : t('dealerPortal')}
            </div>
          </div>

          {/* Global arama */}
          <form onSubmit={onSearch} className="hidden md:flex flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tc('searchPlaceholder')}
                className="h-9 w-full pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-navy dark:text-white placeholder:text-slate-400 outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
              />
            </div>
          </form>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link
              href={`${area === 'admin' ? '/admin' : '/app'}/notifications`}
              aria-label={t('notifications')}
              className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-medium flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <LangSwitcher />
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-navy dark:text-white max-w-[160px] truncate">{me?.email ?? '—'}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500">{me?.role ?? ''}</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-sm shrink-0">
              {(me?.email ?? '?').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
