import 'server-only';

// Backend public landing endpoint'i (auth gerektirmez). Server-side çekilir.
const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:3001/api';

export type ProductCategoryKey = 'WALLPAPER' | 'WALL_DECAL' | 'WOOD';

export type LandingProduct = {
  id: string;
  name: string;
  category: ProductCategoryKey;
  unit: 'M2' | 'FLAT';
  description: string | null;
  imageUrl: string | null;
  basePricePerM2: number | null;
  flatPrice: number | null;
  materialWidthInch: number | null;
  subTypes: unknown;
};

export type LandingCategory = {
  key: ProductCategoryKey;
  unit: string;
  count: number;
  minPrice: number | null;
};

export type LandingTier = {
  tier: string;
  name: string;
  nameEn: string;
  badge: string;
  badgeEn: string;
  monthlyFee: number;
  multiplier: number;
  highlight: boolean;
};

export type FeatureRow = {
  label: string;
  labelEn: string;
  user: boolean | string;
  member: boolean | string;
  leader: boolean | string;
};

export type Bilingual = { label: string; labelEn: string };
export type Faq = { q: string; a: string; qEn: string; aEn: string };
export type Stat = { value: string; label: string; labelEn: string };
export type Integration = { name: string; status: 'connected' | 'soon' };

export type LandingData = {
  currency: string;
  constants: { discountRate: number; bulkLoadForDiscount: number; membershipFee: number };
  products: LandingProduct[];
  categories: LandingCategory[];
  tiers: LandingTier[];
  featureMatrix: FeatureRow[];
  content: { stats: Stat[]; trustBadges: Bilingual[]; faqs: Faq[]; integrations: Integration[] };
};

// Backend kapalı/erişilemezse null → bileşenler kendi varsayılanına düşer (dayanıklı).
export async function getLandingData(): Promise<LandingData | null> {
  try {
    const res = await fetch(`${BACKEND}/public/landing`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as LandingData;
  } catch {
    return null;
  }
}
