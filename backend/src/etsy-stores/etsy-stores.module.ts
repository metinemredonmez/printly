import { Module, Injectable, Controller, Get, Post, Delete, Body, Param, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class CreateStoreDto {
  @IsString() name: string;
  @IsOptional() @IsString() apiKey?: string;
}

@Injectable()
export class EtsyStoresService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.etsyStore.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, dto: CreateStoreDto) {
    return this.prisma.etsyStore.create({ data: { ...dto, userId } });
  }

  async remove(userId: string, id: string) {
    const store = await this.prisma.etsyStore.findUnique({ where: { id } });
    if (!store || store.userId !== userId) {
      throw new NotFoundException('Mağaza bulunamadı');
    }
    return this.prisma.etsyStore.delete({ where: { id } });
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
