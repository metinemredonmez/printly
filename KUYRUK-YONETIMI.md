# Kuyruk Yönetimi (BullMQ)

> Ortak Doku — B2B Print-on-Demand backend (NestJS + Postgres + Cloudflare R2 + Redis).
> Bu doküman mevcut kurulumdan başlayıp; izleme (Bull Board), güvenilirlik, ölçekleme, zamanlanmış işler, hangi işlerin kuyruğa alınması gerektiği ve gözlemlenebilirlik konularını üretim seviyesinde anlatır.
>
> Sürüm notu (Haziran 2026): Mevcut `package.json` `bullmq@^5.79`, `@nestjs/bullmq@^11`, `@nestjs/platform-express@^10` kullanıyor. Önerilen Bull Board sürümü `@bull-board/*@^6` (NestJS modülü, API ve Express adaptörü). Bu doküman bu sürümlere göre yazılmıştır.

---

## 1. Mevcut Kurulum Nasıl Çalışıyor

Şu an üç parça var: **BullMQ root bağlantısı**, **`notifications` kuyruğu** ve **`WorkerHost` tabanlı processor**. Toplu mail bu kuyruk üzerinden asenkron işleniyor.

### 1.1 Redis bağlantısı (root)

`src/app.module.ts` içinde BullMQ `forRootAsync` ile global olarak bağlanıyor. Tüm kuyruklar bu bağlantıyı miras alır:

```typescript
// src/app.module.ts (mevcut)
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const url = new URL(config.get<string>('REDIS_URL') || 'redis://localhost:6380');
    return { connection: { host: url.hostname, port: Number(url.port) || 6379 } };
  },
}),
```

> Not: Redis cache (`cache-manager-redis-yet`) ile BullMQ aynı Redis'i paylaşır. Bu kabul edilebilir, ancak üretimde BullMQ için **ayrı bir Redis veritabanı/instance** önerilir (cache temizleme / `FLUSHDB` kazaları kuyruk verisini silmesin). Aşağıda iyileştirilmiş bağlantı bölümüne bakın.

### 1.2 `notifications` kuyruğu (modül)

`src/notifications/notifications.module.ts` kuyruğu kaydeder:

```typescript
@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' })],
  providers: [NotificationsService, OneSignalProvider, NotificationsProcessor],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
```

### 1.3 İş üretimi — toplu mail kuyruğa alınıyor (async `{queued, jobId}`)

Servis, gönderimi senkron yapmak yerine işi kuyruğa atıp anında dönüyor. HTTP isteği bloklanmıyor:

```typescript
// src/notifications/notifications.module.ts (mevcut)
async sendBulkEmail(actor: AuthUser, dto: BulkEmailDto) {
  const job = await this.queue.add('bulk-email', {
    targetType: dto.targetType,
    userIds: dto.userIds,
    emails: dto.emails,
    subject: dto.subject,
    html: dto.html,
    actorUserId: actor.userId,
    actorRole: actor.role,
  });
  return { queued: true, jobId: job.id };
}
```

### 1.4 Worker — `WorkerHost` processor

İşi gerçekten yapan kısım. `@Processor('notifications')` + `WorkerHost.process()`:

```typescript
// src/notifications/notifications.module.ts (mevcut)
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly svc: NotificationsService) {
    super();
  }
  async process(job: Job) {
    if (job.name === 'bulk-email') return this.svc.processBulkEmail(job.data);
    return undefined;
  }
}
```

`processBulkEmail` alıcı listesini Postgres'ten çözüp `MailService.sendBulk()` ile gönderiyor ve `AuditService` ile loglanıyor.

### 1.5 Mevcut kurulumun eksikleri (bu dokümanın hedefleri)

| Konu | Mevcut durum | Bu dokümandaki çözüm |
|---|---|---|
| İzleme/dashboard | Yok | Bull Board (Bölüm 2) |
| Retry / backoff | Tanımsız (varsayılan: attempts=1, retry yok) | `defaultJobOptions` (Bölüm 3) |
| İş temizliği | `removeOnComplete/Fail` yok → Redis şişer | Otomatik temizleme (Bölüm 3) |
| İdempotency | `jobId` verilmiyor → tekrar tetikte çift gönderim | `jobId` ile dedupe (Bölüm 3) |
| Concurrency/rate limit | Tanımsız | Worker opsiyonları (Bölüm 3–4) |
| Zamanlanmış işler | Yok | Job Scheduler (Bölüm 5) |
| Alarm | Yok | `@OnWorkerEvent('failed')` (Bölüm 7) |

---

## 2. Kuyruk Yönetimi / İzleme: Bull Board

[Bull Board](https://github.com/felixmosh/bull-board) bekleyen/aktif/tamamlanan/başarısız işleri görselleştirir, tek tek **retry / sil / promote** yapılmasını sağlar.

### 2.1 Kurulum

```bash
npm install --save @bull-board/nestjs @bull-board/api @bull-board/express express-basic-auth
```

Mevcut proje **Express** platformunda (`@nestjs/platform-express`) olduğu için `@bull-board/express` adaptörü doğru seçimdir.

### 2.2 Root yapılandırma — `/admin/queues` + admin-only koruma

Bull Board NestJS modülü, route'u kendisi mount eder. Korumayı **middleware** ile veriyoruz çünkü route NestJS controller değil; bu yüzden `RolesGuard` doğrudan uygulanamaz. İki seçenek:

**Seçenek A — Basic Auth (en pratik, ayrı admin parolası):**

```typescript
// src/app.module.ts
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';

// imports: [...] içine:
BullBoardModule.forRoot({
  route: '/admin/queues',
  adapter: ExpressAdapter,
  // Dashboard'a sadece admin parolasıyla erişim
  middleware: basicAuth({
    challenge: true,
    users: {
      [process.env.BULLBOARD_USER || 'admin']:
        process.env.BULLBOARD_PASS || 'change-me',
    },
  }),
}),
```

`.env` ve Joi şemasına ekleyin:

```typescript
// app.module.ts ConfigModule validationSchema içine
BULLBOARD_USER: Joi.string().allow('').default('admin'),
BULLBOARD_PASS: Joi.string().min(8).required(), // üretimde zorunlu
```

**Seçenek B — Mevcut JWT + ADMIN rolü ile koruma (tek kimlik sistemi):**

Sistemde zaten JWT + `Role.ADMIN` var. Bull Board route'unu kendi JWT'nizle korumak için bir middleware yazıp dashboard'dan **önce** uygulayın. `BullBoardModule` route'u kendi mount ettiği için, middleware'i `forRoot` `middleware` opsiyonuna verin:

```typescript
// src/common/middleware/bullboard-auth.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
  constructor(private jwt: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    // Token header'dan ya da ?token= query'sinden (tarayıcıda iframe/redirect kolaylığı)
    const header = req.headers.authorization?.replace('Bearer ', '');
    const token = header || (req.query.token as string);
    if (!token) throw new UnauthorizedException('Token gerekli');
    try {
      const payload = this.jwt.verify(token);
      if (payload.role !== 'ADMIN') throw new UnauthorizedException('Admin yetkisi gerekli');
      next();
    } catch {
      throw new UnauthorizedException('Geçersiz token');
    }
  }
}
```

Bu middleware'i `forRoot` içinde fonksiyon olarak geçirin:

```typescript
BullBoardModule.forRoot({
  route: '/admin/queues',
  adapter: ExpressAdapter,
  middleware: (req, res, next) => bullBoardAuth.use(req, res, next),
}),
```

> Üretim önerisi: **Seçenek A (Basic Auth)** operasyonel olarak en sağlam olanıdır — dashboard'a SSO/parola yöneticisiyle erişilir, JWT süresi dolma sorunu yaşatmaz. Ek olarak dashboard route'unu yalnızca iç ağdan/VPN'den erişilebilir kılmak (reverse proxy IP allowlist) en güvenli katmandır.

### 2.3 Kuyrukları dashboard'a kaydetme (`forFeature`)

Her kuyruğun ilgili modülünde `forFeature` ile dashboard'a tanıtılması gerekir:

```typescript
// src/notifications/notifications.module.ts
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notifications' }),
    BullBoardModule.forFeature({
      name: 'notifications',
      adapter: BullMQAdapter,
    }),
  ],
  // ...
})
export class NotificationsModule {}
```

Birden fazla kuyruk için (örn. ileride `media`, `etsy`, `ai`) her modülde aynı `forFeature` eklenir; hepsi tek dashboard'da listelenir.

### 2.4 Dashboard'da iş durumları ve aksiyonlar

| Durum | Anlamı | Dashboard aksiyonu |
|---|---|---|
| **waiting** | Sırada, henüz alınmadı | İptal / sil |
| **active** | Şu an bir worker işliyor | İzle |
| **completed** | Başarıyla bitti | Sonucu gör / sil |
| **failed** | `attempts` tükendi, başarısız | **Retry** / sil / log incele |
| **delayed** | Gelecekte (backoff/scheduler) çalışacak | **Promote** (hemen çalıştır) |
| **paused** | Kuyruk durdurulmuş | Resume |

Dashboard üzerinden başarısız bir işi **Retry** ile yeniden kuyruğa atabilir, **Promote** ile gecikmeli bir işi öne alabilir, toplu **Clean** ile eski işleri silebilirsiniz. Aynı işlemler programatik olarak da yapılır (Bölüm 3.4).

---

## 3. Güvenilirlik

### 3.1 Retry + exponential backoff + attempts (kuyruk seviyesi varsayılanı)

Tüm işlere uygulanacak makul varsayılanları `registerQueue`'da tanımlayın:

```typescript
// src/notifications/notifications.module.ts
BullModule.registerQueue({
  name: 'notifications',
  defaultJobOptions: {
    attempts: 5,                    // 5 denemeye kadar
    backoff: {
      type: 'exponential',          // 1s, 2s, 4s, 8s, 16s
      delay: 1000,
    },
    removeOnComplete: { age: 24 * 3600, count: 1000 }, // 1 gün VEYA son 1000
    removeOnFail: { age: 7 * 24 * 3600 },              // başarısızları 7 gün tut (inceleme için)
  },
}),
```

> Tasarım kuralı: **completed işleri hızlı temizle, failed işleri uzun tut.** Başarısızlar hata ayıklama ve DLQ analizi için gereklidir.

İş bazında ezme (örn. kritik tek bir iş):

```typescript
await this.queue.add('bulk-email', payload, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
});
```

### 3.2 İdempotency — `jobId` ile çift işlemeyi engelleme

Aynı mantıksal iş iki kez tetiklendiğinde (retry, çift HTTP isteği, webhook tekrarı) BullMQ aynı `jobId`'li işi **tekrar eklemez**. Bu, idempotency'nin en ucuz yoludur:

```typescript
// Örnek: bir sipariş için "üretime alındı" bildirimi yalnızca bir kez
await this.queue.add(
  'order-status-email',
  { orderId, status: 'IN_PRODUCTION' },
  {
    jobId: `order-status:${orderId}:IN_PRODUCTION`, // deterministik anahtar
    removeOnComplete: true,
  },
);
```

> Uyarı: BullMQ aynı `jobId`'yi tekrar kabul etmez **ancak** iş `removeOnComplete` ile silindiyse aynı `jobId` yeniden kullanılabilir hale gelir. Tam "exactly-once" garantisi için processor içinde de bir veritabanı tarafı kontrolü (örn. `EmailLog`'ta `uniqueKey` unique index) tutmak en sağlamıdır. Kuyruk dedupe'ı + DB dedupe'ı birlikte kullanılır.

Toplu mail için idempotent örnek:

```typescript
async sendBulkEmail(actor: AuthUser, dto: BulkEmailDto & { campaignId?: string }) {
  const job = await this.queue.add('bulk-email', { ...dto, actorUserId: actor.userId, actorRole: actor.role }, {
    jobId: dto.campaignId ? `bulk-email:${dto.campaignId}` : undefined,
  });
  return { queued: true, jobId: job.id };
}
```

### 3.3 Failed iş yönetimi ve DLQ (Dead Letter Queue)

BullMQ'da yerleşik DLQ yoktur; `failed` durumu zaten bir "ölü mektup" alanı gibi davranır (işler `removeOnFail` süresince saklanır). İki yaklaşım:

**A) `failed` durumunu DLQ gibi kullan (basit):** `removeOnFail`'i uzun tut, dashboard'dan veya cron ile incele/retry et.

**B) Ayrı DLQ kuyruğu (gelişmiş):** `attempts` tükenince işi ayrı bir `notifications-dlq` kuyruğuna taşı. Manuel müdahale gerektiren işler için temiz ayrım sağlar:

```typescript
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly svc: NotificationsService,
    @InjectQueue('notifications-dlq') private dlq: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'bulk-email') return this.svc.processBulkEmail(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, err: Error) {
    // Son deneme de başarısızsa DLQ'ya taşı
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.dlq.add(job.name, { ...job.data, failedReason: err.message, originalJobId: job.id });
    }
  }
}
```

### 3.4 Programatik temizleme / yeniden deneme

```typescript
// Belirli bir işi yeniden dene
const job = await this.queue.getJob(jobId);
await job?.retry();

// Eski tamamlanmışları temizle (24 saatten eski, en fazla 1000 iş)
await this.queue.clean(24 * 3600 * 1000, 1000, 'completed');
await this.queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed');

// Tüm başarısızları yeniden dene (toplu kurtarma)
const failed = await this.queue.getJobs(['failed']);
await Promise.all(failed.map((j) => j.retry()));
```

### 3.5 Rate limiting (sağlayıcı kotalarına uyma)

SMTP/OneSignal/Etsy gibi servislerin saniye/dakika limitleri vardır. Worker seviyesinde global rate limit:

```typescript
@Processor('notifications', {
  limiter: { max: 20, duration: 1000 }, // saniyede en fazla 20 iş (tüm worker'lar GLOBAL)
})
export class NotificationsProcessor extends WorkerHost { /* ... */ }
```

> `limiter` **kuyruk genelinde globaldir**: 10 worker da olsa saniyede toplam 20 iş işlenir. Sağlayıcı 429 dönerse processor içinde **dinamik** rate limit de mümkündür:

```typescript
async process(job: Job) {
  try {
    return await this.svc.processBulkEmail(job.data);
  } catch (e) {
    if (e.status === 429) {
      // 60 sn boyunca bu kuyruğu durdur, işi tekrar dene
      await this.worker.rateLimit(60_000);
      throw Worker.RateLimitError();
    }
    throw e;
  }
}
```

---

## 4. Concurrency + Ölçekleme

### 4.1 Worker concurrency

Tek worker instance'ının paralel kaç iş işleyeceği:

```typescript
@Processor('notifications', {
  concurrency: 10, // aynı anda 10 iş
})
export class NotificationsProcessor extends WorkerHost { /* ... */ }
```

Boyutlandırma kılavuzu:

| İş tipi | Önerilen concurrency |
|---|---|
| I/O ağırlıklı (mail, HTTP API, R2 yükleme) | 50–300 |
| CPU ağırlıklı (görsel işleme, PDF render) | CPU çekirdek sayısı kadar (örn. 2–4) |

> Toplu mail I/O ağırlıklıdır → yüksek concurrency uygundur. Görsel işleme (thumbnail/DPI) CPU ağırlıklıdır → düşük tutun veya **sandboxed processor** kullanın (ayrı dosyada çalışan işlemci, ana event loop'u bloklamaz).

### 4.2 Ayrı worker process (API'den bağımsız ölçekleme)

Üretimde API ve worker'ı **ayrı process** çalıştırmak en iyi pratiktir: API CPU/memory baskısı altında kalsa bile işler işlenmeye devam eder; worker'ı bağımsız ölçeklersiniz.

Ayrı bir worker bootstrap'i:

```typescript
// src/worker.ts
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  // HTTP listener YOK — sadece BullMQ worker'ları ayağa kalkar
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();
  console.log('Worker process up');
}
bootstrap();
```

`WorkerModule`, processor'ları ve bağımlılıklarını (Prisma, Mail, Bull bağlantısı) içerir ama HTTP controller'ları içermez. `package.json`:

```json
{
  "scripts": {
    "start:prod": "node dist/main",
    "start:worker": "node dist/worker"
  }
}
```

`docker-compose` / Kubernetes'te:

```yaml
services:
  api:
    command: node dist/main
    replicas: 2
  worker:
    command: node dist/worker
    replicas: 3   # yükü bağımsız ölçekle
```

> Aynı kod tabanı, iki giriş noktası. Hem API hem worker process'leri **aynı Redis**'e bağlanır → BullMQ işi otomatik dağıtır. Yeni worker eklemek = `replicas` artırmak.

### 4.3 Redis paylaşımı ve bağlantı önerileri

```typescript
// İyileştirilmiş root bağlantısı (app + worker ortak)
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const url = new URL(config.get<string>('REDIS_URL') || 'redis://localhost:6379');
    return {
      connection: {
        host: url.hostname,
        port: Number(url.port) || 6379,
        password: url.password || undefined,
        db: Number(config.get('REDIS_BULL_DB') ?? 1), // cache'ten AYRI db (cache: db 0)
        // BullMQ gereği — blocking komutlar için
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      prefix: 'ortakdoku', // çok-kiracılı/çoklu-ortam izolasyonu
    };
  },
}),
```

> Kritik: BullMQ blocking komutlar kullandığı için `maxRetriesPerRequest: null` gerekir (aksi halde uyarı/hata alırsınız). Cache ile BullMQ'yu **farklı Redis db** (veya ayrı instance) ile ayırın.

---

## 5. Repeatable / Scheduled Jobs (Cron)

> Sürüm notu: BullMQ 5.16+ ile eski `repeat` API'si yerini **Job Schedulers** (`upsertJobScheduler`) yapısına bıraktı. Mevcut `bullmq@5.79` bu API'yi destekler; yeni kod bunu kullanmalıdır.

### 5.1 Job Scheduler oluşturma

`upsertJobScheduler` idempotenttir — aynı scheduler ID ile tekrar çağırmak yenisini eklemez, var olanı günceller. Bu yüzden uygulama açılışında güvenle çağrılabilir:

```typescript
// src/scheduling/scheduler.bootstrap.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SchedulerBootstrap implements OnModuleInit {
  constructor(
    @InjectQueue('etsy') private etsyQueue: Queue,
    @InjectQueue('maintenance') private maintQueue: Queue,
    @InjectQueue('billing') private billingQueue: Queue,
  ) {}

  async onModuleInit() {
    // Etsy sipariş çekme — her 15 dakikada
    await this.etsyQueue.upsertJobScheduler(
      'etsy-poll',                                  // benzersiz scheduler ID
      { pattern: '*/15 * * * *' },                  // cron ifadesi
      { name: 'poll-orders', data: {}, opts: { removeOnComplete: true, attempts: 3 } },
    );

    // R2 lifecycle / geçici dosya temizliği — her gün 03:00
    await this.maintQueue.upsertJobScheduler(
      'r2-lifecycle',
      { pattern: '0 3 * * *', tz: 'America/New_York' }, // ABD pazarı saat dilimi
      { name: 'r2-cleanup', data: {} },
    );

    // Abonelik/kredi yenileme kontrolü — her gün 00:30
    await this.billingQueue.upsertJobScheduler(
      'subscription-renewal',
      { pattern: '30 0 * * *', tz: 'America/New_York' },
      { name: 'renew-subscriptions', data: {} },
    );
  }
}
```

### 5.2 Scheduler işlerini işleyen processor

```typescript
@Processor('etsy')
export class EtsyProcessor extends WorkerHost {
  constructor(private readonly etsy: EtsyService) {
    super();
  }
  async process(job: Job) {
    if (job.name === 'poll-orders') return this.etsy.pollAllStores();
  }
}
```

### 5.3 Önerilen zamanlanmış işler (Ortak Doku)

| İş | Cron | Kuyruk | Açıklama |
|---|---|---|---|
| Etsy sipariş çekme | `*/15 * * * *` | `etsy` | Bağlı mağazalardan yeni siparişleri import et |
| R2 lifecycle/temizlik | `0 3 * * *` | `maintenance` | Orphan/expired geçici upload'ları sil |
| Abonelik/kredi yenileme | `30 0 * * *` | `billing` | Faturalandırma döngüsü, kredi yenileme |
| Bekleyen onay hatırlatma | `0 9 * * *` | `notifications` | `AWAITING_APPROVAL`'da bekleyen siparişlere e-posta |
| Failed job sağlık taraması | `*/30 * * * *` | `maintenance` | DLQ/failed sayısı eşiği geçerse alarm (Bölüm 7) |

> `interval` yerine `pattern` (cron) tercih edin; cron sunucu yeniden başlatmalarına dayanıklıdır ve `tz` ile saat dilimi netleşir (ABD pazarı için `America/New_York`).

### 5.4 Scheduler'ı silme/listeleme

```typescript
await this.etsyQueue.removeJobScheduler('etsy-poll');
const schedulers = await this.etsyQueue.getJobSchedulers(); // mevcut tüm scheduler'lar
```

---

## 6. Hangi İşler Kuyruğa Alınmalı

Kural: **uzun süren, dış servise bağımlı, başarısız olabilen, yeniden denenebilir veya toplu** her iş kuyruğa alınmalı. Kısa ve kritik-senkron işlemler (örn. sipariş durum geçişinin DB yazımı) senkron kalmalı; bunların **yan etkileri** (mail, push) kuyruğa atılmalı.

| İş | Kuyruk | Öncelik / not |
|---|---|---|
| **Toplu e-posta** (var) | `notifications` | Zaten async. `attempts`+`backoff`+`jobId` eklenmeli |
| **Push bildirimi** (OneSignal) | `notifications` | Şu an `sendPush` senkron — OneSignal yavaş/429 olabilir, kuyruğa alınmalı |
| **Sipariş durum bildirimleri** | `notifications` | `RECEIVED→IN_PRODUCTION→...→SHIPPED` geçişinde mail+push; `jobId=order:status` ile idempotent |
| **Görsel işleme** | `media` | Thumbnail üretimi, **DPI doğrulama** (wallpaper m² baskı kalitesi), **panel bölme** (büyük duvar kağıdını baskı panellerine ayırma). CPU ağırlıklı → sandboxed processor + düşük concurrency |
| **Etiket/PDF üretimi** | `media` | pdf-lib + bwip-js Code128 barkod (orderNumber) — toplu üretimde kuyruk |
| **Etsy poll** | `etsy` | Scheduled (Bölüm 5) + rate-limit (Etsy API kotası) |
| **QR-tetiklemeli işler** | duruma göre | QR taraması bir durum geçişi/işlem tetikliyorsa, ağır kısmı (PDF, mail) kuyruğa |
| **AI çağrıları** (Gemini mikroservis) | `ai` | Chatbox/virtual try-on/ölçü çıkarımı — FastAPI servisine HTTP; yavaş + 429'a açık. Kuyruk + retry + rate limit. Senkron gereken (canlı chat) hariç, batch/asenkron olanlar kuyrukta |

### 6.1 Örnek: push bildirimini kuyruğa alma

Mevcut `sendPush` senkron çalışıyor ve OneSignal'a bekliyor. Kuyruğa alalım:

```typescript
async sendPush(actor: AuthUser, dto: SendPushDto) {
  const log = await this.prisma.pushNotificationLog.create({ data: { /* ...PENDING... */ } });
  await this.queue.add('push', { logId: log.id, dto, actor }, {
    attempts: 4,
    backoff: { type: 'exponential', delay: 2000 },
    jobId: `push:${log.id}`,
  });
  return { queued: true, logId: log.id };
}
```

Processor'a yeni dal:

```typescript
async process(job: Job) {
  switch (job.name) {
    case 'bulk-email': return this.svc.processBulkEmail(job.data);
    case 'push':       return this.svc.processPush(job.data);
  }
}
```

### 6.2 Örnek: AI (Gemini) çağrısını kuyruğa alma + rate limit

```typescript
@Processor('ai', { concurrency: 5, limiter: { max: 10, duration: 1000 } })
export class AiProcessor extends WorkerHost {
  constructor(private readonly ai: AiClient) { super(); }
  async process(job: Job) {
    // FastAPI mikroservise HTTP — virtual try-on / ölçü çıkarımı
    return this.ai.callGemini(job.name, job.data);
  }

  @OnWorkerEvent('failed')
  onFail(job: Job, err: Error) {
    // 429 / quota hatalarını ayrı izle
  }
}
```

---

## 7. Gözlemlenebilirlik + Alarm

### 7.1 Worker event'leri ile loglama

NestJS'te worker olaylarına `@OnWorkerEvent` ile abone olunur:

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

@Processor('notifications', { concurrency: 10 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly svc: NotificationsService,
    private readonly alerts: AlertService,
  ) { super(); }

  async process(job: Job) {
    if (job.name === 'bulk-email') return this.svc.processBulkEmail(job.data);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`İş başladı: ${job.name}#${job.id}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`İş bitti: ${job.name}#${job.id}`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, err: Error) {
    this.logger.error(`İş BAŞARISIZ: ${job?.name}#${job?.id} — ${err.message}`);

    // Son deneme de başarısızsa ALARM gönder
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.alerts.notifyOps({
        title: 'Kuyruk işi kalıcı olarak başarısız',
        queue: 'notifications',
        job: job.name,
        jobId: job.id,
        reason: err.message,
        data: job.data,
      });
    }
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`İş takıldı (stalled): ${jobId}`); // worker çöktü/yavaşladı işareti
  }
}
```

### 7.2 Alarm servisi (Slack / e-posta / push)

```typescript
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  constructor(private config: ConfigService) {}

  async notifyOps(payload: Record<string, unknown>) {
    const webhook = this.config.get<string>('OPS_SLACK_WEBHOOK');
    if (!webhook) {
      this.logger.error(`[ALARM] ${JSON.stringify(payload)}`);
      return;
    }
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `:rotating_light: Kuyruk alarmı\n\`\`\`${JSON.stringify(payload, null, 2)}\`\`\`` }),
    });
  }
}
```

### 7.3 Periyodik sağlık taraması (eşik alarmı)

Tek tek `failed` event'ine ek olarak, **birikmiş** failed/waiting sayısını periyodik kontrol edip eşik aşımında alarm üretin (scheduled job, Bölüm 5):

```typescript
@Processor('maintenance')
export class MaintenanceProcessor extends WorkerHost {
  constructor(
    @InjectQueue('notifications') private notif: Queue,
    private alerts: AlertService,
  ) { super(); }

  async process(job: Job) {
    if (job.name === 'queue-health') {
      const counts = await this.notif.getJobCounts('failed', 'waiting', 'delayed', 'active');
      // Birikme alarmı
      if (counts.failed > 50) {
        await this.alerts.notifyOps({ title: 'Yüksek failed sayısı', queue: 'notifications', ...counts });
      }
      if (counts.waiting > 1000) {
        await this.alerts.notifyOps({ title: 'Kuyruk birikti (backlog)', queue: 'notifications', ...counts });
      }
      return counts;
    }
  }
}
```

### 7.4 Health endpoint'e kuyruk durumu ekleme

Mevcut `HealthController`'a kuyruk metriklerini ekleyin (uptime/monitoring sistemleri için):

```typescript
@Controller('health')
export class HealthController {
  constructor(@InjectQueue('notifications') private notif: Queue) {}

  @Get('queues')
  async queues() {
    return {
      notifications: await this.notif.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    };
  }
}
```

### 7.5 Metrik/izleme stack önerisi

- **Bull Board**: anlık manuel izleme + retry/sil (Bölüm 2).
- **Prometheus/Grafana**: `getJobCounts` değerlerini bir `/metrics` endpoint'inden expose edin; backlog ve failure rate üzerine Grafana alert'leri kurun.
- **Structured logging**: failed işlerde `job.data` + `failedReason`'ı yapısal loglayın (job ID ile korelasyon).
- **Sentry vb.**: `@OnWorkerEvent('failed')` içinde exception'ı APM'e gönderin.

---

## Özet Aksiyon Listesi

1. **Bull Board** kur (`@bull-board/nestjs@^6` + Express adaptör), `/admin/queues`'i Basic Auth ile koru, `forFeature` ile `notifications`'ı tanıt.
2. `registerQueue`'a **`defaultJobOptions`** ekle: `attempts: 5`, exponential `backoff`, `removeOnComplete`/`removeOnFail`.
3. Toplu mail + push işlerine **`jobId`** ekle (idempotency), push'u kuyruğa al.
4. Worker'a **`concurrency`** ve gerekli yerlerde **`limiter`** ekle; üretimde **ayrı worker process** (`dist/worker`) çalıştır.
5. Redis bağlantısında `maxRetriesPerRequest: null` ayarla ve BullMQ'yu cache'ten **ayrı db**'ye al.
6. **Job Scheduler** (`upsertJobScheduler`) ile Etsy poll / R2 lifecycle / abonelik yenileme cron'larını `America/New_York` saat dilimiyle kur.
7. **`@OnWorkerEvent('failed')` + AlertService** ile kalıcı başarısızlık alarmı; periyodik **queue-health** taramasıyla backlog alarmı.

Kaynaklar:
- [@bull-board/nestjs (npm)](https://www.npmjs.com/package/@bull-board/nestjs)
- [Bull Board — NestJS entegrasyonu (felixmosh/bull-board)](https://github.com/felixmosh/bull-board)
- [BullMQ — Job Schedulers](https://docs.bullmq.io/guide/job-schedulers)
- [BullMQ — Auto-removal of jobs](https://docs.bullmq.io/guide/queues/auto-removal-of-jobs)
- [BullMQ — Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [BullMQ — Rate limiting](https://docs.bullmq.io/guide/rate-limiting)
- [BullMQ — Concurrency](https://docs.bullmq.io/guide/workers/concurrency)
- [BullMQ — NestJS rehberi](https://docs.bullmq.io/guide/nestjs)
