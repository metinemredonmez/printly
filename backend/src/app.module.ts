import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';

import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { CatalogModule } from './catalog/catalog.module';
import { PricingModule } from './pricing/pricing.module';
import { OrdersModule } from './orders/orders.module';
import { FilesModule } from './files/files.module';
import { CreditsModule } from './credits/credits.module';
import { EtsyStoresModule } from './etsy-stores/etsy-stores.module';
import { BillingModule } from './billing/billing.module';
import { MembershipsModule } from './memberships/memberships.module';
import { TransactionsModule } from './transactions/transactions.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // NODE_ENV'e göre .env.development / .env.production yüklenir, .env fallback.
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3001),
        CORS_ORIGINS: Joi.string().allow('').default(''),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        JWT_EXPIRES_IN: Joi.string().default('1d'),
        // R2 — dosya modülü için (örnek değerlerle başlar, gerçek değer .env'de)
        R2_ACCOUNT_ID: Joi.string().allow('').default(''),
        R2_ACCESS_KEY_ID: Joi.string().allow('').default(''),
        R2_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
        R2_BUCKET: Joi.string().allow('').default('printy-files'),
        R2_ENDPOINT: Joi.string().allow('').default(''),
        R2_PRESIGN_EXPIRES: Joi.number().default(3600),
        // SMTP (OTP e-posta). Boşsa kod log'a yazılır (dev).
        SMTP_HOST: Joi.string().allow('').default(''),
        SMTP_PORT: Joi.number().default(587),
        SMTP_SECURE: Joi.string().allow('').default('false'),
        SMTP_USER: Joi.string().allow('').default(''),
        SMTP_PASS: Joi.string().allow('').default(''),
        SMTP_FROM: Joi.string().allow('').default('Ortak Doku <noreply@ortakdoku.com>'),
      }),
    }),
    // Global rate-limit: varsayılan 120 istek/dk; hassas auth endpoint'leri @Throttle ile daha sıkı.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    OrganizationsModule,
    CatalogModule,
    PricingModule,
    OrdersModule,
    FilesModule,
    CreditsModule,
    EtsyStoresModule,
    BillingModule,
    MembershipsModule,
    TransactionsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
