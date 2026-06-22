import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  PaymentMethod,
  PaymentStatus,
  Role,
  TransactionType,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.module';
import { AuditService } from '../audit/audit.module';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import {
  PaymentProvider,
  QuickBooksProvider,
  StripeProvider,
} from './payment-provider';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private audit: AuditService,
    private qb: QuickBooksProvider,
    private stripe: StripeProvider,
  ) {}

  // Aktif sağlayıcıyı Settings'ten çöz (admin ayardan seçer)
  private async activeProvider(): Promise<PaymentProvider> {
    const key = await this.settings.get<string>('activePaymentProvider', 'QUICKBOOKS');
    const enabled = await this.settings.get<Record<string, boolean>>(
      'paymentProvidersEnabled',
      { QUICKBOOKS: true, STRIPE: false },
    );
    if (key === 'STRIPE' && enabled.STRIPE !== false) return this.stripe;
    return this.qb;
  }

  async providers() {
    return {
      active: await this.settings.get('activePaymentProvider', 'QUICKBOOKS'),
      enabled: await this.settings.get('paymentProvidersEnabled', {
        QUICKBOOKS: true,
        STRIPE: false,
      }),
    };
  }

  // Kart ödemeli sipariş için aktif sağlayıcıdan ödeme linki oluştur
  async createCheckout(user: AuthUser, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const isStaff = user.role === Role.ADMIN || user.role === Role.PRODUCTION;
    if (!isStaff && order.userId !== user.userId) {
      throw new ForbiddenException('Bu siparişe erişiminiz yok');
    }
    if (order.paymentMethod !== PaymentMethod.CARD) {
      throw new BadRequestException('Sadece kart ödemeli siparişlerde geçerli');
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Sipariş zaten ödenmiş');
    }

    const provider = await this.activeProvider();
    const res = await provider.createOrderPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.total),
      currency: 'USD',
      customerEmail: user.email,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentProvider: res.provider, paymentRef: res.ref },
    });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'PAYMENT_CHECKOUT',
      entityType: 'Order',
      entityId: order.id,
      meta: { provider: res.provider, ref: res.ref, amount: Number(order.total) },
    });
    return {
      provider: res.provider,
      ref: res.ref,
      checkoutUrl: res.checkoutUrl,
      amount: Number(order.total),
    };
  }

  // Ödeme onayı (gerçek hayatta sağlayıcı webhook'u; şimdilik admin/manuel)
  async confirm(actor: AuthUser, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    if (order.paymentStatus === PaymentStatus.PAID) {
      return order;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.PAID },
      });
      await tx.transaction.create({
        data: {
          userId: order.userId,
          type: TransactionType.ORDER_PAYMENT,
          amount: new Prisma.Decimal(Number(order.total)),
          status: TransactionStatus.SUCCESS,
          method: PaymentMethod.CARD,
          orderId: order.id,
          note: `Kart ödemesi onaylandı (${order.paymentProvider ?? 'manual'})`,
        },
      });
      return o;
    });

    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'PAYMENT_CONFIRMED',
      entityType: 'Order',
      entityId: order.id,
      meta: { provider: order.paymentProvider, ref: order.paymentRef },
    });
    return updated;
  }
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Roles(Role.ADMIN)
  @Get('providers')
  providers() {
    return this.payments.providers();
  }

  @Post('checkout/:orderId')
  checkout(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.payments.createCheckout(user, orderId);
  }

  // Ödeme onayı — şimdilik ADMIN (gerçek gateway webhook'u Faz 2)
  @Roles(Role.ADMIN)
  @Post('confirm/:orderId')
  confirm(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.payments.confirm(user, orderId);
  }
}

@Module({
  providers: [PaymentsService, QuickBooksProvider, StripeProvider],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
