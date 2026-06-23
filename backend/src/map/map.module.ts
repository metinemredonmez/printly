import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';

@Injectable()
export class MapService {
  constructor(private prisma: PrismaService) {}

  // Haritada gösterilecek aktif siparişler (koordinatı olanlar)
  async activeOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        archivedAt: null,
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.SHIPPED] },
        clientLat: { not: null },
        clientLng: { not: null },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        clientName: true,
        clientCity: true,
        clientCountry: true,
        clientLat: true,
        clientLng: true,
        total: true,
        createdAt: true,
      },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });
    return { count: orders.length, orders };
  }

  // Canlı aktivite akışı (son audit olayları)
  async activity(take = 50) {
    const events = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 200),
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorUserId: true,
        createdAt: true,
      },
    });
    return { count: events.length, events };
  }

  // Tek sipariş adresini geocode et (Nominatim/OSM — key gerektirmez, best-effort)
  async geocodeOrder(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const parts = [
      order.clientAddress,
      order.clientCity,
      order.clientState,
      order.clientZip,
      order.clientCountry,
    ].filter(Boolean);
    if (parts.length === 0) {
      return { geocoded: false, reason: 'Adres bilgisi yok' };
    }
    const q = encodeURIComponent(parts.join(', '));
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
        { headers: { 'User-Agent': 'OrtakDoku/1.0 (ortakdoku.com)' } },
      );
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!data.length) return { geocoded: false, reason: 'Sonuç yok' };
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      await this.prisma.order.update({
        where: { id },
        data: { clientLat: lat, clientLng: lng },
      });
      return { geocoded: true, lat, lng };
    } catch {
      return { geocoded: false, reason: 'Geocode servisine ulaşılamadı' };
    }
  }
}

@Controller('map')
export class MapController {
  constructor(private readonly map: MapService) {}

  @Roles(Role.ADMIN, Role.PRODUCTION)
  @Get('active-orders')
  active() {
    return this.map.activeOrders();
  }

  @Roles(Role.ADMIN, Role.PRODUCTION)
  @Get('activity')
  activity() {
    return this.map.activity();
  }

  @Roles(Role.ADMIN)
  @Post('geocode/:orderId')
  geocode(@Param('orderId') orderId: string) {
    return this.map.geocodeOrder(orderId);
  }
}

@Module({
  providers: [MapService],
  controllers: [MapController],
})
export class MapModule {}
