import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Prisma BigInt alanları (ör. Asset.sizeBytes) JSON yanıtında 500 vermesin.
// JSON.stringify BigInt'i serialize edemez → global toJSON ile Number'a çevir.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  // rawBody: Stripe webhook imza doğrulaması için ham gövde gerekir
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // nginx/reverse-proxy arkasında gerçek istemci IP'si (rate-limit + loglar doğru çalışsın)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // enableImplicitConversion KAPALI: "false"/1 gibi değerleri boolean'a sessizce
      // çevirip @IsBoolean'ı baypas etmesini engeller (H4). Sayısal query yok (hepsi string).
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isProd = config.get<string>('NODE_ENV') === 'production';
  if (isProd && origins.length === 0) {
    throw new Error("Production'da CORS_ORIGINS tanımlanmalı (wildcard + credentials yasak)");
  }
  app.enableCors({
    origin: origins.length ? origins : isProd ? false : true,
    credentials: true,
  });

  // Swagger / OpenAPI → http://localhost:3001/api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ortak Doku API')
    .setDescription(
      'Print-on-Demand sipariş & operasyon API (Faz 1). ' +
        'Önce /auth/login veya /auth/verify-email ile token al, ' +
        'sağ üstteki "Authorize" ile Bearer token gir.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Printy API → http://localhost:${port}/api`);
}
bootstrap();
