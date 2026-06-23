import { OrdersList } from '@/components/orders/orders-list';

export default function Page() {
  return <OrdersList basePath="/admin/orders" staff />;
}
