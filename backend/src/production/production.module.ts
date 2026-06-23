import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsEnum } from 'class-validator';
import {
  Role,
  ProductCategory,
  ProductionStation,
  ProductionJobStatus,
  TransactionType,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { SettingsService } from '../settings/settings.module';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

type Tier = { name: string; minLoad: number; priority: boolean };

// Kategori → üretim istasyonu (O5/#39)
const STATION_BY_CATEGORY: Record<ProductCategory, ProductionStation> = {
  WALLPAPER: ProductionStation.PRINT,
  WOOD: ProductionStation.CNC,
  WALL_DECAL: ProductionStation.CUT,
};

class UpdateJobDto {
  @IsEnum(ProductionJobStatus) status: ProductionJobStatus;
}

@Injectable()
export class ProductionService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private settings: SettingsService,
  ) {}

  // Bayinin planına göre öncelik (D1/#40)
  private async ownerPriority(userId: string): Promise<boolean> {
    const loads = await this.prisma.transaction.aggregate({
      where: {
        userId,
        type: TransactionType.BALANCE_LOAD,
        status: TransactionStatus.SUCCESS,
      },
      _sum: { amount: true },
    });
    const total = Number(loads._sum.amount ?? 0);
    const tiers = await this.settings.get<Tier[]>('membershipTiers', []);
    const tier = [...tiers]
      .sort((a, b) => b.minLoad - a.minLoad)
      .find((t) => total >= t.minLoad);
    return tier?.priority ?? false;
  }

  // Siparişi istasyon kuyruklarına yönlendir — kalemlerin kategorisine göre job üret
  async route(user: AuthUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');

    const existing = await this.prisma.productionJob.count({ where: { orderId } });
    if (existing > 0) {
      throw new BadRequestException('Bu sipariş zaten üretim kuyruğuna alınmış');
    }

    // Kalem kategorilerinden benzersiz istasyonlar + paketleme
    const stations = new Set<ProductionStation>();
    for (const item of order.items) {
      const cat = item.product?.category;
      if (cat && STATION_BY_CATEGORY[cat]) stations.add(STATION_BY_CATEGORY[cat]);
    }
    stations.add(ProductionStation.PACK);

    const priority = await this.ownerPriority(order.userId);
    const jobs = await this.prisma.$transaction(
      [...stations].map((station) =>
        this.prisma.productionJob.create({ data: { orderId, station, priority } }),
      ),
    );
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'PRODUCTION_ROUTE',
      entityType: 'Order',
      entityId: orderId,
      meta: { stations: [...stations] },
    });
    return { routed: jobs.length, stations: [...stations], jobs };
  }

  // İstasyon kuyruğu (aktif işler)
  queue(station?: ProductionStation) {
    return this.prisma.productionJob.findMany({
      where: {
        station,
        status: { in: [ProductionJobStatus.QUEUED, ProductionJobStatus.IN_PROGRESS] },
      },
      // Öncelikli bayiler önce (D1/#40), sonra FIFO
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 300,
    });
  }

  async updateJob(user: AuthUser, id: string, status: ProductionJobStatus) {
    const job = await this.prisma.productionJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('İş bulunamadı');
    const updated = await this.prisma.productionJob.update({
      where: { id },
      data: { status },
    });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'PRODUCTION_JOB_UPDATE',
      entityType: 'ProductionJob',
      entityId: id,
      meta: { status },
    });
    return updated;
  }
}

@Controller('production')
export class ProductionController {
  constructor(private readonly svc: ProductionService) {}

  @Roles(Role.ADMIN, Role.PRODUCTION)
  @Post('route/:orderId')
  route(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.svc.route(user, orderId);
  }

  @Roles(Role.ADMIN, Role.PRODUCTION)
  @Get('queue')
  queue(@Query('station') station?: ProductionStation) {
    return this.svc.queue(station);
  }

  @Roles(Role.ADMIN, Role.PRODUCTION)
  @Patch('jobs/:id')
  updateJob(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.svc.updateJob(user, id, dto.status);
  }
}

@Module({
  providers: [ProductionService],
  controllers: [ProductionController],
})
export class ProductionModule {}
