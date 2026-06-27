import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';
import * as Joi from 'joi';

import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuditModule } from './audit/audit.module';
import { SettingsModule } from './settings/settings.module';
import { BoardModule } from './board/board.module';
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
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { ImportExportModule } from './import-export/import-export.module';
import { ReportsModule } from './reports/reports.module';
import { LabelsModule } from './labels/labels.module';
import { InvoicesModule } from './invoices/invoices.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { TenantModule, TenantMiddleware } from './tenant/tenant.module';
import { DocumentsModule } from './documents/documents.module';
import { TicketsModule } from './tickets/tickets.module';
import { SearchModule } from './search/search.module';
import { NotificationCenterModule } from './notification-center/notification-center.module';
import { GdprModule } from './gdpr/gdpr.module';
import { MapModule } from './map/map.module';
import { ScanModule } from './scan/scan.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ProofsModule } from './proofs/proofs.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ProductionModule } from './production/production.module';
import { WhitelabelModule } from './whitelabel/whitelabel.module';
import { PublicModule } from './public/public.module';
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
        REDIS_URL: Joi.string().allow('').default(''),
        // At-rest şifreleme (2FA secret/PII) — 32 byte = 64 hex.
        // Prod'da ZORUNLU (zayıf dev-fallback anahtarıyla şifrelemeyi engeller — L13).
        ENCRYPTION_KEY: Joi.string().when('NODE_ENV', {
          is: 'production',
          then: Joi.string().length(64).required(),
          otherwise: Joi.string().allow('').default(''),
        }),
        // SMTP (OTP e-posta). Boşsa kod log'a yazılır (dev).
        SMTP_HOST: Joi.string().allow('').default(''),
        SMTP_PORT: Joi.number().default(587),
        SMTP_SECURE: Joi.string().allow('').default('false'),
        SMTP_USER: Joi.string().allow('').default(''),
        SMTP_PASS: Joi.string().allow('').default(''),
        SMTP_FROM: Joi.string().allow('').default('Ortak Doku <noreply@ortakdoku.com>'),
        // OneSignal push (Ortak Doku'nun KENDİ app'i; boşsa push gönderilmez)
        ONESIGNAL_APP_ID: Joi.string().allow('').default(''),
        ONESIGNAL_API_KEY: Joi.string().allow('').default(''),
        // Bull Board (kuyruk dashboard) basic-auth
        BULLBOARD_USER: Joi.string().allow('').default('admin'),
        BULLBOARD_PASS: Joi.string().allow('').default('change-me-please'),
      }),
    }),
    // Kuyruk izleme paneli — /admin/queues (basic-auth korumalı, #22)
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
      middleware: basicAuth({
        challenge: true,
        users: {
          [process.env.BULLBOARD_USER || 'admin']:
            process.env.BULLBOARD_PASS || 'change-me-please',
        },
      }),
    }),
    // Global rate-limit: varsayılan 120 istek/dk; hassas auth endpoint'leri @Throttle ile daha sıkı.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    // Global cache: REDIS_URL varsa Redis, yoksa in-memory (graceful).
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url) return { ttl: 60000 };
        try {
          const store = await redisStore({ url, ttl: 60000 });
          return { store };
        } catch {
          return { ttl: 60000 }; // Redis erişilemezse in-memory'e düş
        }
      },
    }),
    // BullMQ arka plan kuyruğu (toplu mail/push vb.) — Redis bağlantısı.
    // Yönetilen Redis (Upstash/Redis Cloud) rediss:// (TLS) + parola ister;
    // bağlantı parolayı/TLS'i URL'den çözer. Dev'de redis://localhost:6380.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('REDIS_URL') || 'redis://localhost:6380');
        const isTls = url.protocol === 'rediss:';
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            username: url.username || undefined,
            password: url.password || undefined,
            tls: isTls ? {} : undefined,
            // BullMQ gereği (ioredis bloklamayan komutlar) — yönetilen Redis'te şart
            maxRetriesPerRequest: null,
          },
          // Güvenilirlik: 3 deneme + exponential backoff; Redis şişmesin diye temizlik
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        };
      },
    }),
    PrismaModule,
    MailModule,
    AuditModule,
    SettingsModule,
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
    BoardModule,
    NotificationsModule,
    PaymentsModule,
    ImportExportModule,
    ReportsModule,
    LabelsModule,
    InvoicesModule,
    AdminUsersModule,
    TenantModule,
    DocumentsModule,
    TicketsModule,
    SearchModule,
    NotificationCenterModule,
    GdprModule,
    MapModule,
    ScanModule,
    SubscriptionsModule,
    ProofsModule,
    WebhooksModule,
    ProductionModule,
    WhitelabelModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Sıra önemli: AllExceptionsFilter (catch-all) önce, PrismaExceptionFilter sonra
    // kaydedilir → Nest spesifik olanı (Prisma) önce dener.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
