import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma, ProductUnit, ProductCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMaterialDto,
  UpdateMaterialDto,
  CreateProductDto,
  UpdateProductDto,
  CreateExtraOptionDto,
} from './dto';

const TTL = 300_000; // 5 dk
const K = { materials: 'catalog:materials', products: 'catalog:products', extras: 'catalog:extras' };

@Injectable()
export class CatalogService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const val = await fn();
    await this.cache.set(key, val, TTL);
    return val;
  }

  // ── Materials ──────────────────────────────
  listMaterials(onlyActive = true) {
    if (!onlyActive) {
      return this.prisma.material.findMany({ orderBy: { name: 'asc' } });
    }
    return this.cached(K.materials, () =>
      this.prisma.material.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    );
  }

  async createMaterial(dto: CreateMaterialDto) {
    const m = await this.prisma.material.create({
      data: { ...dto, settings: dto.settings as Prisma.InputJsonValue },
    });
    await this.cache.del(K.materials);
    return m;
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto) {
    await this.ensure('material', id);
    const m = await this.prisma.material.update({
      where: { id },
      data: { ...dto, settings: dto.settings as Prisma.InputJsonValue },
    });
    await this.cache.del(K.materials);
    return m;
  }

  // ── Products ───────────────────────────────
  listProducts(onlyActive = true) {
    if (!onlyActive) {
      return this.prisma.product.findMany({ include: { material: true }, orderBy: { name: 'asc' } });
    }
    return this.cached(K.products, () =>
      this.prisma.product.findMany({
        where: { active: true },
        include: { material: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  // includeInactive=false (varsayılan, tüketici uçları): pasif ürün 404 (L1).
  // Admin işlemleri (update/silme) includeInactive=true ile pasif ürünü de görebilir.
  async getProduct(id: string, includeInactive = false) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { material: true },
    });
    if (!p || (!includeInactive && !p.active)) {
      throw new NotFoundException('Ürün bulunamadı');
    }
    return p;
  }

  // Kategori → beklenen birim (WALLPAPER=m², diğerleri=flat) — M5
  private expectedUnit(category: ProductCategory): ProductUnit {
    return category === ProductCategory.WALLPAPER ? ProductUnit.M2 : ProductUnit.FLAT;
  }

  // unit verildiyse kategoriyle uyumlu olmalı (tutarsız fiyat dalı önlenir — M5)
  private assertCategoryUnit(category: ProductCategory | undefined, unit?: ProductUnit | null) {
    if (category && unit && unit !== this.expectedUnit(category)) {
      throw new BadRequestException(
        `${category} ürünü için birim ${this.expectedUnit(category)} olmalı (verilen: ${unit})`,
      );
    }
  }

  // Fiyatsız ürün (quote $0) engelleme — H3.
  private assertPricing(unit: ProductUnit | undefined | null, m2?: number, flat?: number) {
    const hasM2 = (m2 ?? 0) > 0;
    const hasFlat = (flat ?? 0) > 0;
    if (unit === ProductUnit.M2 && !hasM2) {
      throw new BadRequestException('M2 ürün için basePricePerM2 > 0 olmalı');
    }
    if (unit === ProductUnit.FLAT && !hasFlat) {
      throw new BadRequestException('FLAT ürün için flatPrice > 0 olmalı');
    }
    if (!unit && !hasM2 && !hasFlat) {
      throw new BadRequestException('Ürün için fiyat (basePricePerM2 veya flatPrice) gerekli');
    }
  }

  async createProduct(dto: CreateProductDto) {
    this.assertCategoryUnit(dto.category, dto.unit);
    this.assertPricing(dto.unit, dto.basePricePerM2, dto.flatPrice);
    const p = await this.prisma.product.create({
      data: { ...dto, subTypes: dto.subTypes as Prisma.InputJsonValue },
    });
    await this.cache.del(K.products);
    return p;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const existing = await this.getProduct(id, true); // admin: pasif ürünü de güncelleyebilir
    // Birleştirilmiş değerlerle kategori-birim + fiyat tutarlılığı (M5/H3)
    this.assertCategoryUnit(dto.category ?? existing.category, dto.unit ?? existing.unit);
    this.assertPricing(
      dto.unit ?? existing.unit,
      dto.basePricePerM2 ?? Number(existing.basePricePerM2 ?? 0),
      dto.flatPrice ?? Number(existing.flatPrice ?? 0),
    );
    const p = await this.prisma.product.update({
      where: { id },
      data: { ...dto, subTypes: dto.subTypes as Prisma.InputJsonValue },
    });
    await this.cache.del(K.products);
    return p;
  }

  // ── Extra options ──────────────────────────
  listExtras(onlyActive = true) {
    if (!onlyActive) {
      return this.prisma.extraOption.findMany({ orderBy: { name: 'asc' } });
    }
    return this.cached(K.extras, () =>
      this.prisma.extraOption.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    );
  }

  async createExtra(dto: CreateExtraOptionDto) {
    const e = await this.prisma.extraOption.create({ data: dto });
    await this.cache.del(K.extras);
    return e;
  }

  async deleteExtra(id: string) {
    await this.ensure('extraOption', id);
    const e = await this.prisma.extraOption.update({
      where: { id },
      data: { active: false },
    });
    await this.cache.del(K.extras);
    return e;
  }

  private async ensure(model: 'material' | 'extraOption', id: string) {
    const found =
      model === 'material'
        ? await this.prisma.material.findUnique({ where: { id } })
        : await this.prisma.extraOption.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Kayıt bulunamadı');
    return found;
  }
}
