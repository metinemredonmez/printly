# Ortak Doku Backend — Genel Analiz

## 1. Yönetici Özeti

"Ortak Doku" (printy) Faz 1 backend'i, mimari iskelet ve finansal veri modeli açısından **beklenenin üzerinde olgun** ama **prod'a çıkmaya henüz hazır değil**. NestJS modüler yapısı sağlam (global `ValidationPipe`, global `AllExceptionsFilter`, `@Global()` paylaşımlı altyapı modülleri, Joi config doğrulaması, tsc'de hatasız derleme); para tarafı doğru kurgulanmış (tüm parasal alanlar `Decimal`, bakiye/aidat düşümleri `UPDATE ... WHERE balance >= X` ile gerçekten atomik ve yarış-koşulsuz); deploy altyapısı (systemd + nginx + GitHub Actions + iki katmanlı yedek) gerçek ve eksiksiz.

Ancak **iki adet doğrudan parasal istismar (kritik)**, **sıfır otomatik test**, **gözlemlenebilirlik yokluğu** ve **sistemik index/pagination eksikliği** birlikte değerlendirildiğinde, mevcut haliyle canlıya alınması maddi kayıp ve operasyonel körlük riski taşır.

**En kritik 3-5 risk:**

1. **Bakiye yükleme gerçek ödeme olmadan para + %40 indirim üretiyor** (`credits/credits.service.ts:36`) — kullanıcı tek istekte sınırsız bakiye ve kalıcı indirim kazanır. Doğrudan dolandırıcılık vektörü.
2. **USER kendini bedelsiz TEAM_LEADER yapıp fiyatını yarıya düşürebiliyor** (`memberships/memberships.module.ts:126`) — self-service terfi tüm siparişlerde %50 avantaj sağlar.
3. **İptal edilen BALANCE siparişinde bakiye iadesi yok** (`orders/orders.service.ts:197-235`) — `PaymentStatus.REFUNDED` tanımlı ama hiç kullanılmıyor; müşteri parası yanar.
4. **Sıfır otomatik test** (`package.json` — test script/jest yok) — para hesaplayan hiçbir akış test edilmemiş; yuvarlama/eşik regresyonu fark edilmeden prod'a gider.
5. **Sistemik performans borcu**: FK ve sık-filtrelenen kolonlarda index yok (PostgreSQL FK index'i otomatik açmaz) + listeleme uçlarında pagination yok → 10K+ siparişte sequential scan ve event-loop blokajı.

**Genel kanı:** Mimari temel sağlam ve "doğru kararlar" alınmış bir Faz 1. Ne var ki para akışındaki istismar açıkları ve test/gözlemlenebilirlik boşlukları **prod öncesi şarttır**; bunlar kapatılmadan canlıya çıkış önerilmez.

---

## 2. Olgunluk Skor Kartı

| Boyut | Puan/100 | Özet |
|---|---:|---|
| Mimari & Modül Yapısı | 72 | Sağlam modüler iskelet; guard zinciri iki modüle dağılmış, dosya organizasyonu tutarsız, ENCRYPTION_KEY prod'da zorunlu değil. |
| Güvenlik | 58 | Auth/şifreleme temeli iyi; **iki kritik para istismarı**, trust proxy yok (rate-limit çöküyor), 2FA/OTP brute-force sertleştirmesi eksik. |
| Veri Modeli & Prisma | 72 | Tüm para `Decimal`, atomik düşümler, temiz enum/migration; FK index'leri ve gerçek FK ilişkileri eksik. |
| İş Mantığı Doğruluğu | 62 | Fiyat formülü ve indirim sırası doğru; iptal iadesi yok, CARD'da mükerrer transaction, admin rol değişimi membership'i baypas ediyor. |
| Kod Kalitesi & Tutarlılık | 68 | Temiz ve iyi yorumlu; DRY ihlalleri (TRANSITIONS, fiyat sabitleri), tam strict değil, test yok. |
| Performans & Ölçeklenebilirlik | 52 | Atomik para + R2 multipart + cache iyi; **index yok + pagination yok + senkron PDF/XLSX** ölçeklenmede kritik. |
| Prod Hazırlığı / Gözlemlenebilirlik / Test | 52 | Deploy/yedek olgun; **sıfır test**, hata izleme yok, graceful shutdown yok, BullMQ retry yok. |

**Ağırlıklı genel puan: ~61/100.** (Ağırlıklandırma: Güvenlik %22, İş Mantığı %20, Prod Hazırlığı %18, Performans %15, Veri Modeli %10, Mimari %8, Kod Kalitesi %7 — para/prod kritikliği öne çıkarılmıştır.) Yorum: **"Sağlam temel, prod'a hazır değil"** bandı.

---

## 3. Kritik & Yüksek Bulgular (Öncelikli Aksiyon)

Tüm boyutlardan kritik+yüksek bulgular birleştirilmiş ve tekilleştirilmiştir (birden çok boyutta tekrar eden bulgular tek satırda toplandı).

### KRİTİK

#### K1. Bakiye yükleme gerçek ödeme olmadan para + %40 indirim üretiyor
- **Önem:** Kritik
- **Konum:** `src/credits/credits.service.ts:36` / `src/credits/credits.controller.ts:27`
- **Neden önemli:** `POST /credits/me/topup` herhangi bir kullanıcının kendi bakiyesini gerçek tahsilat olmadan istediği kadar artırmasına izin veriyor (`method` varsayılan `CARD`, ödeme "simüle" ediliyor, gateway doğrulaması yok). Üstelik `amount>=250` olduğunda `hasDiscount40=true` atanıyor → tek istekte sınırsız bakiye + kalıcı %40 indirim. Doğrudan parasal kayıp/dolandırıcılık.
- **Çözüm:** Self-service top-up'ı gerçek ödeme onayına bağla: CARD yüklemelerinde önce `PaymentProvider` checkout başlat; bakiye/indirim YALNIZCA imza-doğrulamalı sağlayıcı webhook'u ile artsın. Bakiyeyi doğrudan yazan kod yalnız ADMIN (`/credits/:userId/topup`) ve doğrulanmış webhook'a bırakılsın.

#### K2. USER kendini bedelsiz TEAM_LEADER yapıp fiyatını yarıya düşürebiliyor
- **Önem:** Kritik
- **Konum:** `src/memberships/memberships.module.ts:126` / `:161`
- **Neden önemli:** `POST /memberships/upgrade` herhangi bir USER tarafından kendi `userId`'siyle çağrılıyor; `tier=TEAM_LEADER` seçilince hiçbir ücret/onay olmadan `role=TEAM_LEADER` + `priceMultiplier=1` atanıyor. Fiyat çarpanı 2→1 düşer; tüm siparişlerde %50 avantaj. Ayrıca TEAM_MEMBER terfisinde `leaderId` kullanıcı tarafından serbestçe seçiliyor.
- **Çözüm:** TEAM_LEADER terfisini ADMIN onayı/davet akışına bağla (self-service kapat); lider terfisi yalnız `Roles(ADMIN)` ile yapılsın. Üye terfisinde aidat tahsili korunmalı, lider terfisi için uygun kontrol/ödeme modeli tanımlanmalı.

#### K3. İptal edilen BALANCE siparişinde bakiye iadesi yok — para kaybı
- **Önem:** Kritik
- **Konum:** `src/orders/orders.service.ts:197-235` (TRANSITIONS `:22-29`, updateStatus `:180`)
- **Neden önemli:** Sipariş BALANCE ile ödenince bakiyeden `total` atomik düşülüyor; ancak `CANCELLED`'a geçişte hiçbir iade/ters ledger kaydı yapılmıyor (TRANSITIONS `RECEIVED→CANCELLED` ve `IN_PRODUCTION→CANCELLED`'a izin veriyor). Tüm kod tabanında `refund/REFUNDED` geçen tek satır yok; `PaymentStatus.REFUNDED` enum'u ölü. Müşteri parası yanar, uyuşmazlık riski.
- **Çözüm:** `updateStatus` içinde `newStatus===CANCELLED && paymentMethod===BALANCE && paymentStatus===PAID` ise tek `$transaction`'da: `balance += total` (atomik), pozitif delta `CreditLedger` (reason='Sipariş iptali iadesi'), REFUND tipi `Transaction`, `paymentStatus=REFUNDED`. İdempotans: zaten `REFUNDED` ise atla. CARD iadeleri için sağlayıcı refund akışı işaretlensin.

#### K4. Sıfır otomatik test — finansal akıllar dahil hiç kapsam yok
- **Önem:** Kritik
- **Konum:** `backend/package.json:9` (test script yok); `src/pricing/pricing.service.ts`; `src/credits/credits.service.ts`
- **Neden önemli:** Tek bir `*.spec.ts` yok; jest/supertest/@nestjs/testing bağımlılıkları da yok. Para hesaplayan/düşen kritik mantık (`pricing.service`, `credits.topUp` $250 eşiği, atomik bakiye düşümü, aidat tahsili) tamamen test dışı. Bir yuvarlama/eşik regresyonu doğrudan gelir kaybı demek ve fark edilmeden prod'a gider.
- **Çözüm:** jest + @nestjs/testing kur, `test`/`test:cov` script ekle. Öncelik: `quoteOrder` sınır vakaları (0 boyut, FLAT, indirim açık/kapalı), `topUp` $249.99 vs $250 eşiği, yetersiz bakiyede sipariş reddi, eşzamanlı düşüm. CI'a `npm test` adımı.

### YÜKSEK

#### Y1. Reverse-proxy arkasında `trust proxy` yok → rate-limit tek kovaya çöküyor
- **Önem:** Yüksek
- **Konum:** `src/main.ts:8` (eksik) / `deploy/nginx/ortakdoku.conf:35`
- **Neden önemli:** Uygulama nginx arkasında (`proxy_pass 127.0.0.1:3001`) ama `app.set('trust proxy', ...)` yok. `ThrottlerGuard` IP'yi `req.ip`'den alır; trust proxy olmadan tüm istekler proxy'nin `127.0.0.1`'inden gelmiş görünür → login/OTP/register per-IP limitleri (5-10/dk) tüm kullanıcılar için tek ortak kovaya düşer. Hem brute-force korumasını etkisizleştirir hem meşru kullanıcıları kilitler. (Bu, K-OTP ve 2FA brute-force bulgularının da kök nedenidir.)
- **Çözüm:** `main.ts`'te `app.set('trust proxy', 1)` (doğru hop sayısı) ekle; nginx'in `X-Forwarded-For` ilettiğini doğrula. Gerekirse `ThrottlerModule.getTracker`'ı XFF'e göre özelleştir.

#### Y2. ENCRYPTION_KEY prod'da zorunlu değil — sessiz güvensiz fallback
- **Önem:** Yüksek
- **Konum:** `src/app.module.ts:61` / `src/common/crypto.util.ts:5-10`
- **Neden önemli:** Joi şemasında `ENCRYPTION_KEY: Joi.string().allow('').default('')` (prod'da boş bırakılabilir). `crypto.util.getKey()` geçersiz anahtarda `scryptSync('dev-insecure-key', ...)` ile sabit, herkesçe bilinen anahtar üretiyor (uyarı bile loglanmaz). Bu anahtarla 2FA TOTP secret'ları ve BillingInfo PII (tc/ssn/ein/taxNo) at-rest şifreleniyor → prod'da anahtar set edilmezse şifreleme garantisi YOK. `JWT_SECRET` için `min(16).required()` varken aynı titizlik gösterilmemiş.
- **Çözüm:** `ENCRYPTION_KEY: Joi.string().length(64).when('NODE_ENV', { is: 'production', then: Joi.required() })`. `crypto.util.getKey()` içinde prod'da geçersiz anahtarda açılışta `throw` (fail-fast). Aynı yaklaşım prod'da `R2_*`/`SMTP_*` için de değerlendirilsin.

#### Y3. CARD ödemesinde mükerrer/askıda transaction — defter tutarsızlığı
- **Önem:** Yüksek
- **Konum:** `src/payments/payments.module.ts:114-131`
- **Neden önemli:** Sipariş oluşurken CARD için `status=PENDING` bir ORDER_PAYMENT yazılıyor; `PaymentsService.confirm` bunu güncellemek yerine YENİ bir `status=SUCCESS` kayıt oluşturuyor. Eski PENDING kayıt sonsuza dek askıda kalıyor (`transaction.update` hiç çağrılmıyor). Her CARD siparişi için biri PENDING biri SUCCESS iki kayıt; transaction listeleri ve denetim mükerrer/yanıltıcı (`revenueMonthly` yalnız SUCCESS saydığı için ciroyu çift saymaz ama listeler mükerrer gösterir).
- **Çözüm:** `confirm()` içinde yeni kayıt yaratmak yerine mevcut PENDING ORDER_PAYMENT'ı (`orderId` ile) `updateMany` ile `status=SUCCESS`'e çek; yoksa oluştur. Alternatif: sipariş oluştururken CARD için hiç transaction yazma, yalnız `confirm`'de yaz.

#### Y4. Admin rol değişimi aidat/membership akışını baypas ediyor
- **Önem:** Yüksek
- **Konum:** `src/admin-users/admin-users.module.ts:121-137`
- **Neden önemli:** `setRole` rolü ve `priceMultiplier`'ı güncelliyor ama `Membership`, `leaderId` ve $30 aidatı hiç ele almıyor. USER → TEAM_MEMBER yapılırsa: 1× fiyata geçer ama aidat alınmaz, lider atanmaz, Membership oluşmaz. Tersine TEAM_MEMBER → USER'da eski `Membership.active=true` kalır (kalıntı). `createStaff`'ta da aynı tutarsızlık var.
- **Çözüm:** `setRole`'de TEAM_MEMBER'a geçişte `leaderId` zorunlu + Membership upsert; TEAM_*'tan çıkışta `Membership.active=false` + `leaderId` temizliği. Rol geçiş mantığı tek serviste (MembershipsService) toplanmalı.

#### Y5. FK ve sık-filtrelenen kolonlarda index yok — sistemik ölçeklenme riski
- **Önem:** Yüksek (Performans boyutunda Kritik)
- **Konum:** `prisma/schema.prisma:337-393` (+ `270-282`, `421-508`)
- **Neden önemli:** PostgreSQL FK kolonlarına otomatik index oluşturmaz; şemada yalnızca 7 `@@index` var (Order'da sadece `[status, boardPosition]`). En sık çalışan sorgular index'siz kolonları kullanıyor: `Order.userId`/`paymentStatus`/`createdAt`/`organizationId`, `Transaction.userId`, `CreditLedger.userId`, `OrderItem.orderId`, `OrderExtra.orderId`, `OrderStatusEvent.orderId`, `Asset.orderId`/`userId`, `EtsyStore.userId`, `Product.materialId`. 10K+ sipariş / 50K+ transaction seviyesinde liste ve sipariş-detay uçları sequential scan'e mahkum.
- **Çözüm:** Migration ile ekle: `Order @@index([userId, createdAt])`, `@@index([organizationId])`, `@@index([paymentStatus, createdAt])`; `OrderItem/OrderExtra/OrderStatusEvent/Asset @@index([orderId])`; `Asset @@index([userId])`; `Transaction @@index([userId, createdAt])` + `@@index([type, status, createdAt])`; `CreditLedger @@index([userId, createdAt])`; `EtsyStore @@index([userId])`; `Product @@index([materialId])`.

#### Y6. Listeleme/export uçlarında pagination yok — sınırsız sorgu
- **Önem:** Yüksek
- **Konum:** `src/orders/orders.service.ts:172` (+ `transactions.module.ts:12,19`, `credits.service.ts:26`, `import-export.module.ts:48`)
- **Neden önemli:** `findAll` ADMIN/PRODUCTION için TÜM siparişleri `items+extras+user` include ile çekiyor; limit/cursor yok. Bayi için de tüm siparişleri sınırsız. 10K sipariş tek response'ta onlarca MB olur, JSON serileştirme event-loop'u bloklar. Aynı sınırsızlık `transactions.listMine/listAll`, `credits.ledger` ve Excel export'larında da var.
- **Çözüm:** Cursor/offset pagination (varsayılan `take=20-50`). Liste görünümünde `items/extras` yerine `_count`; detayları `findOne`'a bırak. Export'larda tarih aralığı zorunlu + ExcelJS streaming writer; büyük export'ları BullMQ job'a al.

#### Y7. Sipariş oluşturmada N+1 sorgu (pricing)
- **Önem:** Yüksek
- **Konum:** `src/pricing/pricing.service.ts:59`
- **Neden önemli:** `quoteOrder` her item için ayrı `product.findUnique`, her extra için ayrı `extraOption.findUnique` çalıştırıyor (N+M sorgu). Katalog cache'li olmasına rağmen pricing doğrudan prisma'ya gidiyor. Çok-kalemli (Etsy toplu) siparişlerde gecikme birikir.
- **Çözüm:** Tüm `productId`/`extraOptionId`'leri tek `findMany({ where:{ id:{ in: ids } } })` ile çek, Map üzerinden hesapla. Tercihen `CatalogService` cache'inden oku → N+M sorgu 2 sorguya iner.

#### Y8. PDF (fatura/etiket) ve XLSX üretimi request thread'inde senkron
- **Önem:** Yüksek
- **Konum:** `src/import-export/import-export.module.ts:47` (+ `invoices.module.ts`, `labels.module.ts`)
- **Neden önemli:** PDFDocument/pdf-lib/bwip-js barkod ve ExcelJS workbook üretimi HTTP handler içinde senkron CPU-yoğun iş yapıyor; Node tek-thread olduğundan eşzamanlı birkaç istek tüm API'yi bloklar. Export uçları sınırsız `findMany` sonrası tüm satırları belleğe alıp Excel'e yazıyor → CPU+RAM patlar.
- **Çözüm:** Export'ları BullMQ job'a taşı (notifications pattern'i); sonucu R2'ye yaz, presigned link/e-posta ile ilet. Tekil PDF üretimi yoğunlukta worker thread'e alınabilir. Export `findMany`'lerine batch/streaming + tarih aralığı zorunluluğu.

#### Y9. 2FA/TOTP doğrulamada zaman penceresi ve brute-force sertleştirmesi yok
- **Önem:** Yüksek
- **Konum:** `src/auth/auth.service.ts:135,167-170` / `src/auth/auth.controller.ts:67-75`
- **Neden önemli:** `authenticator.verify` varsayılan `window=0` (saat kayması toleransı yok — kullanılabilirlik) ve daha önemlisi 2FA kod denemelerinde hız limiti/kilit yok; `/auth/2fa/enable` ve `/auth/2fa/disable`'da `@Throttle` hiç yok, `code` ham `@Body('code')` string. 6 haneli TOTP'ye sınırsız deneme (trust-proxy sorunu nedeniyle login throttle'ı da etkisiz).
- **Çözüm:** `authenticator.options` ile `window:1` + kısa süreli replay engeli; `2fa/enable`/`disable` ve login'in 2FA dalına sıkı per-kullanıcı throttle + ardışık hata sayacı/kilit; `code` alanını DTO ile (Length doğrulamalı) al.

#### Y10. OTP doğrulamada per-kod deneme sayacı yok
- **Önem:** Yüksek
- **Konum:** `src/auth/auth.service.ts:60-71` / `prisma/schema.prisma:208-218`
- **Neden önemli:** `verifyEmail` her seferinde en son tüketilmemiş OTP'yi bcrypt.compare ile karşılaştırıyor; kodda `failedAttempts/maxAttempts` yok, yanlış denemede kod geçersiz kılınmıyor. Tek koruma `/auth/verify-email` 5/dk throttle (trust-proxy nedeniyle zayıf). 6 haneli kod + 10 dk geçerlilik ile throttle etkisizleştiğinde brute-force mümkün.
- **Çözüm:** `OtpCode`'a `attempts` sayacı ekle, belirli yanlış denemeden sonra kodu consume/iptal et; aynı e-posta için aktif OTP üretimini sınırla. trust-proxy düzeltilmeli ki throttle IP başına çalışsın.

#### Y11. Global guard zinciri AppModule yerine AuthModule içinde — sıra modül import'una bağımlı
- **Önem:** Yüksek
- **Konum:** `src/auth/auth.module.ts:31-33`
- **Neden önemli:** `JwtAuthGuard/RolesGuard/PermissionsGuard` `APP_GUARD` olarak AuthModule'de, `ThrottlerGuard` ayrıca AppModule'de kayıtlı. NestJS çoklu modüldeki `APP_GUARD` sırasını modül import sırasına göre belirler; şu an çalışıyor ama kırılgan. ThrottlerGuard ile auth guard'larının göreli sırası (rate-limit JWT'den önce mi sonra mı) net değil.
- **Çözüm:** Dört `APP_GUARD`'ı tek yerde (AppModule.providers) ve istenen sırada (`ThrottlerGuard, JwtAuthGuard, RolesGuard, PermissionsGuard`) tanımla; auth guard'larını AuthModule'den çıkar. Davranış import sırasından bağımsızlaşsın.

#### Y12. Hata izleme (Sentry) ve metrik/observability altyapısı yok
- **Önem:** Yüksek
- **Konum:** `src/common/filters/all-exceptions.filter.ts:47` / `src/health.controller.ts:11`
- **Neden önemli:** Sentry/OpenTelemetry/prom-client yok. Prod'da 5xx'ler yalnız journald'e düz metin; alarm/aggregation/trend yok. `/metrics` yok, readiness probe yok (health yalnız DB; Redis/R2 yok), BullMQ failed job derinliği görünmez. Prod'da sorunda kör uçulur.
- **Çözüm:** `@sentry/node` entegre et (DSN env, prod'da aktif); en azından `AllExceptionsFilter` 5xx logundan `Sentry.captureException`. Health'i readiness (Redis ping, kuyruk derinliği) ile genişlet veya `/health/ready` ekle. İsteğe bağlı prom-client `/metrics`.

#### Y13. Graceful shutdown yok — BullMQ worker ve istekler drain edilmiyor
- **Önem:** Yüksek
- **Konum:** `src/main.ts:8` (enableShutdownHooks yok) / `src/prisma/prisma.service.ts:13`
- **Neden önemli:** `app.enableShutdownHooks()` çağrılmıyor; SIGTERM/SIGINT yakalama yok. systemd restart'ta lifecycle hook'ları çalışmaz; BullMQ worker bulk-email job'ını yarıda bırakabilir, Prisma/Redis bağlantıları temiz kapanmaz. Her deploy'da risk tekrar eder.
- **Çözüm:** `main.ts`'te `app.enableShutdownHooks()`; NotificationsProcessor `onModuleDestroy`'da `worker.close()` ile in-flight job'ları bekle; systemd unit'e makul `TimeoutStopSec`.

#### Y14. BullMQ job retry/backoff ve temizleme yapılandırması yok
- **Önem:** Yüksek
- **Konum:** `src/notifications/notifications.module.ts:153` (queue.add), `:238` (registerQueue)
- **Neden önemli:** `queue.add('bulk-email', ...)`'de `attempts/backoff/removeOnComplete/removeOnFail` yok. SMTP geçici hatasında otomatik retry yok (tek deneme, sessiz kayıp); başarısız job'lar Redis'te birikir; tamamlananlar temizlenmediği için Redis belleği şişer.
- **Çözüm:** `defaultJobOptions`: `attempts: 3`, `backoff: { type: 'exponential', delay: 5000 }`, `removeOnComplete: 1000`, `removeOnFail: 5000`. WorkerHost'a `failed`/`error` event log'u ekle.

#### Y15. TenantMiddleware her istekte cache'siz Organization sorgusu atıyor
- **Önem:** Yüksek (Mimari/İş Mantığı'nda Orta; performans etkisi nedeniyle yukarı çekildi)
- **Konum:** `src/tenant/tenant.module.ts:35` (+ `app.module.ts:145` `forRoutes('*')`)
- **Neden önemli:** Subdomain/X-Tenant gelen HER istekte `organization.findUnique` çalışıyor; cache yok ve middleware tüm uçlara bağlı. Çözülen tenant yalnız branding için kullanılıyor (Orders/Files/Catalog'da tenant satır-filtrelemesi YOK — izolasyon yarım). İstek başına ekstra DB round-trip = bağlantı havuzu baskısı + gereksiz latency.
- **Çözüm:** Çözülmüş tenant'ı cache-manager ile slug bazlı cache'le (5-10 dk TTL), org update'inde invalidate et. Orta vadede gerçek izolasyonu Prisma middleware/extension ile `organizationId` scope'una bağla.

#### Y16. JWT doğrulamada kullanıcı durumu (active/role) tazelenmiyor
- **Önem:** Orta→Yüksek sınırında (para/yetki etkisi)
- **Konum:** `src/auth/strategies/jwt.strategy.ts:25`
- **Neden önemli:** `validate()` yalnız payload'ı kopyalıyor, DB'den tazelemiyor. Pasifleştirilen/rolü düşürülen/silinen kullanıcı, JWT (`JWT_EXPIRES_IN=1d`) süresi dolana kadar tam yetkiyle çalışır; ADMIN'den düşürülen biri 1 güne kadar admin kalır.
- **Çözüm:** `validate()`'te kullanıcıyı DB'den (cache ile) çekip `active` kontrolü + rolü DB'den al; pasif/silinmişte `UnauthorizedException`. Alternatif: kısa token + refresh token veya `tokensValidAfter` ile iptal.

> Not: K1-K2 (top-up/upgrade) için ek olarak **org slug self-servis değişimi** (`organizations.controller.ts:40`) ve **mock-login throttle yok** (`auth.controller.ts:45`) orta-seviyeli yetki bulguları aşağıdaki boyut detayında yer alıyor.

---

## 4. Boyut Bazında Detay

### 4.1 Mimari & Modül Yapısı (72)

**Güçlü yönler**
- Global `ValidationPipe` `whitelist+forbidNonWhitelisted+transform` ile doğru (`main.ts:13-20`).
- Paylaşılan altyapı doğru `@Global()`: Prisma/Mail/Audit/Settings.
- Net modül sınırları: OrdersModule → PricingModule explicit import, circular yok (`orders.module.ts:1819-1822`).
- Joi config doğrulaması + prod'da CORS fail-fast (`app.module.ts:43-72`, `main.ts:27-29`).
- Merkezi RBAC matrisi (`permissions.ts`) ve iyi modülerize util'ler (crypto/pdf/pricing).

**Orta/düşük bulgular**

| Bulgu | Önem | Konum |
|---|---|---|
| Modül dosya organizasyonu iki stil arasında tutarsız (tek-dosya vs ayrı dosya) | Orta | `src/notifications/notifications.module.ts:1569` |
| OrderStatus TRANSITIONS iki modülde kopyalanmış (DRY ihlali) | Orta | `src/board/board.module.ts:591-598` |
| TenantMiddleware izolasyonu enforce etmiyor, her istekte ekstra sorgu | Orta | `src/tenant/tenant.module.ts:35` (Y15) |
| İki modül kök `/api` namespace'inde prefix'siz `@Controller()` | Düşük | `src/import-export/import-export.module.ts:200` |
| 2FA enable/disable'da DTO/ValidationPipe devre dışı (`@Body('code')` ham) | Düşük | `src/auth/auth.controller.ts:67-74` |
| TEAM_LEADER ekip üyelerinin siparişlerini göremiyor; `member:read` izni ölü | Düşük | `src/orders/orders.service.ts:238-241` |
| Doküman model/migration sayıları gerçek şemayla uyuşmuyor (22/7 vs 20/6, 15 enum) | Bilgi | `prisma/schema.prisma:1` |

### 4.2 Güvenlik (58)

**Güçlü yönler**
- JWT secret zorunlu+min16, expiry aktif, prod'da CORS wildcard+credentials yasak.
- Parolalar/OTP/recovery bcrypt; 2FA secret + PII (tc/ssn/ein/taxNo/apiKey) AES-256-GCM.
- `SAFE_SELECT` ile `passwordHash`/`twoFactorSecret` sızıntısı engelleniyor; EtsyStore apiKey maskeleniyor.
- Atomik bakiye düşümü + tüm raw SQL parametreli (injection yok).
- IDOR korumaları orders/files/invoices/payments'ta sahiplik kontrolüyle.

**Orta/düşük bulgular** (kritik+yüksekler Bölüm 3'te: K1, K2, Y1, Y2, Y9, Y10)

| Bulgu | Önem | Konum |
|---|---|---|
| mock-login endpoint'inde throttle yok; NODE_ENV yanlışsa şifresiz token | Orta | `src/auth/auth.controller.ts:45-49` |
| Org üyesi firma slug'ını (tenant subdomain) serbestçe değiştirebiliyor | Orta | `src/organizations/organizations.controller.ts:40-44` |
| Güvenlik HTTP başlıkları (helmet) yok; Swagger prod'da açık | Düşük | `src/main.ts:36-49` |
| `safeDecrypt` çözme hatasında şifreli metni olduğu gibi döndürüyor | Düşük | `src/common/crypto.util.ts:36-44` |
| crypto.util dev fallback sessizce zayıf anahtar üretiyor | Düşük | `src/common/crypto.util.ts:5-10` (Y2 ile ilişkili) |

### 4.3 Veri Modeli & Prisma (72)

**Güçlü yönler**
- Tüm parasal alanlar `Decimal(12,2/4)` — FLOAT yok.
- Atomik koşullu UPDATE düşümleri; CreditLedger `delta + balanceAfter` defteri.
- 15 enum tutarlı; migration'lar şemayla birebir; kritik unique kısıtlar yerinde.
- Kanban için `@@index([status, boardPosition])` orderBy ile uyumlu.
- OrderItem'da tam fiyat snapshot'ı (geçmiş sipariş tutarı korunuyor).

**Orta/düşük bulgular** (yüksekler Bölüm 3'te: Y5, ayrıca FK index ve `Order.organizationId` gerçek FK değil)

| Bulgu | Önem | Konum |
|---|---|---|
| `Order.organizationId` gerçek FK değil — referans bütünlüğü açığı | Yüksek | `prisma/schema.prisma:382` |
| `Asset.userId` ilişkisiz ve index'siz serbest alan | Orta | `prisma/schema.prisma:470-492` |
| `leaderId` iki yerde denormalize (User + Membership), senkron riski | Orta | `prisma/schema.prisma:152-153,264` |
| Kanban `boardPosition` benzersizlik/atomiklik garantisi yok | Orta | `src/board/board.module.ts:103-142` |
| Membership renewal/aidat izleme yapısı zayıf (durum alanı + index yok) | Düşük | `prisma/schema.prisma:257-268` |
| `priceMultiplier` türetilebilir veriyi kalıcılaştırıyor (role ile çelişme) | Düşük | `prisma/schema.prisma:139,141` |
| Log alanları (`byUserId`/`actorUserId`/`createdByUserId`) ilişkisiz string — kasıtlı ama yorumsuz | Bilgi | `prisma/schema.prisma:202,408,459` |

### 4.4 İş Mantığı Doğruluğu (62)

**Güçlü yönler**
- Fiyat formülü tam doğru: `sqft=w*h/144`, `sqm=sqft*0.092903`, Wallpaper m² (23×mult), Decal/Wood flat (15/35).
- %40 indirim doğru sırada (önce subtotal+extras+rol çarpanı, sonra toplam üzerinden indirim).
- Atomik bakiye + aidat düşümü; CreditLedger defteri; extra fiyat snapshot'ı.
- Durum makinesi geçiş tablosu katı doğrulanıyor.

**Orta/düşük bulgular** (kritik+yüksekler Bölüm 3'te: K3, Y3, Y4)

| Bulgu | Önem | Konum |
|---|---|---|
| İndirim oranı/aidat/eşik Settings'te yapılandırılabilir ama pricing hardcoded kullanıyor | Orta | `src/pricing/pricing.service.ts:8` |
| Sample extra sabit ölçüsü (20×15) fiyata yansımıyor; alanlar ölü/yanıltıcı | Düşük | `src/pricing/pricing.service.ts:113-130` |
| M² birim fiyat erken yuvarlanıp adetle çarpılıyor — yuvarlama sapması | Düşük | `src/pricing/pricing.service.ts:80-97` |
| Quote ile bakiye düşümü arasında rol/indirim değişim penceresi | Bilgi | `src/orders/orders.service.ts:39-56` |

### 4.5 Kod Kalitesi & Tutarlılık (68)

**Güçlü yönler**
- Para tutarlılığı (Decimal her yerde); atomik düşümler; 68 throw'un neredeyse tamamı tipli NestJS exception.
- AuditService best-effort (log hatası ana işlemi bozmuyor); güvenlik hijyeni (şifreleme/maskeleme).
- TODO/FIXME/HACK yok, ölü kod minimal, tek meşru `console.log` eslint-disable'lı.

**Orta/düşük bulgular** (DRY/index/test bulguları diğer boyutlarla örtüşür — tekilleştirildi)

| Bulgu | Önem | Konum |
|---|---|---|
| Modül dosya yapısı tutarsız; servisler `*.module.ts`'ten import ediliyor (döngü riski) | Orta | `src/audit/audit.module.ts:22`, `src/notifications/notifications.module.ts:53` |
| Fiyat/iş sabitleri merkezi değil; Settings kopyaları ölü | Orta | `src/settings/settings.module.ts:22`, `src/pricing/pricing.service.ts:8` |
| CSV ürün import'u transaction'sız döngüde yazıyor — kısmi import riski | Orta | `src/import-export/import-export.module.ts:174` |
| Birden çok katmanda gevşek `any` ve riskli cast (özellikle `processBulkEmail`) | Düşük | `src/notifications/notifications.module.ts:155`, `src/billing/billing.module.ts:54` |
| tsconfig tam `strict` değil; hiç test yok | Düşük | `tsconfig.json:1` (test → K4) |
| `InitiateUploadDto.mime` opsiyonel ama R2 ContentType/DB'ye yazılıyor | Düşük | `src/files/dto.ts:15` |
| Para yuvarlaması JS float (`Math.round`) üzerinden | Bilgi | `src/pricing/pricing.service.ts:12` |

### 4.6 Performans & Ölçeklenebilirlik (52)

**Güçlü yönler**
- Atomik raw UPDATE düşümleri; R2 presigned multipart (byte'lar sunucuya uğramıyor).
- Katalog cache-manager 5dk TTL + doğru invalidation.
- Reports dashboard `Promise.all` ile 9 sorgu paralel; toplu e-posta BullMQ; OneSignal 2000'lik chunk.
- Redis erişilemezse cache in-memory'e graceful düşüyor.

**Orta/düşük bulgular** (kritik+yüksekler Bölüm 3'te: Y5, Y6, Y7, Y8, Y15)

| Bulgu | Önem | Konum |
|---|---|---|
| `revenueMonthly` tüm ORDER_PAYMENT'ları belleğe çekip JS'te gruplupor | Orta | `src/reports/reports.module.ts:57` |
| OTP/AuditLog/PushLog retention temizliği yok — sınırsız tablo büyümesi | Orta | `src/auth/auth.service.ts:59` |
| `DATABASE_URL`'de connection pool ayarı yok | Orta | `.env.production:10` |
| Kanban board SHIPPED kolonu sınırsız; reorder N round-trip | Düşük | `src/board/board.module.ts:66` |
| Multipart initiate'te ≤1000 parça URL Promise.all ile seri üretiliyor | Düşük | `src/files/files.service.ts:121` |
| order-create'te her istekte ekstra user okuması (balance için makul) | Bilgi | `src/orders/orders.service.ts:40` |

### 4.7 Prod Hazırlığı / Gözlemlenebilirlik / Test (52)

**Güçlü yönler**
- Deploy altyapısı eksiksiz: sertleştirilmiş systemd unit, nginx, GitHub Actions SSH deploy (concurrency guard + fork koruması), doğru sıralı `deploy.sh`.
- İki katmanlı yedek (`backup.sh` + `backup-prod.sh` → R2, retention'lı).
- Atomik finansal düşümler; tüm para `Decimal`; Joi config; gerçek DB health check (`SELECT 1`).
- Auth temelleri: guard zinciri, AllExceptionsFilter prod'da iç detay sızdırmıyor, sıkı `@Throttle`, 2FA TOTP at-rest şifreli + yedek kodlar.

**Orta/düşük bulgular** (kritik+yüksekler Bölüm 3'te: K4, Y2, K3, Y12, Y13, Y14, Y16)

| Bulgu | Önem | Konum |
|---|---|---|
| Yapısal loglama ve request korelasyonu yok | Orta | `src/main.ts:54`, `src/common/filters/all-exceptions.filter.ts:14` |
| Süresi dolmuş OTP temizliği yok (ScheduleModule yok) | Düşük | `src/auth/auth.service.ts:210` |
| Excel/CSV export ve liste uçları sınırsız (take yok) | Düşük | `src/import-export/import-export.module.ts:48` (Y6 ile örtüşür) |
| R2/SMTP prod'da boş bırakılabilir — sessiz işlevsel degrade | Bilgi | `src/app.module.ts:54-79`, `src/mail/mail.service.ts:30` |

---

## 5. Güçlü Yönler (Özet)

Backend'in iyi yapılmış, korunması gereken kararları:

- **Finansal güvenlik temeli:** Tüm parasal alanlar `Decimal(12,2/4)`, bakiye/aidat düşümleri `UPDATE ... WHERE balance >= X` ile gerçekten atomik ve yarış-koşulsuz; CreditLedger çift kayıt defteri (`delta + balanceAfter`); fiyat/extra snapshot'ları geçmiş siparişi koruyor.
- **Fiyat motoru doğruluğu:** inç→sqft→sqm dönüşümü, rol çarpanı ve %40 indirim sırası iş modeliyle birebir tutarlı.
- **Mimari hijyen:** Global `ValidationPipe` + `AllExceptionsFilter`, `@Global()` altyapı modülleri, merkezi RBAC, temiz DI ve circular-free bağımlılık grafiği, tsc'de hatasız derleme.
- **Güvenlik hijyeni:** bcrypt + AES-256-GCM at-rest, `SAFE_SELECT`/maskeleme ile sızıntı engelleme, parametreli raw SQL, IDOR sahiplik kontrolleri, prod'da CORS/mock-login sıkılaştırması.
- **Ölçeklenmeye doğru ilk adımlar:** R2 presigned multipart, katalog cache + invalidation, BullMQ ile bloklamayan toplu e-posta, paralel rapor sorguları.
- **Operasyon temeli:** Sertleştirilmiş systemd + nginx + otomatik SSH deploy, iki katmanlı yedek (R2'ye), Joi config doğrulama, gerçek DB health check.

---

## 6. Önceliklendirilmiş Yol Haritası

Mevcut görev listesiyle ilişkilendirilmiştir (referans verilen #17 testler, #22 Bull Board gibi kalemler işaretlendi). **[YENİ]** = bu denetimde çıkan, mevcut listede olmayabilecek iş kalemi.

### HEMEN (prod öncesi şart — bunlar olmadan canlıya çıkma)

| # | İş Kalemi | İlgili Bulgu | Görev Listesi |
|---|---|---|---|
| 1 | Self-service top-up'ı gerçek ödeme/webhook'a bağla; doğrudan bakiye yazımını ADMIN+webhook'a kısıtla | K1 | **[YENİ]** |
| 2 | TEAM_LEADER terfisini ADMIN onayına al, self-service kapat | K2 | **[YENİ]** |
| 3 | İptal edilen BALANCE siparişinde atomik iade + `REFUNDED` + ters ledger (idempotent) | K3 | **[YENİ]** |
| 4 | `app.set('trust proxy', 1)` + nginx XFF doğrulaması (rate-limit'i gerçekten çalıştırır) | Y1 | **[YENİ]** |
| 5 | `ENCRYPTION_KEY` prod'da Joi ile zorunlu + crypto.util prod fail-fast | Y2 | **[YENİ]** |
| 6 | CARD ödemesinde PENDING transaction'ı `update` et (mükerrer kayıt giderme) | Y3 | **[YENİ]** |
| 7 | `app.enableShutdownHooks()` + worker graceful drain | Y13 | **[YENİ]** |
| 8 | Finansal servisler için unit test (pricing/credits/orders/memberships) + CI `npm test` | K4 | **#17 testler** |

### KISA VADE (ilk 2-4 hafta)

| # | İş Kalemi | İlgili Bulgu | Görev Listesi |
|---|---|---|---|
| 9 | FK + sık-filtrelenen kolonlara `@@index` ekle + migration (Order/Transaction/CreditLedger/OrderItem/Asset…) | Y5 | **[YENİ]** |
| 10 | Liste/export uçlarına pagination (orders/transactions/credits) | Y6 | **[YENİ]** |
| 11 | `quoteOrder` N+1 → toplu `findMany`/cache | Y7 | **[YENİ]** |
| 12 | Admin `setRole`'ü membership/aidat/leaderId akışıyla birleştir | Y4 | **[YENİ]** |
| 13 | 2FA + OTP brute-force sertleştirme (throttle + attempts sayacı + `window:1` + DTO) | Y9, Y10 | **[YENİ]** |
| 14 | Sentry/error tracking + 5xx capture + readiness probe | Y12 | **[YENİ]** |
| 15 | BullMQ `defaultJobOptions` (attempts/backoff/removeOn*) + failed event log | Y14 | **[YENİ]** |
| 16 | BullMQ kuyruk görünürlüğü (Bull Board) | Y14, Y12 | **#22 Bull Board** |
| 17 | Tüm `APP_GUARD`'ları tek yerde + istenen sırada topla | Y11 | **[YENİ]** |
| 18 | JWT `validate()`'te active/role tazeleme (cache'li) veya token-version | Y16 | **[YENİ]** |
| 19 | TenantMiddleware sonucu cache'le | Y15 | **[YENİ]** |
| 20 | mock-login'i prod'dan ayır/throttle; org slug self-servis değişimini kısıtla; helmet + Swagger prod kapat | Güvenlik (orta) | **[YENİ]** |

### ORTA VADE (1-3 ay)

| # | İş Kalemi | İlgili Bulgu | Görev Listesi |
|---|---|---|---|
| 21 | Senkron PDF/XLSX üretimini BullMQ job + R2 link'e taşı; export'lara streaming + tarih aralığı | Y8 | **[YENİ]** |
| 22 | Pricing/credits/memberships'i SettingsService'ten besle (yapılandırılabilir oran/aidat/eşik) | İş Mantığı (orta) | **[YENİ]** |
| 23 | TRANSITIONS + durum geçişini ortak servise topla (DRY) | Mimari/Kod (orta) | **[YENİ]** |
| 24 | Fiyat sabitlerini tek kaynağa indir (Settings kopyalarını sil veya bağla) | Kod (orta) | **[YENİ]** |
| 25 | `Order.organizationId`/`Asset.userId` gerçek FK'ye çevir; `leaderId` tek kaynak | Veri Modeli (yüksek/orta) | **[YENİ]** |
| 26 | `@nestjs/schedule` ile OTP/AuditLog/PushLog retention cron'u | Performans (orta) | **[YENİ]** |
| 27 | `DATABASE_URL` connection pool ayarı; `revenueMonthly` DB-tarafı aggregate | Performans (orta) | **[YENİ]** |
| 28 | Gerçek multi-tenant izolasyonu (Prisma middleware/extension ile `organizationId` scope) | Mimari (orta) | **[YENİ]** |
| 29 | Yapısal/korelasyonlu loglama (pino + x-request-id); modül dosya konvansiyonunu standardize et + `tsconfig strict` | Kod/Prod (orta-düşük) | **[YENİ]** |
| 30 | CSV import atomikliği; `mime` zorunlu; Sample sabit-ölçü netleştir; yuvarlama düzelt | Çeşitli (düşük) | **[YENİ]** |

---

## 7. Sonuç

"Ortak Doku" Faz 1 backend'i, **doğru mimari ve finansal kararlarla kurulmuş ama prod-sertleştirmesi yarım kalmış** bir projedir. En güçlü yanı para katmanı (Decimal + atomik düşüm + ledger) ve mimari hijyendir; bu temel, üzerine güvenle inşa edilebilir niteliktedir.

Ne var ki **prod'a çıkış üç kategoride bloklanmıştır:** (1) doğrudan parasal istismar açıkları (top-up, leader-upgrade, iade yokluğu, CARD mükerrer kayıt), (2) etkisiz hale gelmiş rate-limit ve sertleştirilmemiş 2FA/OTP nedeniyle gerçek brute-force/abuse yüzeyi, (3) sıfır test + sıfır gözlemlenebilirlik nedeniyle "kör uçuş". Bunlara sistemik index/pagination borcu eklendiğinde, mevcut kod ilk birkaç bin kullanıcıda hem güvenlik hem performans açısından zorlanır.

**Öneri:** Bölüm 6'daki "HEMEN" listesindeki 8 kalem (özellikle K1-K4 + trust proxy + ENCRYPTION_KEY + graceful shutdown) prod öncesi **zorunlu kabul edilmeli**; bunlar tamamlandığında backend, kontrollü bir beta için yeterli olgunluğa ulaşır. Kısa vade kalemleri ölçeklenme ve operasyonel dayanıklılığı, orta vade kalemleri ise sürdürülebilir bakım ve gerçek çok-kiracılı büyümeyi güvence altına alır.

Genel değerlendirme: **~61/100 — sağlam temel, hedeflenmiş bir prod-sertleştirme turuyla hızla yükselebilir.**
