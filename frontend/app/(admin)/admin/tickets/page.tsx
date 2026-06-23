import { TicketsList } from '@/components/tickets/tickets-list';

export default function Page() {
  return <TicketsList basePath="/admin/tickets" staff />;
}
