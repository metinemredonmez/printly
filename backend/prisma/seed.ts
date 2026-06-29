import {
  PrismaClient,
  Role,
  ProductCategory,
  ProductUnit,
  CourseCategory,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function user(
  id: string,
  email: string,
  password: string,
  fullName: string,
  role: Role,
  balance = 0,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      id,
      email,
      passwordHash,
      fullName,
      role,
      priceMultiplier: role === Role.USER ? 2 : 1,
      isEmailVerified: true,
      balance,
    },
  });
}

async function main() {
  // ── Kullanıcılar (mockup seed'iyle uyumlu) ─────────────
  await user('seed-admin', 'admin@ortakdoku.com', 'admin', 'Yönetici (Admin)', Role.ADMIN, 1000);
  const hakan = await user('seed-lider-hakan', 'lider.hakan@ortakdoku.com', 'lider123', 'Hakan Demir', Role.TEAM_LEADER);
  await user('seed-lider-elif', 'lider.elif@ortakdoku.com', 'lider123', 'Elif Şahin', Role.TEAM_LEADER);

  // Liderler için membership
  for (const uid of ['seed-lider-hakan', 'seed-lider-elif']) {
    await prisma.membership.upsert({
      where: { userId: uid },
      update: {},
      create: { userId: uid, tier: Role.TEAM_LEADER, monthlyFee: 0 },
    });
  }

  // ── Materyaller ────────────────────────────────────────
  const matte = await prisma.material.upsert({
    where: { id: 'seed-mat-matte' },
    update: {},
    create: { id: 'seed-mat-matte', name: 'Matte Wallpaper 24"', widthInch: 24, settings: { overlapInch: 1, bleedInch: 0.125 } },
  });
  await prisma.material.upsert({
    where: { id: 'seed-mat-textured' },
    update: {},
    create: { id: 'seed-mat-textured', name: 'Textured Wallpaper 26"', widthInch: 26, settings: { overlapInch: 1, bleedInch: 0.125 } },
  });

  // ── Ürünler (mockup fiyatları, 1× — USER 2×'i çarpanla alır) ──
  await prisma.product.upsert({
    where: { id: 'seed-prod-wallpaper' },
    update: {},
    create: {
      id: 'seed-prod-wallpaper',
      name: 'Wallpaper',
      category: ProductCategory.WALLPAPER,
      unit: ProductUnit.M2,
      basePricePerM2: 23.0,
      materialId: matte.id,
      subTypes: [
        { key: 'smooth', label: 'Peel & Stick Smooth' },
        { key: 'canvas', label: 'Peel & Stick Canvas/Textile' },
        { key: 'traditional', label: 'Traditional' },
      ],
    },
  });
  await prisma.product.upsert({
    where: { id: 'seed-prod-decal' },
    update: {},
    create: {
      id: 'seed-prod-decal',
      name: 'Wall Decal',
      category: ProductCategory.WALL_DECAL,
      unit: ProductUnit.FLAT,
      flatPrice: 15.0,
    },
  });
  await prisma.product.upsert({
    where: { id: 'seed-prod-wood' },
    update: {},
    create: {
      id: 'seed-prod-wood',
      name: 'Wood (CNC)',
      category: ProductCategory.WOOD,
      unit: ProductUnit.FLAT,
      flatPrice: 35.0,
    },
  });

  // ── Ek seçenekler ──────────────────────────────────────
  await prisma.extraOption.upsert({
    where: { code: 'SHIPPING_BOX' },
    update: {},
    create: { code: 'SHIPPING_BOX', name: 'Shipping Box (Koli)', price: 2.5 },
  });
  await prisma.extraOption.upsert({
    where: { code: 'INSTALLATION_KIT' },
    update: {},
    create: { code: 'INSTALLATION_KIT', name: 'Installation Kit (Montaj Kiti)', price: 3.0 },
  });
  await prisma.extraOption.upsert({
    where: { code: 'SAMPLE' },
    update: {},
    create: { code: 'SAMPLE', name: 'Sample (Numune 20"×15")', price: 2.5, fixedWidthInch: 20, fixedHeightInch: 15 },
  });

  // ── Eğitimler (PDF: Ekip Üyesi %50) ────────────────────
  const courses: {
    id: string;
    title: string;
    titleEn: string;
    summary: string;
    category: CourseCategory;
    level: string;
    price: number;
    durationMin: number;
    lessonCount: number;
    sortOrder: number;
  }[] = [
    {
      id: 'seed-course-platform',
      title: 'Ortak Doku Platform Eğitimi',
      titleEn: 'Ortak Doku Platform Onboarding',
      summary:
        'Sipariş sihirbazı, dosya yükleme ve operasyon akışını uçtan uca öğren.',
      category: CourseCategory.PLATFORM,
      level: 'Başlangıç',
      price: 0,
      durationMin: 90,
      lessonCount: 8,
      sortOrder: 1,
    },
    {
      id: 'seed-course-ads',
      title: 'Dijital Reklam Yönetimi',
      titleEn: 'Digital Advertising Management',
      summary:
        'Etsy Ads ve Meta reklamlarıyla ABD pazarında dönüşüm odaklı kampanyalar kur.',
      category: CourseCategory.DIGITAL_ADS,
      level: 'Orta',
      price: 60,
      durationMin: 180,
      lessonCount: 12,
      sortOrder: 2,
    },
    {
      id: 'seed-course-social',
      title: 'Sosyal Medya Yönetimi',
      titleEn: 'Social Media Management',
      summary:
        'Marka hesabını büyüt, içerik takvimi ve organik trafik stratejileri.',
      category: CourseCategory.SOCIAL_MEDIA,
      level: 'Başlangıç',
      price: 45,
      durationMin: 150,
      lessonCount: 10,
      sortOrder: 3,
    },
    {
      id: 'seed-course-finance',
      title: 'Ticaret ve Finans',
      titleEn: 'Trade & Finance',
      summary:
        'Maliyet, kâr marjı, nakit akışı ve vergi temelleriyle sürdürülebilir büyüme.',
      category: CourseCategory.TRADE_FINANCE,
      level: 'İleri',
      price: 80,
      durationMin: 210,
      lessonCount: 14,
      sortOrder: 4,
    },
  ];
  for (const c of courses) {
    await prisma.course.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, contentUrl: 'https://ortakdoku.com/egitim', active: true },
    });
  }

  // ── Etkinlikler (PDF: seminer/workshop, Ekip Üyesi %50) ──
  const day = 24 * 60 * 60 * 1000;
  const events: {
    id: string;
    title: string;
    titleEn: string;
    description: string;
    type: string;
    startsAt: Date;
    isOnline: boolean;
    location: string;
    capacity: number;
    price: number;
  }[] = [
    {
      id: 'seed-event-webinar',
      title: 'Etsy’de İlk 90 Gün — Canlı Webinar',
      titleEn: 'First 90 Days on Etsy — Live Webinar',
      description:
        'Yeni başlayan satıcılar için mağaza kurulumu, listeleme ve ilk satış stratejileri.',
      type: 'webinar',
      startsAt: new Date(Date.now() + 7 * day),
      isOnline: true,
      location: 'Zoom (link kayıt sonrası)',
      capacity: 100,
      price: 0,
    },
    {
      id: 'seed-event-workshop',
      title: 'Ürün Fotoğrafçılığı Workshop',
      titleEn: 'Product Photography Workshop',
      description:
        'Duvar kağıdı ve decal görsellerini dönüşüm artıracak şekilde hazırlama atölyesi.',
      type: 'workshop',
      startsAt: new Date(Date.now() + 14 * day),
      isOnline: true,
      location: 'Online atölye',
      capacity: 40,
      price: 25,
    },
    {
      id: 'seed-event-meetup',
      title: 'Ortak Doku Bayi Buluşması',
      titleEn: 'Ortak Doku Dealer Meetup',
      description: 'Networking, deneyim paylaşımı ve yeni dönem yol haritası.',
      type: 'buluşma',
      startsAt: new Date(Date.now() + 30 * day),
      isOnline: false,
      location: 'İstanbul',
      capacity: 60,
      price: 15,
    },
  ];
  for (const e of events) {
    await prisma.event.upsert({
      where: { id: e.id },
      update: {},
      create: { ...e, active: true },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed tamam.');
  // eslint-disable-next-line no-console
  console.log('  Admin : admin@ortakdoku.com / admin');
  // eslint-disable-next-line no-console
  console.log('  Lider : lider.hakan@ortakdoku.com / lider123  (id: ' + hakan.id + ')');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
