'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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

type NavItem = { href: string; label: string; icon: LucideIcon };

const DEALER_NAV: NavItem[] = [
  { href: '/app', label: 'Panel', icon: LayoutDashboard },
  { href: '/app/orders/new', label: 'Yeni Sipariş', icon: PlusCircle },
  { href: '/app/orders', label: 'Siparişlerim', icon: ShoppingCart },
  { href: '/app/stores', label: 'Mağazalar', icon: Store },
  { href: '/app/credits', label: 'Bakiye & Üyelik', icon: Wallet },
  { href: '/app/billing', label: 'Fatura', icon: FileText },
  { href: '/app/tickets', label: 'Destek', icon: LifeBuoy },
  { href: '/app/profile', label: 'Profil', icon: UserIcon },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Siparişler', icon: ShoppingCart },
  { href: '/admin/board', label: 'Kanban', icon: KanbanSquare },
  { href: '/admin/production', label: 'Üretim', icon: Factory },
  { href: '/admin/catalog', label: 'Katalog', icon: Package },
  { href: '/admin/users', label: 'Kullanıcılar', icon: Users },
  { href: '/admin/reports', label: 'Raporlar', icon: BarChart3 },
  { href: '/admin/tickets', label: 'Destek', icon: LifeBuoy },
  { href: '/admin/map', label: 'Harita', icon: MapIcon },
  { href: '/admin/audit', label: 'Audit', icon: ScrollText },
  { href: '/admin/settings', label: 'Ayarlar', icon: Settings },
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
  const nav = area === 'admin' ? ADMIN_NAV : DEALER_NAV;

  async function onLogout() {
    await logout();
    toast.success('Çıkış yapıldı');
    router.replace('/login');
    router.refresh();
  }

  const isActive = (href: string) =>
    href === `/${area === 'admin' ? 'admin' : 'app'}`
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-navy text-white flex-col shrink-0 shadow-2xl">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center font-extrabold">
            OD
          </div>
          <div>
            <div className="font-bold leading-none">Ortak Doku</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
              {area === 'admin' ? 'Operasyon' : 'Bayi Portalı'}
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
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={onLogout}
          className="m-3 flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Çıkış
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-100 sticky top-0 z-30 flex items-center justify-between px-6 shadow-sm">
          <div className="font-bold text-navy capitalize">
            {area === 'admin' ? 'Operasyon Konsolu' : 'Bayi Portalı'}
          </div>
          <div className="flex items-center gap-3">
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
