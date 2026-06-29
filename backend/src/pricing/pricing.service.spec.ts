import { PricingService } from './pricing.service';

// Fiyat motoru — en kritik para mantığı (inç→m², rol çarpanı, %40 indirim).
// PrismaService mock'lanır; saf hesap doğrulanır.
describe('PricingService — fiyat motoru', () => {
  const make = (products: Record<string, any>, extras: Record<string, any> = {}) => {
    const prisma: any = {
      product: {
        findUnique: ({ where }: any) => Promise.resolve(products[where.id] ?? null),
      },
      extraOption: {
        findUnique: ({ where }: any) => Promise.resolve(extras[where.id] ?? null),
      },
    };
    // settings.get → undefined (kargo defaultFlatCost yok → shipping 0)
    const settings: any = { get: async () => undefined };
    return new PricingService(prisma, {} as any, settings);
  };

  it('M2 ürün: 12×12 inç → 1 sqft → 0.0929 m² × $23 × USER(2×) ≈ $4.27', async () => {
    const svc = make({
      p1: { id: 'p1', active: true, unit: 'M2', basePricePerM2: 23, flatPrice: null },
    });
    const r = await svc.computeItem(
      { productId: 'p1', widthInch: 12, heightInch: 12, quantity: 1 },
      2,
    );
    expect(r.sqft).toBeCloseTo(1, 4);
    expect(r.sqm).toBeCloseTo(0.0929, 3);
    expect(r.unitPrice).toBeCloseTo(4.27, 2);
  });

  it('FLAT ürün: ölçüden bağımsız sabit fiyat × çarpan', async () => {
    const svc = make({
      p2: { id: 'p2', active: true, unit: 'FLAT', basePricePerM2: null, flatPrice: 15 },
    });
    const r = await svc.computeItem(
      { productId: 'p2', widthInch: 99, heightInch: 99, quantity: 2 },
      1,
    );
    expect(r.unitPrice).toBe(15);
    expect(r.lineTotal).toBe(30);
  });

  it('USER (2×) tam olarak TEAM (1×) fiyatının iki katı', async () => {
    const svc = make({
      p3: { id: 'p3', active: true, unit: 'FLAT', flatPrice: 35 },
    });
    const user = await svc.computeItem(
      { productId: 'p3', widthInch: 1, heightInch: 1, quantity: 1 },
      2,
    );
    const team = await svc.computeItem(
      { productId: 'p3', widthInch: 1, heightInch: 1, quantity: 1 },
      1,
    );
    expect(user.unitPrice).toBe(team.unitPrice * 2);
  });

  it('pasif / olmayan ürün hata fırlatır', async () => {
    const svc = make({ px: { id: 'px', active: false, unit: 'FLAT', flatPrice: 10 } });
    await expect(
      svc.computeItem({ productId: 'px', widthInch: 1, heightInch: 1, quantity: 1 }, 1),
    ).rejects.toThrow();
    await expect(
      svc.computeItem({ productId: 'yok', widthInch: 1, heightInch: 1, quantity: 1 }, 1),
    ).rejects.toThrow();
  });

  it('adet 0 hata fırlatır', async () => {
    const svc = make({ p4: { id: 'p4', active: true, unit: 'FLAT', flatPrice: 35 } });
    await expect(
      svc.computeItem({ productId: 'p4', widthInch: 1, heightInch: 1, quantity: 0 }, 1),
    ).rejects.toThrow();
  });

  it('quoteOrder: %40 indirim (subtotal+extras) üzerinden uygulanır', async () => {
    const svc = make(
      { p5: { id: 'p5', active: true, unit: 'FLAT', flatPrice: 100 } },
      { e1: { id: 'e1', active: true, name: 'Kutu', price: 2.5 } },
    );
    const q = await svc.quoteOrder(
      [{ productId: 'p5', widthInch: 1, heightInch: 1, quantity: 1 }],
      [{ extraOptionId: 'e1', quantity: 2 }],
      1,
      0.4, // %40 indirim oranı
    );
    expect(q.subtotal).toBe(100);
    expect(q.extrasTotal).toBe(5); // 2.5 × 2
    expect(q.discount40).toBeCloseTo(42, 2); // (100+5)*0.4
    expect(q.total).toBeCloseTo(63, 2); // 105 - 42
  });

  it('quoteOrder: indirim kapalıyken toplam = base', async () => {
    const svc = make({ p6: { id: 'p6', active: true, unit: 'FLAT', flatPrice: 35 } });
    const q = await svc.quoteOrder(
      [{ productId: 'p6', widthInch: 1, heightInch: 1, quantity: 3 }],
      [],
      2, // USER
      0, // indirim yok
    );
    expect(q.subtotal).toBe(210); // 35*2*3
    expect(q.discount40).toBe(0);
    expect(q.total).toBe(210);
  });

  it('quoteOrder: boş kalem listesi hata', async () => {
    const svc = make({});
    await expect(svc.quoteOrder([], [], 1, 0)).rejects.toThrow();
  });

  it('quoteOrder: kademe oranı (Pro %45) base üzerinden uygulanır', async () => {
    const svc = make({ p7: { id: 'p7', active: true, unit: 'FLAT', flatPrice: 100 } });
    const q = await svc.quoteOrder(
      [{ productId: 'p7', widthInch: 1, heightInch: 1, quantity: 1 }],
      [],
      1,
      0.45,
    );
    expect(q.discount40).toBeCloseTo(45, 2);
    expect(q.total).toBeCloseTo(55, 2);
    expect(q.discountRate).toBe(0.45);
    expect(q.hasDiscount40).toBe(true);
  });

  it('quoteOrder: kargo ücreti indirim SONRASI eklenir (base 100, %45, +10 kargo → 65)', async () => {
    const prisma: any = {
      product: {
        findUnique: () =>
          Promise.resolve({ id: 'ps', active: true, unit: 'FLAT', flatPrice: 100 }),
      },
      extraOption: { findUnique: () => Promise.resolve(null) },
    };
    const settings: any = { get: async (k: string) => (k === 'shipping' ? { defaultFlatCost: 10 } : undefined) };
    const svc = new PricingService(prisma, {} as any, settings);
    const q = await svc.quoteOrder(
      [{ productId: 'ps', widthInch: 1, heightInch: 1, quantity: 1 }],
      [],
      1,
      0.45,
    );
    expect(q.discount40).toBeCloseTo(45, 2); // 100 * .45
    expect(q.shipping).toBeCloseTo(10, 2);
    expect(q.total).toBeCloseTo(65, 2); // 100 - 45 + 10
  });

  it('effectiveDiscountRate: bakiye kademesi (0→0, 150→.2, 250→.3, 300→.4)', async () => {
    const settings: any = {
      get: async () => [
        { minLoad: 100, rate: 0.2 },
        { minLoad: 200, rate: 0.3 },
        { minLoad: 300, rate: 0.4 },
      ],
    };
    const svc = new PricingService({} as any, {} as any, settings);
    expect(await svc.effectiveDiscountRate(0)).toBe(0);
    expect(await svc.effectiveDiscountRate(150)).toBe(0.2);
    expect(await svc.effectiveDiscountRate(250)).toBe(0.3);
    expect(await svc.effectiveDiscountRate(300)).toBe(0.4);
  });
});
