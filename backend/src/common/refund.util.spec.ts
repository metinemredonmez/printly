import { refundOnCancel } from './refund.util';

// K3: iptal edilen BALANCE+PAID siparişte atomik bakiye iadesi mantığı.
describe('refundOnCancel — sipariş iptali iadesi', () => {
  const baseOrder: any = {
    id: 'o1',
    userId: 'u1',
    orderNumber: 'OD-1',
    total: 18,
    paymentMethod: 'BALANCE',
    paymentStatus: 'PAID',
  };

  it('koşul sağlanmazsa iade YAPMAZ (false döner)', async () => {
    const tx: any = {};
    // CANCELLED değil
    expect(await refundOnCancel(tx, baseOrder, 'READY' as any)).toBe(false);
    // PAID değil
    expect(
      await refundOnCancel(tx, { ...baseOrder, paymentStatus: 'PENDING' }, 'CANCELLED' as any),
    ).toBe(false);
    // BALANCE değil (kart)
    expect(
      await refundOnCancel(tx, { ...baseOrder, paymentMethod: 'CARD' }, 'CANCELLED' as any),
    ).toBe(false);
  });

  it('koşul sağlanırsa bakiye iadesi + ledger + transaction oluşturur', async () => {
    const calls = { userUpdate: 0, ledger: 0, txn: 0 };
    const tx: any = {
      user: {
        update: () => {
          calls.userUpdate++;
          return Promise.resolve({ balance: 100 });
        },
      },
      creditLedger: {
        create: () => {
          calls.ledger++;
          return Promise.resolve({});
        },
      },
      transaction: {
        create: () => {
          calls.txn++;
          return Promise.resolve({});
        },
      },
    };
    const res = await refundOnCancel(tx, baseOrder, 'CANCELLED' as any);
    expect(res).toBe(true);
    expect(calls.userUpdate).toBe(1); // bakiye artırıldı
    expect(calls.ledger).toBe(1); // ters ledger
    expect(calls.txn).toBe(1); // iade transaction
  });
});
