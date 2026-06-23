import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { safeDecrypt } from '../common/crypto.util';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class DeleteConfirmDto {
  @IsBoolean() confirm: boolean;
}

@Injectable()
export class GdprService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // KVKK/GDPR: kullanıcının tüm verisini tek pakette dışa aktar
  async export(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const [orders, transactions, ledger, billing, tickets, documents, devices, membership] =
      await Promise.all([
        this.prisma.order.findMany({ where: { userId } }),
        this.prisma.transaction.findMany({ where: { userId } }),
        this.prisma.creditLedger.findMany({ where: { userId } }),
        this.prisma.billingInfo.findUnique({ where: { userId } }),
        this.prisma.ticket.findMany({
          where: { userId },
          include: { messages: true },
        }),
        this.prisma.document.findMany({ where: { uploadedByUserId: userId } }),
        this.prisma.userDevice.findMany({ where: { userId } }),
        this.prisma.membership.findUnique({ where: { userId } }),
      ]);

    // Sahibine kendi verisi: billing PII düz metin (veri taşınabilirliği hakkı)
    const billingPlain = billing
      ? {
          ...billing,
          tc: billing.tc ? safeDecrypt(billing.tc) : null,
          ssn: billing.ssn ? safeDecrypt(billing.ssn) : null,
          ein: billing.ein ? safeDecrypt(billing.ein) : null,
          taxNo: billing.taxNo ? safeDecrypt(billing.taxNo) : null,
        }
      : null;

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        balance: user.balance,
        createdAt: user.createdAt,
      },
      membership,
      billing: billingPlain,
      orders,
      transactions,
      creditLedger: ledger,
      tickets,
      documents,
      devices,
    };
  }

  // KVKK/GDPR: silme talebi → PII anonimleştirilir, finansal kayıtlar (muhasebe
  // yükümlülüğü) anonim kullanıcıya bağlı kalır. Hesap pasifleştirilir.
  async deleteAccount(actor: AuthUser, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    if (user.role === Role.ADMIN) {
      throw new BadRequestException('Admin hesabı bu uçtan silinemez');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@anonymized.local`,
          fullName: 'Silinmiş Kullanıcı',
          phone: null,
          active: false,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorRecoveryCodes: [],
        },
      }),
      this.prisma.billingInfo.deleteMany({ where: { userId } }),
      this.prisma.userDevice.deleteMany({ where: { userId } }),
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.etsyStore.deleteMany({ where: { userId } }),
    ]);

    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'GDPR_DELETE',
      entityType: 'User',
      entityId: userId,
      meta: { by: actor.userId === userId ? 'self' : 'admin' },
    });
    return { anonymized: true, userId };
  }
}

@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdpr: GdprService) {}

  @Get('me/export')
  exportMe(@CurrentUser() user: AuthUser) {
    return this.gdpr.export(user.userId);
  }

  @Post('me/delete')
  deleteMe(@CurrentUser() user: AuthUser, @Body() dto: DeleteConfirmDto) {
    if (!dto.confirm) throw new BadRequestException('Silme için confirm:true gerekli');
    return this.gdpr.deleteAccount(user, user.userId);
  }

  @Roles(Role.ADMIN)
  @Get(':userId/export')
  exportUser(@Param('userId') userId: string) {
    return this.gdpr.export(userId);
  }

  @Roles(Role.ADMIN)
  @Post(':userId/delete')
  deleteUser(
    @CurrentUser() admin: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: DeleteConfirmDto,
  ) {
    if (!dto.confirm) throw new BadRequestException('Silme için confirm:true gerekli');
    return this.gdpr.deleteAccount(admin, userId);
  }
}

@Module({
  providers: [GdprService],
  controllers: [GdprController],
})
export class GdprModule {}
