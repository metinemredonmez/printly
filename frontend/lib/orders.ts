export interface OrderItem {
  id: string;
  productId: string;
  widthInch: number;
  heightInch: number;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  product?: { name: string; category: string };
}

export interface OrderExtra {
  id: string;
  name: string;
  quantity: number;
  price?: number;
  lineTotal?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  category: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  extrasTotal: number;
  discount40: number;
  total: number;
  totalSqm: number;
  approvedAt?: string | null;
  archivedAt?: string | null;
  isSample?: boolean;
  clientName?: string;
  clientAddress?: string;
  clientCity?: string;
  clientCountry?: string;
  clientZip?: string;
  clientPhone?: string;
  createdAt: string;
  items?: OrderItem[];
  extras?: OrderExtra[];
  user?: { email: string; fullName?: string };
}

export const ORDER_STATUSES = [
  'RECEIVED',
  'IN_PRODUCTION',
  'AWAITING_APPROVAL',
  'READY',
  'SHIPPED',
  'CANCELLED',
] as const;
