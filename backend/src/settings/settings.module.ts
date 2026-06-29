import {
  Global,
  Module,
  Injectable,
  Controller,
  Get,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { IsDefined } from 'class-validator';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class SetSettingDto {
  // value zorunlu (eksikse Prisma 500 + kaynak yolu sızıntısı yerine net 400 — M2)
  @IsDefined() value: unknown;
}

// Varsayılan ayarlar (DB'de yoksa bunlar döner)
export const DEFAULT_SETTINGS: Record<string, unknown> = {
  activePaymentProvider: 'QUICKBOOKS', // QUICKBOOKS | STRIPE
  paymentProvidersEnabled: { QUICKBOOKS: true, STRIPE: false },
  features: { aiChatbox: false, virtualTryOn: false, kanban: true, push: false },
  membershipFee: 30,
  bulkLoadForDiscount: 250,
  // PDF bakiye indirim kademesi — MEVCUT bakiyeye göre; bakiye bitince indirim biter
  loadDiscountTiers: [
    { minLoad: 100, rate: 0.2 },
    { minLoad: 200, rate: 0.3 },
    { minLoad: 300, rate: 0.4 },
  ],
  discountRate: 0.4,
  demoOtpCode: '123456', // SMTP/e-posta yokken sabit demo doğrulama kodu; gerçek mail gelince admin boşaltır (kapanır)
  sampleFee: 5, // numune sipariş sabit ücreti (D2/#41)
  // Kademeli bayi planı (D1/#40): kümülatif yüklemeye göre indirim + öncelikli üretim
  membershipTiers: [
    { name: 'Standart', minLoad: 0, discountRate: 0.4, priority: false },
    { name: 'Pro', minLoad: 2500, discountRate: 0.45, priority: true },
    { name: 'Elit', minLoad: 10000, discountRate: 0.5, priority: true },
  ],
  // ── Landing / pazarlama içeriği (admin düzenleyebilir → PUT /api/settings/:key) ──
  'landing.tierFeatures': [
    { label: 'Fiyat çarpanı', labelEn: 'Price multiplier', user: '2×', member: '1×', leader: '1×' },
    { label: 'Aylık aidat', labelEn: 'Monthly fee', user: '—', member: '$30', leader: '—' },
    { label: 'Bakiye yükle → %20–40 indirim', labelEn: 'Load balance → 20–40% off', user: true, member: true, leader: true },
    { label: 'Etsy mağaza bağlama', labelEn: 'Connect Etsy stores', user: true, member: true, leader: true },
    { label: 'Canlı m² fiyatlandırma', labelEn: 'Live m² pricing', user: true, member: true, leader: true },
    { label: 'Güvenli dosya yükleme (R2)', labelEn: 'Secure file upload (R2)', user: true, member: true, leader: true },
    { label: 'Öncelikli destek', labelEn: 'Priority support', user: false, member: true, leader: true },
    { label: 'Öncelikli üretim kuyruğu', labelEn: 'Priority production queue', user: false, member: true, leader: true },
    { label: 'Hacim indirimi', labelEn: 'Volume discount', user: false, member: true, leader: true },
    { label: 'Ekip yönetimi (üye davet)', labelEn: 'Team management', user: false, member: false, leader: true },
  ],
  'landing.stats': [
    { value: '3', label: 'Ürün kategorisi', labelEn: 'Product categories' },
    { value: '%40', label: 'Bayi indirimi', labelEn: 'Dealer discount' },
    { value: '7/24', label: 'Sipariş takibi', labelEn: 'Order tracking' },
    { value: 'ABD', label: 'Hedef pazar', labelEn: 'Target market' },
  ],
  'landing.trustBadges': [
    { label: 'Etsy entegre', labelEn: 'Etsy integrated' },
    { label: 'R2 güvenli depolama', labelEn: 'R2 secure storage' },
    { label: 'ABD’ye kargo', labelEn: 'Ships to US' },
    { label: 'TIFF/DPI doğrulama', labelEn: 'TIFF/DPI validation' },
    { label: 'Dijital proof onayı', labelEn: 'Digital proof approval' },
  ],
  'landing.faqs': [
    { q: 'Ortak Doku nedir?', a: 'Bayilerin Etsy mağazalarında ABD pazarına duvar kağıdı, wall decal ve ahşap/CNC ürünleri sattığı bir B2B print-on-demand üretim ve operasyon altyapısıdır.', qEn: 'What is Ortak Doku?', aEn: 'A B2B print-on-demand production & operations platform where resellers sell wallpaper, wall decals and wood/CNC products to the US market via their Etsy stores.' },
    { q: 'Nasıl başlarım?', a: 'Başvuru formunu doldur, üyelik planını seç, Etsy mağazanı bağla ve ilk siparişini ver.', qEn: 'How do I start?', aEn: 'Fill the application, pick a membership plan, connect your Etsy store and place your first order.' },
    { q: 'Fiyatlandırma nasıl çalışır?', a: 'Duvar kağıdı m² bazlı, decal ve ahşap sabit fiyatlıdır. Ekip üyeleri 1× (yarı) fiyat öder; bakiyene $100/$200/$300 yükleyince %20/%30/%40 indirim açılır (bakiye bitince indirim biter).', qEn: 'How does pricing work?', aEn: 'Wallpaper is priced per m², decals and wood are flat-priced. Team members pay 1× (half) price; loading $100/$200/$300 unlocks 20%/30%/40% off (ends when balance is used up).' },
    { q: 'Baskı dosyası gereksinimleri neler?', a: 'Yüklenen dosyalar ürünün gerektirdiği minimum DPI ve formatı (TIFF/PDF) karşılamalıdır; sistem otomatik doğrular.', qEn: 'What are the print file requirements?', aEn: 'Uploaded files must meet the product’s minimum DPI and format (TIFF/PDF); the system validates automatically.' },
    { q: 'Siparişi nasıl takip ederim?', a: 'Her sipariş üretim aşamalarında durum güncellemesi alır; markalı takip sayfasından kargo durumunu görebilirsin.', qEn: 'How do I track an order?', aEn: 'Every order gets status updates through production stages; you can follow shipping on a branded tracking page.' },
    { q: 'Ödemeler nasıl yapılır?', a: 'Cüzdanına bakiye yükler, siparişlerde bu bakiyeden düşersin. Toplu yükleme indirim kademelerini açar.', qEn: 'How are payments handled?', aEn: 'You load balance into your wallet and orders are deducted from it. Bulk loading unlocks discount tiers.' },
    { q: 'Teslimat ne kadar sürer?', a: 'Üretim genellikle 2–5 iş günüdür; ABD içi kargo taşıyıcıya göre 3–7 iş günü sürer. Her aşamada durum güncellemesi alırsın.', qEn: 'How long does delivery take?', aEn: 'Production is typically 2–5 business days; domestic US shipping takes 3–7 business days depending on the carrier. You get status updates at every stage.' },
    { q: 'Hangi ülkelere kargo yapılıyor?', a: 'Öncelikli pazar ABD’dir; siparişler bayinin Etsy mağazasından ABD adreslerine gönderilir. Diğer pazarlar yol haritasındadır.', qEn: 'Which countries do you ship to?', aEn: 'The primary market is the US; orders ship to US addresses from the reseller’s Etsy store. Other markets are on the roadmap.' },
    { q: 'Sipariş iptal veya iade nasıl olur?', a: 'Üretime girmeden iptal edilen bakiye siparişlerinde tutar otomatik cüzdana iade edilir. Üretim sonrası kusurlu işlerde yeniden baskı veya iade değerlendirilir.', qEn: 'How do cancellations and refunds work?', aEn: 'Balance orders cancelled before production are auto-refunded to your wallet. For defective items after production, a reprint or refund is evaluated.' },
  ],
  'landing.integrations': [
    { name: 'Etsy', status: 'soon' },
    { name: 'QuickBooks', status: 'soon' },
    { name: 'Stripe', status: 'soon' },
    { name: 'Cloudflare R2', status: 'connected' },
  ],
  requireProductionApproval: true, // H2/#33
  // Kargo: taşıyıcı listesi + standart süre + takip URL şablonları (admin düzenler).
  // Gerçek carrier API (anlık rate/etiket) anahtarla gelir; şimdilik manuel takip no.
  shipping: {
    carriers: ['UPS', 'FedEx', 'USPS', 'DHL'],
    estimatedShippingDays: 5,
    defaultFlatCost: 0,
    trackingUrlTemplates: {
      UPS: 'https://www.ups.com/track?tracknum={n}',
      FedEx: 'https://www.fedex.com/fedextrack/?trknbr={n}',
      USPS: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={n}',
      DHL: 'https://www.dhl.com/us-en/home/tracking.html?tracking-id={n}',
    },
  },
};

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async get<T = unknown>(key: string, fallback?: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (row) return row.value as T;
    return (fallback ?? (DEFAULT_SETTINGS[key] as T));
  }

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.setting.findMany();
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) merged[r.key] = r.value;
    return merged;
  }

  async set(key: string, value: unknown, actor?: AuthUser) {
    const row = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    // Hassas anahtar değerlerini audit meta'sına ham yazma (secret/key/token/pass...)
    const isSensitive = /secret|key|token|password|pass|credential/i.test(key);
    await this.audit.log({
      actorUserId: actor?.userId,
      actorRole: actor?.role,
      action: 'SETTING_UPDATE',
      entityType: 'Setting',
      entityId: key,
      meta: { value: isSensitive ? '***' : value },
    });
    return row;
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Roles(Role.ADMIN)
  @Get()
  getAll() {
    return this.settings.getAll();
  }

  @Roles(Role.ADMIN)
  @Get(':key')
  async getOne(@Param('key') key: string) {
    return { key, value: await this.settings.get(key) };
  }

  @Roles(Role.ADMIN)
  @Put(':key')
  set(
    @Param('key') key: string,
    @Body() dto: SetSettingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settings.set(key, dto.value, user);
  }
}

@Global()
@Module({
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
