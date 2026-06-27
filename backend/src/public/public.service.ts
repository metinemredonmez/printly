import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma, Role, ProductCategory, ProductUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.module';
import {
  multiplierForRole,
  MEMBERSHIP_FEE,
  BULK_LOAD_FOR_DISCOUNT,
} from '../common/pricing.util';

const num = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v == null ? null : Number(v);

// Auth gerektirmeyen landing/pazarlama verisi — tek çağrı.
@Injectable()
export class PublicService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // Canlı döviz kuru (USD bazlı) — ücretsiz/key'siz ECB (frankfurter), 1 saat cache, hata→boş.
  async ticker() {
    const KEY = 'public:ticker';
    const hit = await this.cache.get(KEY);
    if (hit) return hit;
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP', {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error('fx');
      const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
      const r = data.rates ?? {};
      const out = {
        base: 'USD',
        date: data.date ?? null,
        rates: [
          { pair: 'USD/TRY', value: r.TRY ?? null },
          { pair: 'USD/EUR', value: r.EUR ?? null },
          { pair: 'USD/GBP', value: r.GBP ?? null },
        ].filter((x) => x.value != null),
      };
      await this.cache.set(KEY, out, 3_600_000); // 1 saat
      return out;
    } catch {
      return { base: 'USD', date: null, rates: [] as { pair: string; value: number }[] };
    }
  }

  async landing() {
    const [rawProducts, discountRate, featureMatrix, stats, trustBadges, faqs, integrations] =
      await Promise.all([
        this.prisma.product.findMany({
          where: { active: true },
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
            description: true,
            basePricePerM2: true,
            flatPrice: true,
            imageUrl: true,
            subTypes: true,
            material: { select: { name: true, widthInch: true } },
          },
          orderBy: { name: 'asc' },
        }),
        this.settings.get<number>('discountRate'),
        this.settings.get('landing.tierFeatures'),
        this.settings.get('landing.stats'),
        this.settings.get('landing.trustBadges'),
        this.settings.get('landing.faqs'),
        this.settings.get('landing.integrations'),
      ]);

    const products = rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      description: p.description,
      imageUrl: p.imageUrl,
      basePricePerM2: num(p.basePricePerM2),
      flatPrice: num(p.flatPrice),
      materialWidthInch: p.material?.widthInch ?? null,
      subTypes: p.subTypes ?? null,
    }));

    // Vitrin için kategori özetleri (en düşük 1× fiyat + ürün sayısı)
    const categories = [
      ProductCategory.WALLPAPER,
      ProductCategory.WALL_DECAL,
      ProductCategory.WOOD,
    ].map((cat) => {
      const items = products.filter((p) => p.category === cat);
      const prices = items
        .map((p) => (p.unit === ProductUnit.M2 ? p.basePricePerM2 : p.flatPrice))
        .filter((x): x is number => x != null && x > 0);
      return {
        key: cat,
        unit: cat === ProductCategory.WALLPAPER ? 'M2' : 'FLAT',
        count: items.length,
        minPrice: prices.length ? Math.min(...prices) : null,
      };
    });

    // Üyelik kademeleri — fiyat çarpanı/aidat canonical sabitlerden türetilir.
    const tiers = [
      {
        tier: Role.USER,
        name: 'Kullanıcı',
        nameEn: 'User',
        badge: 'Ücretsiz',
        badgeEn: 'Free',
        monthlyFee: 0,
        multiplier: multiplierForRole(Role.USER),
        highlight: false,
      },
      {
        tier: Role.TEAM_MEMBER,
        name: 'Ekip Üyesi',
        nameEn: 'Team Member',
        badge: 'Tavsiye',
        badgeEn: 'Recommended',
        monthlyFee: MEMBERSHIP_FEE,
        multiplier: multiplierForRole(Role.TEAM_MEMBER),
        highlight: true,
      },
      {
        tier: Role.TEAM_LEADER,
        name: 'Ekip Lideri',
        nameEn: 'Team Leader',
        badge: 'Aidatsız',
        badgeEn: 'No fee',
        monthlyFee: 0,
        multiplier: multiplierForRole(Role.TEAM_LEADER),
        highlight: false,
      },
    ];

    return {
      currency: 'USD',
      constants: {
        discountRate,
        bulkLoadForDiscount: BULK_LOAD_FOR_DISCOUNT,
        membershipFee: MEMBERSHIP_FEE,
      },
      products,
      categories,
      tiers,
      featureMatrix,
      content: { stats, trustBadges, faqs, integrations },
    };
  }
}
