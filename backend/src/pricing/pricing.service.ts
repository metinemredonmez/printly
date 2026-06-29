import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ProductUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipsService } from '../memberships/memberships.module';
import { SettingsService } from '../settings/settings.module';

const SQFT_PER_SQIN = 1 / 144; // inch² → ft²
const SQM_PER_SQFT = 0.092903; // ft² → m²
const INCH_TO_CM = 2.54;
const DISCOUNT_RATE = 0.4; // %40

const dec = (v: Prisma.Decimal | number | null | undefined): number =>
  v == null ? 0 : Number(v);
const round = (v: number, d: number): number => {
  const f = Math.pow(10, d);
  return Math.round((v + Number.EPSILON) * f) / f;
};

export interface ItemInput {
  productId: string;
  widthInch: number;
  heightInch: number;
  quantity: number;
}

export interface ItemPrice {
  productId: string;
  widthInch: number;
  heightInch: number;
  widthCm: number;
  heightCm: number;
  sqft: number;
  sqm: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ExtraInput {
  extraOptionId: string;
  quantity?: number;
}

export interface OrderQuote {
  items: ItemPrice[];
  extras: { extraOptionId: string; name: string; price: number; quantity: number; lineTotal: number }[];
  subtotal: number;
  extrasTotal: number;
  discount40: number;
  shipping: number;
  total: number;
  totalSqm: number;
  multiplier: number;
  hasDiscount40: boolean;
  discountRate: number;
}

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private memberships: MembershipsService,
    private settings: SettingsService,
  ) {}

  // PDF bakiye indirim kademesi: MEVCUT bakiyeye göre oran (100→%20, 200→%30, 300+→%40).
  // Bakiye 0'a inince indirim biter (tier(0)=0). Ekip Üyesi avantajı ayrıca 1× fiyat çarpanı.
  async effectiveDiscountRate(balanceUsd: number): Promise<number> {
    if (!balanceUsd || balanceUsd <= 0) return 0;
    const tiers = await this.settings.get<{ minLoad: number; rate: number }[]>(
      'loadDiscountTiers',
    );
    return (
      [...(tiers ?? [])]
        .sort((a, b) => b.minLoad - a.minLoad)
        .find((x) => balanceUsd >= x.minLoad)?.rate ?? 0
    );
  }

  // Tek kalem fiyatı. multiplier: USER=2, TEAM_*=1.
  async computeItem(input: ItemInput, multiplier: number): Promise<ItemPrice> {
    if (input.quantity <= 0) {
      throw new BadRequestException('Adet 0’dan büyük olmalı');
    }
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product || !product.active) {
      throw new NotFoundException('Ürün bulunamadı veya pasif');
    }

    const sqft = round(input.widthInch * input.heightInch * SQFT_PER_SQIN, 4);
    const sqm = round(sqft * SQM_PER_SQFT, 4);
    const widthCm = round(input.widthInch * INCH_TO_CM, 2);
    const heightCm = round(input.heightInch * INCH_TO_CM, 2);

    let unitPrice: number;
    if (product.unit === ProductUnit.M2) {
      if (input.widthInch <= 0 || input.heightInch <= 0) {
        throw new BadRequestException('m² ürünlerde genişlik/yükseklik gerekli');
      }
      unitPrice = round(sqm * dec(product.basePricePerM2) * multiplier, 2);
    } else {
      // FLAT (Wall Decal / Wood): sabit fiyat × çarpan, ölçüden bağımsız
      unitPrice = round(dec(product.flatPrice) * multiplier, 2);
    }

    return {
      productId: product.id,
      widthInch: input.widthInch,
      heightInch: input.heightInch,
      widthCm,
      heightCm,
      sqft,
      sqm,
      quantity: input.quantity,
      unitPrice,
      lineTotal: round(unitPrice * input.quantity, 2),
    };
  }

  // Tüm sipariş: kalemler + extra'lar + %40 indirim.
  async quoteOrder(
    items: ItemInput[],
    extras: ExtraInput[],
    multiplier: number,
    discountRate: number,
  ): Promise<OrderQuote> {
    if (!items.length) throw new BadRequestException('En az bir kalem gerekli');

    const pricedItems = await Promise.all(
      items.map((i) => this.computeItem(i, multiplier)),
    );

    const pricedExtras = await Promise.all(
      (extras ?? []).map(async (e) => {
        const opt = await this.prisma.extraOption.findUnique({
          where: { id: e.extraOptionId },
        });
        if (!opt || !opt.active) {
          throw new NotFoundException('Ek seçenek bulunamadı');
        }
        const qty = e.quantity && e.quantity > 0 ? e.quantity : 1;
        const price = dec(opt.price);
        return {
          extraOptionId: opt.id,
          name: opt.name,
          price,
          quantity: qty,
          lineTotal: round(price * qty, 2),
        };
      }),
    );

    const subtotal = round(
      pricedItems.reduce((s, i) => s + i.lineTotal, 0),
      2,
    );
    const extrasTotal = round(
      pricedExtras.reduce((s, e) => s + e.lineTotal, 0),
      2,
    );
    const base = round(subtotal + extrasTotal, 2);
    // İndirim oranı: 0 (yok) veya kademe oranı (Standart .40 / Pro .45 / Elit .50)
    const discount40 = discountRate > 0 ? round(base * discountRate, 2) : 0;
    // Kargo: admin'in belirlediği sabit ücret (indirim SONRASI eklenir, indirimsiz)
    const shipCfg = await this.settings.get<{ defaultFlatCost?: number }>('shipping');
    const shipping = round(Number(shipCfg?.defaultFlatCost ?? 0), 2);
    const total = round(base - discount40 + shipping, 2);
    const totalSqm = round(
      pricedItems.reduce((s, i) => s + i.sqm * i.quantity, 0),
      4,
    );

    return {
      items: pricedItems,
      extras: pricedExtras,
      subtotal,
      extrasTotal,
      discount40,
      shipping,
      total,
      totalSqm,
      multiplier,
      hasDiscount40: discountRate > 0,
      discountRate,
    };
  }
}
