import { AppShell } from '@/components/app-shell';

export default function DealerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell area="dealer">{children}</AppShell>;
}
