import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMaterialDto,
  UpdateMaterialDto,
  CreateProductDto,
  UpdateProductDto,
  CreateExtraOptionDto,
} from './dto';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  // ── Materials ──────────────────────────────
  listMaterials(onlyActive = true) {
    return this.prisma.material.findMany({
      where: onlyActive ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  createMaterial(dto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: { ...dto, settings: dto.settings as Prisma.InputJsonValue },
    });
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto) {
    await this.ensure('material', id);
    return this.prisma.material.update({
      where: { id },
      data: { ...dto, settings: dto.settings as Prisma.InputJsonValue },
    });
  }

  // ── Products ───────────────────────────────
  listProducts(onlyActive = true) {
    return this.prisma.product.findMany({
      where: onlyActive ? { active: true } : undefined,
      include: { material: true },
      orderBy: { name: 'asc' },
    });
  }

  async getProduct(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { material: true },
    });
    if (!p) throw new NotFoundException('Ürün bulunamadı');
    return p;
  }

  createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: { ...dto, subTypes: dto.subTypes as Prisma.InputJsonValue },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.getProduct(id);
    return this.prisma.product.update({
      where: { id },
      data: { ...dto, subTypes: dto.subTypes as Prisma.InputJsonValue },
    });
  }

  // ── Extra options ──────────────────────────
  listExtras(onlyActive = true) {
    return this.prisma.extraOption.findMany({
      where: onlyActive ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  createExtra(dto: CreateExtraOptionDto) {
    return this.prisma.extraOption.create({ data: dto });
  }

  async deleteExtra(id: string) {
    await this.ensure('extraOption', id);
    return this.prisma.extraOption.update({
      where: { id },
      data: { active: false },
    });
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
