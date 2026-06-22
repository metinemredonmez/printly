import { Module, Injectable, Controller, Get, Post, Delete, Body, Param, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { EtsyStore } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, safeDecrypt } from '../common/crypto.util';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class CreateStoreDto {
  @IsString() name: string;
  @IsOptional() @IsString() apiKey?: string;
}

// apiKey'i asla ham döndürme — maskele.
function mask(s: EtsyStore) {
  return {
    id: s.id,
    name: s.name,
    hasApiKey: !!s.apiKey,
    createdAt: s.createdAt,
  };
}

@Injectable()
export class EtsyStoresService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const stores = await this.prisma.etsyStore.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return stores.map(mask);
  }

  async create(userId: string, dto: CreateStoreDto) {
    const store = await this.prisma.etsyStore.create({
      data: { name: dto.name, apiKey: dto.apiKey ? encrypt(dto.apiKey) : null, userId },
    });
    return mask(store);
  }

  // Sunucu-içi kullanım (Faz 2 Etsy API): çözülmüş apiKey
  async getApiKey(id: string): Promise<string | null> {
    const s = await this.prisma.etsyStore.findUnique({ where: { id } });
    return safeDecrypt(s?.apiKey);
  }

  async remove(userId: string, id: string) {
    const store = await this.prisma.etsyStore.findUnique({ where: { id } });
    if (!store || store.userId !== userId) {
      throw new NotFoundException('Mağaza bulunamadı');
    }
    // Silinen kaydı ham döndürme — apiKey ciphertext + userId sızmasın (M4)
    const deleted = await this.prisma.etsyStore.delete({ where: { id } });
    return mask(deleted);
  }
}

@Controller('etsy-stores')
export class EtsyStoresController {
  constructor(private readonly stores: EtsyStoresService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.stores.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStoreDto) {
    return this.stores.create(user.userId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stores.remove(user.userId, id);
  }
}

@Module({
  providers: [EtsyStoresService],
  controllers: [EtsyStoresController],
})
export class EtsyStoresModule {}
