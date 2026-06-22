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
import * as bwipjs from 'bwip-js';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pdfSafe } from '../common/pdf.util';
import { Roles } from '../common/decorators/roles.decorator';

@Injectable()
export class LabelsService {
  constructor(private prisma: PrismaService) {}

  // 4x6 inç (288x432pt) kargo etiketi + Code128 barkod
  async shippingLabel(orderId: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { fullName: true, email: true } },
        _count: { select: { items: true } },
      },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');

    const doc = await PDFDocument.create();
    const page = doc.addPage([288, 432]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 288;
    const M = 16;
    let y = 432 - 24;

    const text = (s: string, size: number, f = font, x = M) => {
      page.drawText(pdfSafe(s), { x, y, size, font: f, color: rgb(0, 0, 0) });
      y -= size + 6;
    };
    const line = () => {
      page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 1, color: rgb(0, 0, 0) });
      y -= 10;
    };

    text('ORTAK DOKU', 16, bold);
    text(`Siparis: ${order.orderNumber}`, 11, bold);
    if (order.etsyOrderNo) text(`Etsy: ${order.etsyOrderNo}`, 9);
    line();

    // Barkod (Code128)
    const png = await (bwipjs as any).toBuffer({
      bcid: 'code128',
      text: order.orderNumber,
      scale: 2,
      height: 12,
      includetext: true,
      textxalign: 'center',
    });
    const img = await doc.embedPng(png);
    const bw = W - 2 * M;
    const bh = (img.height / img.width) * bw;
    y -= bh;
    page.drawImage(img, { x: M, y, width: bw, height: bh });
    y -= 12;
    line();

    text('KIME:', 10, bold);
    text(order.clientName || '-', 11);
    if (order.clientAddress) {
      // adresi ~38 karakterde böl
      for (const chunk of (order.clientAddress.match(/.{1,38}/g) ?? [])) text(chunk, 9);
    }
    const loc = [order.clientCity, order.clientState, order.clientZip].filter(Boolean).join(', ');
    if (loc) text(loc, 9);
    if (order.clientCountry) text(order.clientCountry, 9, bold);
    if (order.clientPhone) text(`Tel: ${order.clientPhone}`, 9);
    line();

    text(`Bayi: ${order.user?.fullName || order.user?.email || '-'}`, 9);
    text(`Kategori: ${order.category}  •  Kalem: ${order._count.items}  •  ${Number(order.totalSqm)} m2`, 9);
    text(`Durum: ${order.status}`, 9);

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}

@Controller('labels')
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Roles(Role.ADMIN, Role.PRODUCTION)
  @Get('order/:id')
  async order(@Param('id') id: string, @Res() res: Response) {
    const buf = await this.labels.shippingLabel(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="label-${id}.pdf"`,
      'Content-Length': String(buf.length),
    });
    res.end(buf);
  }
}

@Module({
  providers: [LabelsService],
  controllers: [LabelsController],
})
export class LabelsModule {}
