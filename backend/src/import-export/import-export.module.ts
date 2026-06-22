import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import * as Papa from 'papaparse';
import { ProductCategory, ProductUnit, Role, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class ImportExportService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── EXPORT (xlsx) ──────────────────────────
  private async toXlsx(
    sheet: string,
    columns: Partial<ExcelJS.Column>[],
    rows: Record<string, unknown>[],
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheet);
    ws.columns = columns;
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  async ordersXlsx(): Promise<Buffer> {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, fullName: true } }, _count: { select: { items: true } } },
    });
    return this.toXlsx(
      'Orders',
      [
        { header: 'Sipariş No', key: 'orderNumber', width: 26 },
        { header: 'Tarih', key: 'createdAt', width: 22 },
        { header: 'Bayi', key: 'dealer', width: 28 },
        { header: 'Kategori', key: 'category', width: 14 },
        { header: 'Durum', key: 'status', width: 16 },
        { header: 'Ödeme', key: 'paymentStatus', width: 12 },
        { header: 'Yöntem', key: 'paymentMethod', width: 10 },
        { header: 'Kalem', key: 'items', width: 8 },
        { header: 'm²', key: 'totalSqm', width: 10 },
        { header: 'Toplam $', key: 'total', width: 12 },
      ],
      orders.map((o) => ({
        orderNumber: o.orderNumber,
        createdAt: o.createdAt.toISOString(),
        dealer: o.user?.fullName || o.user?.email,
        category: o.category,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        items: o._count.items,
        totalSqm: Number(o.totalSqm),
        total: Number(o.total),
      })),
    );
  }

  async usersXlsx(): Promise<Buffer> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { orders: true } } },
    });
    return this.toXlsx(
      'Users',
      [
        { header: 'E-posta', key: 'email', width: 32 },
        { header: 'Ad', key: 'fullName', width: 24 },
        { header: 'Rol', key: 'role', width: 14 },
        { header: 'Bakiye $', key: 'balance', width: 12 },
        { header: '%40', key: 'hasDiscount40', width: 8 },
        { header: 'Sipariş', key: 'orders', width: 10 },
        { header: 'Doğrulı', key: 'verified', width: 10 },
        { header: 'Kayıt', key: 'createdAt', width: 22 },
      ],
      users.map((u) => ({
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        balance: Number(u.balance),
        hasDiscount40: u.hasDiscount40 ? 'Evet' : '',
        orders: u._count.orders,
        verified: u.isEmailVerified ? 'Evet' : '',
        createdAt: u.createdAt.toISOString(),
      })),
    );
  }

  async transactionsXlsx(): Promise<Buffer> {
    const txns = await this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    });
    return this.toXlsx(
      'Transactions',
      [
        { header: 'Tarih', key: 'createdAt', width: 22 },
        { header: 'Kullanıcı', key: 'user', width: 30 },
        { header: 'Tip', key: 'type', width: 18 },
        { header: 'Tutar $', key: 'amount', width: 12 },
        { header: 'Yöntem', key: 'method', width: 10 },
        { header: 'Durum', key: 'status', width: 10 },
        { header: 'Sipariş', key: 'orderId', width: 26 },
      ],
      txns.map((t) => ({
        createdAt: t.createdAt.toISOString(),
        user: t.user?.email,
        type: t.type,
        amount: Number(t.amount),
        method: t.method,
        status: t.status,
        orderId: t.orderId,
      })),
    );
  }

  // ── IMPORT (products CSV) ──────────────────
  async importProductsCsv(actor: AuthUser, csv: string) {
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length) {
      throw new BadRequestException(`CSV ayrıştırma hatası: ${parsed.errors[0].message}`);
    }

    let created = 0;
    let updated = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      try {
        const name = (row.name || '').trim();
        const category = (row.category || '').trim().toUpperCase() as ProductCategory;
        const unit = ((row.unit || 'M2').trim().toUpperCase() as ProductUnit) || ProductUnit.M2;
        if (!name) throw new Error('name zorunlu');
        if (!Object.values(ProductCategory).includes(category)) {
          throw new Error(`geçersiz category: ${row.category}`);
        }
        const data = {
          name,
          category,
          unit,
          description: row.description?.trim() || undefined,
          basePricePerM2: row.basePricePerM2 ? new Prisma.Decimal(row.basePricePerM2) : undefined,
          flatPrice: row.flatPrice ? new Prisma.Decimal(row.flatPrice) : undefined,
          materialId: row.materialId?.trim() || undefined,
          active: row.active ? !/^(false|0|hayır|no)$/i.test(row.active.trim()) : undefined,
        };

        if (row.id?.trim()) {
          const existing = await this.prisma.product.findUnique({ where: { id: row.id.trim() } });
          if (existing) {
            await this.prisma.product.update({ where: { id: row.id.trim() }, data });
            updated++;
            continue;
          }
        }
        await this.prisma.product.create({ data });
        created++;
      } catch (e: any) {
        errors.push({ row: i + 2, message: e?.message ?? 'bilinmeyen hata' }); // +2: başlık + 1-index
      }
    }

    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'IMPORT_PRODUCTS',
      entityType: 'Product',
      meta: { created, updated, errorCount: errors.length },
    });
    return { created, updated, errors, total: parsed.data.length };
  }
}

@Controller()
export class ImportExportController {
  constructor(private readonly svc: ImportExportService) {}

  private send(res: Response, buf: Buffer, filename: string) {
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
    });
    res.end(buf);
  }

  @Roles(Role.ADMIN)
  @Get('export/orders.xlsx')
  async exportOrders(@Res() res: Response) {
    this.send(res, await this.svc.ordersXlsx(), 'orders.xlsx');
  }

  @Roles(Role.ADMIN)
  @Get('export/users.xlsx')
  async exportUsers(@Res() res: Response) {
    this.send(res, await this.svc.usersXlsx(), 'users.xlsx');
  }

  @Roles(Role.ADMIN)
  @Get('export/transactions.xlsx')
  async exportTransactions(@Res() res: Response) {
    this.send(res, await this.svc.transactionsXlsx(), 'transactions.xlsx');
  }

  @Roles(Role.ADMIN)
  @Post('import/products')
  @UseInterceptors(FileInterceptor('file'))
  async importProducts(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('CSV dosyası gerekli (form-data: file)');
    return this.svc.importProductsCsv(user, file.buffer.toString('utf8'));
  }
}

@Module({
  providers: [ImportExportService],
  controllers: [ImportExportController],
})
export class ImportExportModule {}
