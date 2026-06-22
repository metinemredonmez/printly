import {
  Module,
  Injectable,
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pdfSafe } from '../common/pdf.util';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

const money = (n: number) => `$${n.toFixed(2)}`;

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async invoicePdf(authUser: AuthUser, orderId: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { name: true } } } },
        extras: true,
        user: { select: { fullName: true, email: true, billingInfo: true } },
      },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const isStaff = authUser.role === Role.ADMIN || authUser.role === Role.PRODUCTION;
    if (!isStaff && order.userId !== authUser.userId) {
      throw new ForbiddenException('Bu faturaya erişiminiz yok');
    }

    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const M = 40;
    let y = 842 - M;
    const t = (s: string, size: number, f = font, x = M, color = rgb(0, 0, 0)) =>
      page.drawText(pdfSafe(s), { x, y, size, font: f, color });

    // Başlık
    t('ORTAK DOKU', 20, bold);
    t('FATURA / INVOICE', 12, bold, 430);
    y -= 26;
    t(`Sipariş No: ${order.orderNumber}`, 10, font, 430);
    y -= 14;
    t(`Tarih: ${order.createdAt.toISOString().slice(0, 10)}`, 10, font, 430);
    y -= 24;

    // Fatura bilgisi (BillingInfo varsa)
    const b = order.user?.billingInfo;
    t('FATURA EDİLEN:', 10, bold);
    y -= 14;
    t(b?.companyTitle || order.user?.fullName || order.user?.email || '-', 11);
    y -= 14;
    if (b) {
      const taxLine = b.country === 'TR'
        ? (b.taxNo ? `Vergi No: ${b.taxNo} (${b.taxOffice ?? ''})` : b.tc ? `TC: ${b.tc}` : '')
        : (b.ein ? `EIN: ${b.ein} (${b.state ?? ''})` : b.ssn ? `SSN/ITIN: ${b.ssn}` : '');
      if (b.address) { t(b.address.slice(0, 80), 9); y -= 12; }
      if (taxLine) { t(taxLine, 9); y -= 12; }
    }
    y -= 12;

    // Tablo başlığı
    const cols = { name: M, size: 250, sqm: 330, qty: 380, unit: 430, total: 510 };
    page.drawRectangle({ x: M, y: y - 4, width: 595 - 2 * M, height: 18, color: rgb(0.93, 0.93, 0.93) });
    t('Ürün', 9, bold, cols.name);
    t('Ölçü(inç)', 9, bold, cols.size);
    t('m²', 9, bold, cols.sqm);
    t('Adet', 9, bold, cols.qty);
    t('Birim', 9, bold, cols.unit);
    t('Tutar', 9, bold, cols.total);
    y -= 22;

    for (const it of order.items) {
      t((it.product?.name ?? '-').slice(0, 28), 9, font, cols.name);
      t(`${Number(it.widthInch)}x${Number(it.heightInch)}`, 9, font, cols.size);
      t(String(Number(it.sqm)), 9, font, cols.sqm);
      t(String(it.quantity), 9, font, cols.qty);
      t(money(Number(it.unitPrice)), 9, font, cols.unit);
      t(money(Number(it.lineTotal)), 9, font, cols.total);
      y -= 16;
    }
    for (const ex of order.extras) {
      t(`+ ${ex.name}`.slice(0, 28), 9, font, cols.name);
      t(String(ex.quantity), 9, font, cols.qty);
      t(money(Number(ex.price) * ex.quantity), 9, font, cols.total);
      y -= 16;
    }

    y -= 6;
    page.drawLine({ start: { x: 330, y: y + 6 }, end: { x: 595 - M, y: y + 6 }, thickness: 1 });
    y -= 8;
    const totalLine = (label: string, val: string, b2 = false) => {
      t(label, 10, b2 ? bold : font, 380);
      t(val, 10, b2 ? bold : font, cols.total);
      y -= 16;
    };
    totalLine('Ara toplam', money(Number(order.subtotal)));
    if (Number(order.extrasTotal) > 0) totalLine('Ek seçenekler', money(Number(order.extrasTotal)));
    if (Number(order.discount40) > 0) totalLine('%40 indirim', `-${money(Number(order.discount40))}`);
    totalLine('TOPLAM', money(Number(order.total)), true);

    y -= 16;
    t(`Ödeme: ${order.paymentMethod} • Durum: ${order.paymentStatus}`, 9, font);
    y -= 24;
    t('Not: Resmi e-fatura QuickBooks üzerinden iletilir (Faz 2). Bu belge bilgilendirme amaçlıdır.', 8, font, M, rgb(0.4, 0.4, 0.4));

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get('order/:id')
  async order(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buf = await this.invoices.invoicePdf(user, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
      'Content-Length': String(buf.length),
    });
    res.end(buf);
  }
}

@Module({
  providers: [InvoicesService],
  controllers: [InvoicesController],
})
export class InvoicesModule {}
