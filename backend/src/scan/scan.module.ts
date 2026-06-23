import {
  Module,
  Injectable,
  Controller,
  Post,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersModule } from '../orders/orders.module';
import { OrdersService } from '../orders/orders.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class ScanDto {
  // Etiketteki Code128 = sipariş numarası
  @IsString() @MinLength(1) code: string;
  // İstasyon: production | ready | ship (eşanlamlılar desteklenir)
  @IsString() @MinLength(1) station: string;
}

// İstasyon → hedef sipariş durumu
const STATION_STATUS: Record<string, OrderStatus> = {
  production: OrderStatus.IN_PRODUCTION,
  print: OrderStatus.IN_PRODUCTION,
  baski: OrderStatus.IN_PRODUCTION,
  cut: OrderStatus.IN_PRODUCTION,
  kesim: OrderStatus.IN_PRODUCTION,
  ready: OrderStatus.READY,
  pack: OrderStatus.READY,
  paketleme: OrderStatus.READY,
  ship: OrderStatus.SHIPPED,
  shipped: OrderStatus.SHIPPED,
  kargo: OrderStatus.SHIPPED,
};

@Injectable()
export class ScanService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
  ) {}

  async scan(user: AuthUser, dto: ScanDto) {
    const target = STATION_STATUS[dto.station.trim().toLowerCase()];
    if (!target) {
      throw new BadRequestException(
        `Geçersiz istasyon: ${dto.station} (geçerli: production|ready|ship)`,
      );
    }
    const order = await this.prisma.order.findFirst({
      where: { orderNumber: dto.code.trim() },
    });
    if (!order) {
      throw new NotFoundException(`Sipariş bulunamadı: ${dto.code}`);
    }
    // İdempotans: zaten hedef durumdaysa tekrar geçiş yapma
    if (order.status === target) {
      return {
        ok: true,
        idempotent: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: target,
      };
    }
    // State-machine geçişi + audit + (iptalse) iade — OrdersService üzerinden
    const updated = await this.orders.updateStatus(
      user,
      order.id,
      target,
      `QR okutma (${dto.station})`,
    );
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      from: order.status,
      status: updated.status,
    };
  }
}

@Controller('scan')
export class ScanController {
  constructor(private readonly scan: ScanService) {}

  // Üretim ekibi etiketteki barkodu okutur (order:updateStatus izni = PRODUCTION/ADMIN)
  @RequirePermission('order:updateStatus')
  @Post()
  do(@CurrentUser() user: AuthUser, @Body() dto: ScanDto) {
    return this.scan.scan(user, dto);
  }
}

@Module({
  imports: [OrdersModule],
  providers: [ScanService],
  controllers: [ScanController],
})
export class ScanModule {}
