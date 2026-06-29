import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SettingsService } from '../settings/settings.module';

export interface OrderPaymentInput {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency?: string;
  customerEmail?: string;
}

export interface OrderPaymentResult {
  provider: string;
  ref: string;
  checkoutUrl: string;
  status: 'PENDING' | 'PAID';
}

export interface PaymentProvider {
  readonly name: string;
  createOrderPayment(input: OrderPaymentInput): Promise<OrderPaymentResult>;
}

// STUB: Gerçek entegrasyon Faz 2 — QuickBooks Online Invoice + payment link (OAuth2).
@Injectable()
export class QuickBooksProvider implements PaymentProvider {
  readonly name = 'QUICKBOOKS';
  async createOrderPayment(input: OrderPaymentInput): Promise<OrderPaymentResult> {
    const ref = `qb_${input.orderNumber}_${randomUUID().slice(0, 8)}`;
    return {
      provider: this.name,
      ref,
      checkoutUrl: `https://quickbooks.intuit.com/pay/invoice/${ref}`,
      status: 'PENDING',
    };
  }
}

// Stripe Checkout Session — anahtar admin panelinden (settings.stripe.secretKey), yoksa env.
// Anahtar yokken stub URL döner (kırılmaz). Webhook onayı: payments confirm (admin) veya ileride imzalı webhook.
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'STRIPE';
  private readonly logger = new Logger(StripeProvider.name);

  constructor(
    private settings: SettingsService,
    private config: ConfigService,
  ) {}

  private async secret(): Promise<string> {
    const s = await this.settings.get<{ enabled?: boolean; secretKey?: string }>('stripe');
    const fromSettings = s?.enabled ? (s.secretKey || '').trim() : '';
    return fromSettings || (this.config.get<string>('STRIPE_SECRET_KEY') || '').trim();
  }

  async createOrderPayment(input: OrderPaymentInput): Promise<OrderPaymentResult> {
    const secret = await this.secret();
    // Anahtar yok → demo/stub davranışı (eski hali, kırılmaz)
    if (!secret) {
      const ref = `cs_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      this.logger.warn('Stripe anahtarı yok — stub checkout URL döndü (admin → Entegrasyonlar)');
      return {
        provider: this.name,
        ref,
        checkoutUrl: `https://checkout.stripe.com/pay/${ref}`,
        status: 'PENDING',
      };
    }

    const base = (this.config.get<string>('FRONTEND_URL') || 'http://91.99.183.64').replace(/\/$/, '');
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${base}/app/orders/${input.orderId}?paid=1`);
    params.append('cancel_url', `${base}/app/orders/${input.orderId}?canceled=1`);
    params.append('client_reference_id', input.orderId);
    if (input.customerEmail) params.append('customer_email', input.customerEmail);
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', (input.currency || 'usd').toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(Math.round(input.amount * 100)));
    params.append(
      'line_items[0][price_data][product_data][name]',
      `Ortak Doku — Sipariş #${input.orderNumber}`,
    );

    try {
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        this.logger.error(`Stripe session hatası: ${JSON.stringify(json.error ?? json)}`);
        throw new Error(json.error?.message ?? 'Stripe ödeme oturumu oluşturulamadı');
      }
      return { provider: this.name, ref: json.id, checkoutUrl: json.url, status: 'PENDING' };
    } catch (e: any) {
      this.logger.error(`Stripe isteği başarısız: ${e?.message ?? e}`);
      throw e;
    }
  }
}
