import {
  Module,
  Injectable,
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pdfSafe } from '../common/pdf.util';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

type Branding = {
  brandName?: string;
  returnAddress?: string;
  packingMessage?: string;
};

@Injectable()
export class WhitelabelService {
  constructor(private prisma: PrismaService) {}

  private async branding(organizationId?: string | null): Promise<Branding> {
    if (!organizationId) return {};
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) return {};
    const theme = (org.theme as Record<string, unknown>) ?? {};
    return {
      brandName: (theme.brandName as string) ?? org.name,
      returnAddress: theme.returnAddress as string,
      packingMessage: theme.packingMessage as string,
    };
  }

  // Genel (public) markalı sipariş takibi — PII içermez, id token gibi davranır (#38)
  async track(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        statusEvents: {
          orderBy: { createdAt: 'asc' },
          select: { toStatus: true, createdAt: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const brand = await this.branding(order.organizationId);
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.createdAt,
      brand: brand.brandName ?? 'Ortak Doku',
      // Kargo/takip (manuel atanmışsa müşteriye gösterilir)
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt,
      estimatedDelivery: order.estimatedDeliveryAt,
      deliveredAt: order.deliveredAt,
      timeline: order.statusEvents.map((e) => ({
        status: e.toStatus,
        at: e.createdAt,
      })),
    };
  }

  // Bayi-markalı packing slip PDF (#38)
  async packingSlip(orderId: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, extras: true },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const brand = await this.branding(order.organizationId);

    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const M = 50;
    let y = 800;
    const t = (s: string, size: number, f = font, x = M, color = rgb(0, 0, 0)) => {
      page.drawText(pdfSafe(s), { x, y, size, font: f, color });
    };

    t(brand.brandName ?? 'Ortak Doku', 20, bold);
    y -= 18;
    t('PACKING SLIP / İRSALİYE', 11, font, M, rgb(0.4, 0.4, 0.4));
    y -= 30;
    t(`Sipariş No: ${order.orderNumber}`, 12, bold);
    y -= 18;
    t(`Tarih: ${order.createdAt.toISOString().slice(0, 10)}`, 10);
    y -= 28;

    t('Teslimat:', 11, bold);
    y -= 16;
    for (const line of [
      order.clientName,
      order.clientAddress,
      [order.clientCity, order.clientState, order.clientZip].filter(Boolean).join(', '),
      order.clientCountry,
    ].filter(Boolean)) {
      t(String(line), 10);
      y -= 14;
    }
    y -= 16;

    t('İçerik:', 11, bold);
    y -= 16;
    for (const item of order.items) {
      t(
        `• ${item.product?.name ?? 'Ürün'} — ${item.widthInch}×${item.heightInch} inç × ${item.quantity}`,
        10,
      );
      y -= 14;
    }
    for (const ex of order.extras) {
      t(`• Ek: ${ex.name} × ${ex.quantity}`, 10);
      y -= 14;
    }
    y -= 20;

    if (brand.packingMessage) {
      t(brand.packingMessage, 10, font, M, rgb(0.2, 0.2, 0.2));
      y -= 20;
    }
    if (brand.returnAddress) {
      t('İade Adresi:', 9, bold);
      y -= 13;
      t(brand.returnAddress, 9, font, M, rgb(0.4, 0.4, 0.4));
    }

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}

@Controller()
export class WhitelabelController {
  constructor(private readonly svc: WhitelabelService) {}

  // Public markalı takip (id unguessable cuid → token gibi)
  @Public()
  @Get('track/:orderId')
  track(@Param('orderId') orderId: string) {
    return this.svc.track(orderId);
  }

  @Roles(Role.ADMIN, Role.PRODUCTION)
  @Get('orders/:id/packing-slip')
  async packingSlip(@Param('id') id: string, @Res() res: Response) {
    const buf = await this.svc.packingSlip(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="packing-${id}.pdf"`,
      'Content-Length': String(buf.length),
    });
    res.end(buf);
  }
}

@Module({
  providers: [WhitelabelService],
  controllers: [WhitelabelController],
})
export class WhitelabelModule {}
