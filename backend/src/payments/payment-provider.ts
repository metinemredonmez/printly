import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

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

// STUB: Gerçek entegrasyon Faz 2 — Stripe Checkout Session (api key + webhook).
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'STRIPE';
  async createOrderPayment(input: OrderPaymentInput): Promise<OrderPaymentResult> {
    const ref = `cs_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    return {
      provider: this.name,
      ref,
      checkoutUrl: `https://checkout.stripe.com/pay/${ref}`,
      status: 'PENDING',
    };
  }
}
