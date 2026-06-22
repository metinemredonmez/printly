import {
  PrismaClient,
  Role,
  ProductCategory,
  ProductUnit,
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
