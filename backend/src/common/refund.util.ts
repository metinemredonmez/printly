import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

type RefundableOrder = {
  id: string;
  userId: string;
  orderNumber: string;
  total: Prisma.Decimal;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
};

/**
 * CANCELLED'a geçişte, BALANCE ile ödenmiş (PAID) siparişte atomik bakiye iadesi yapar:
 * bakiyeyi geri ekler + ters CreditLedger + iade Transaction'ı oluşturur.
 * MUTLAKA bir Prisma $transaction client'ı (tx) içinde çağrılmalı.
 * İade yapıldıysa true döner (çağıran paymentStatus'u REFUNDED'a çekmeli).
 * REFUND tipi enum'da olmadığından iade kredisi BALANCE_LOAD olarak kaydedilir (not ile ayrışır).
 */
export async function refundOnCancel(
  tx: Prisma.TransactionClient,
  order: RefundableOrder,
  newStatus: OrderStatus,
): Promise<boolean> {
  if (
    newStatus !== OrderStatus.CANCELLED ||
    order.paymentMethod !== PaymentMethod.BALANCE ||
    order.paymentStatus !== PaymentStatus.PAID
  ) {
    return false;
  }

  const amount = new Prisma.Decimal(order.total);
  const u = await tx.user.update({
    where: { id: order.userId },
    data: { balance: { increment: amount } },
    select: { balance: true },
  });
  await tx.creditLedger.create({
    data: {
      userId: order.userId,
      delta: amount,
      balanceAfter: u.balance,
      reason: `Sipariş iptali iadesi (${order.orderNumber})`,
    },
  });
  await tx.transaction.create({
    data: {
      userId: order.userId,
      type: TransactionType.BALANCE_LOAD,
      amount,
      status: TransactionStatus.SUCCESS,
      method: PaymentMethod.BALANCE,
      orderId: order.id,
      note: `Sipariş iptali iadesi (${order.orderNumber})`,
    },
  });
  return true;
}
