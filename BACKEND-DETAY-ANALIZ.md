# Backend Detayli Analiz

## 1. Genel Mimari ve Teknoloji

Printy (Ortak Doku) backend'i, **NestJS 10.4.0** üzerine kurulu, TypeScript tabanlı **modüler monolitik** bir uygulamadır. Katmanlı bir mimari benimsenmiştir:

- **Controller katmanı:** HTTP endpoint'leri, yönlendirme ve giriş doğrulaması
- **Service katmanı:** İş mantığı ve Prisma ile veri işlemleri
- **Guard/Decorator katmanı:** Global JWT doğrulaması + rol bazlı erişim kontrolü
- **DTO katmanı:** `class-validator` ile giriş doğrulaması
- **Utility katmanı:** Fiyatlandırma hesaplamaları (`pricing.util`)

**Temel teknoloji yığını:**

| Katman | Teknoloji | Versiyon | Not |
|--------|-----------|----------|-----|
| Framework | NestJS (`@nestjs/common`, `core`, `config`, `swagger`) | 10.4.0 | API prefix `/api`, Swagger `/api/docs` |
| Dil / Runtime | TypeScript / Node.js | 5.5.4 / ≥18.18.0 | |
| ORM | Prisma + `@prisma/client` | 5.22.0 | `schema.prisma`, migrations |
| Veritabanı | PostgreSQL | 16 (Alpine) | Docker port 5433→5432 |
| Cache/Queue | Redis | 7 (Alpine) | Port 6380; Faz 2 BullMQ için hazır, Faz 1'de kullanılmıyor |
| Kimlik | `@nestjs/jwt`, `passport-jwt`, `bcrypt` | 10.2.0 / 4.0.1 / 5.1.1 | Bearer token, şifre + OTP hashleme |
| Depolama | `@aws-sdk/client-s3`, `s3-request-presigner` | 3.700.0 | Cloudflare R2, presigned URL |
| E-posta | `nodemailer` | 6.9.15 | SMTP / dev JSON fallback |
| Doğrulama | `class-validator`, `class-transformer`, `joi` | 0.14.1 / 0.5.1 / 17.13.3 | DTO + ConfigModule validation |

**Global yapılandırma:** API prefix `/api`, Swagger (Bearer auth), env tabanlı CORS, global ValidationPipe (whitelist + forbidNonWhitelisted + transform), global guard zinciri (JWT → Roles, `@Public` hariç).

**Ana akışlar:** Kayıt → OTP e-posta doğrulama → token; sipariş için fiyat teklifi (`/pricing/quote`) → sipariş oluşturma (bakiye düşme + CreditLedger + Transaction + OrderStatusEvent); R2 dosya yükleme (initiate → direkt PUT/multipart → mark-ready/complete → download-url); üyelik yükseltme (aidat tahsili).

---

## 2. Modül ve Endpoint Envanteri

Sistem **15 modül** içerir. Aşağıdaki tablo modülleri ve başlıca endpoint'lerini özetler (tüm endpoint'ler `/api` prefix'i altındadır; "Rol" sütunu erişim kısıtını belirtir).

| Modül | Dizin | HTTP / Path | Rol | Açıklama |
|-------|-------|-------------|-----|----------|
| **Auth** | `src/auth/` | POST `/auth/register` | Public | Kullanıcı oluştur (USER) + OTP gönder |
| | | POST `/auth/verify-email` | Public | OTP doğrula → token |
| | | POST `/auth/resend-otp` | Public | Yeni OTP gönder |
| | | POST `/auth/login` | Public | E-posta + şifre → token |
| | | GET `/auth/me` | JWT | Oturum kullanıcısı bilgileri |
| **Catalog** | `src/catalog/` | GET `/materials` · POST `/materials` · PATCH `/materials/:id` | JWT / ADMIN | Malzeme yönetimi |
| | | GET `/products` · GET `/products/:id` · POST `/products` · PATCH `/products/:id` | JWT / ADMIN | Ürün yönetimi |
| | | GET `/extras` · POST `/extras` · DELETE `/extras/:id` | JWT / ADMIN | Ek seçenek yönetimi |
| **Pricing** | `src/pricing/` | POST `/pricing/quote` | JWT | Fiyat teklifi (inch→cm→m² × multiplier, %40 indirim) |
| **Orders** | `src/orders/` | POST `/orders` | JWT | Sipariş oluştur (Transaction + CreditLedger) |
| | | GET `/orders` · GET `/orders/:id` | JWT | Listele / detay (ADMIN/PRODUCTION tümünü görür) |
| | | PATCH `/orders/:id/status` | ADMIN/PRODUCTION | Durum geçişi + OrderStatusEvent |
| **Files** | `src/files/` | POST `/files/initiate` | JWT | Presigned PUT URL (tek/multipart) |
| | | POST `/files/:assetId/mark-ready` | Public ⚠️ | Tek-parça yükleme tamamla |
| | | POST `/files/complete` · POST `/files/abort` | JWT | Multipart tamamla / iptal |
| | | GET `/files/:assetId/download-url` | Public ⚠️ | Presigned GET URL |
| **Credits** | `src/credits/` | GET `/credits/me` · GET `/credits/me/ledger` · POST `/credits/me/topup` | JWT | Bakiye / defter / yükleme ($250→%40) |
| | | POST `/credits/:userId/topup` | ADMIN | Hedef kullanıcıya yükleme |
| **Transactions** | `src/transactions/` | GET `/transactions/me` · GET `/transactions` | JWT / ADMIN | İşlem geçmişi |
| **Memberships** | `src/memberships/` | GET `/memberships/me` · GET `/memberships/leaders` · POST `/memberships/upgrade` | JWT | Tier yönetimi (aidat tahsili) |
| **Billing** | `src/billing/` | GET `/billing/me` · PUT `/billing/me` | JWT | Fatura bilgileri (TR: TC/vergi no, US: SSN/EIN) |
| **Etsy-Stores** | `src/etsy-stores/` | GET / POST / DELETE `/etsy-stores[/:id]` | JWT | Mağaza bağlantıları (user-scoped) |
| **Organizations** | `src/organizations/` | GET `/organizations` | ADMIN | Tüm firmalar |
| | | GET / PATCH `/organizations/me` | JWT (org bağlı) | Kendi firma profili |
| | | GET `/organizations/:id` | ADMIN | Firma detayı |
| **Mail** | `src/mail/` | (servis) | — | OTP gönderimi (6 hane, 10 dk TTL) |
| **Prisma** | `src/prisma/` | (servis) | — | Global DB singleton |
| **Common** | `src/common/` | (paylaşılan) | — | Decorators (`@Public`, `@Roles`), Guards, `pricing.util` |
| **Health** | `src/health.controller.ts` | GET `/health` | Public | DB durumu probe'u → `{status, db, ts}` |

> **Not:** Notlandırılan `⚠️` işaretli endpoint'ler güvenlik denetiminde sahiplik kontrolü eksikliği nedeniyle riskli bulunmuştur (bkz. Bölüm 4, #1-#2).

---

## 3. Veri Modeli Özeti

Şema **15+ model ve 13 enum** içerir. Merkez varlık `User`'dır.

**Ana varlıklar ve kilit alanlar:**

- **User:** `email` (unique), `passwordHash` (bcrypt), `role` (enum), `priceMultiplier` (USER=2, TEAM_*=1), `balance` Decimal(12,2), `hasDiscount40`, `isEmailVerified`, `active`, self-relation `leaderId` (Üye→Lider), opsiyonel `organizationId`. İlişkiler: orders, createdOrders, etsyStores, billingInfo (1:1), membership (1:1), transactions, creditLedger.
- **Order:** `orderNumber` (unique cuid), `category`, `status`, `paymentStatus`, `paymentMethod`, `source`; tutarlar `subtotal`/`extrasTotal`/`discount40`/`total`/`totalSqm` (Decimal); teslimat `client*` alanları; Etsy/referans `etsyOrderNo`, `quickbooksInvoiceId`, `etsyStoreId`; `userId`, `createdByUserId`, `organizationId`. İlişkiler: items, extras, assets, statusEvents.
- **OrderItem:** `widthInch/heightInch/widthCm/heightCm`, `sqft/sqm` (hesaplanmış), `quantity`, `unitPrice`, `lineTotal`.
- **Asset:** `r2Key` (unique), `originalName`, `mime`, `sizeBytes` (BigInt), `role` (AssetRole), `status`, `lifecycleStage` (HOT/ARCHIVE/PURGED), görsel metadata (`dpi`, `widthPx`, `heightPx`, `checks`), `thumbnailKey`, `uploadId`.
- **Product / Material:** `category`, `unit`, `basePricePerM2` Decimal(12,4) / `flatPrice` Decimal(12,2), `subTypes` JSON; Material: `widthInch`, `settings` JSON.
- **ExtraOption / OrderExtra:** `code` (unique: SHIPPING_BOX/INSTALLATION_KIT/SAMPLE), `price`, `fixedWidthInch/fixedHeightInch`; OrderExtra snapshot tutar.
- **OtpCode:** `email`, `codeHash` (bcrypt), `purpose`, `expiresAt` (10 dk), `consumedAt`; index (email, purpose).
- **BillingInfo (1:1):** `country` (TR/US), `type` (INDIVIDUAL/CORPORATE), TR: `tc/companyTitle/taxOffice/taxNo`, US: `ssn/ein/state`.
- **Membership (1:1):** `tier`, `monthlyFee` ($30 Üye / 0 Lider), `active`, `startedAt`, `renewalDate`, `leaderId`.
- **Transaction:** `type` (BALANCE_LOAD/ORDER_PAYMENT/MEMBERSHIP_FEE), `amount`, `status`, `method`, `orderId`, `note`.
- **CreditLedger:** `delta`, `balanceAfter`, `reason`, `orderId`.

**Enum'lar:** Role, ProductCategory, ProductUnit, OrderStatus, PaymentStatus, PaymentMethod, OrderSource, AssetRole, AssetStatus, LifecycleStage, TransactionType, TransactionStatus, BillingCountry, BillingType, OtpPurpose.

**Sipariş durum makinesi:** `RECEIVED → IN_PRODUCTION → AWAITING_APPROVAL → READY → SHIPPED` (+ `CANCELLED`).

---

## 4. Güvenlik ve Doğruluk Denetimi

Denetimde 20 bulgu tespit edilmiştir. Aşağıda önem sırasına göre konsolide edilmiş risk tablosu yer alır.

| Bulgu | Dosya (satır) | Önem | Öneri |
|-------|---------------|------|-------|
| Dosya indirme (`download-url`) sahiplik kontrolü yok — başka kullanıcının assetId'si tahminle indirilebilir | `src/files/files.controller.ts:35-38` | **Yüksek** | `@CurrentUser` ile asset/order sahipliği veya ADMIN/PRODUCTION rolü doğrula; aksi halde `ForbiddenException` |
| `mark-ready` / `complete` / `abort` sahiplik kontrolü yok — başkasının yüklemesi READY yapılabilir/iptal edilebilir | `src/files/files.controller.ts:17-31` | **Yüksek** | Service'e `authUser` geçir, `asset.userId` eşleşmesini doğrula |
| OTP brute-force / rate-limit yok — 6 haneli kod kaba kuvvetle kırılabilir | `src/auth/auth.controller.ts:19-29` | **Yüksek** | `@nestjs/throttler` ekle (verify ≤5/dk, resend ≤3/dk) |
| OTP `Math.random()` ile üretiliyor (kriptografik değil) | `src/auth/auth.service.ts:106-108` | **Yüksek** | `crypto.randomInt(0,1000000)` + `padStart(6,'0')` |
| Bakiye düşme race condition — kontrol transaction dışında; eşzamanlı siparişler negatif bakiye üretebilir | `src/orders/orders.service.ts:51-55, 62-149` | **Yüksek** | Bakiye kontrolünü `$transaction` içine al; pessimistic lock (`SELECT FOR UPDATE` / raw) değerlendir |
| Dosya boyutu / MIME doğrulaması yok — DoS + zararlı dosya yükleme riski | `src/files/files.service.ts:53-80` | **Yüksek** | `initiate`'te MAX_SIZE (örn. 500MB) + MIME whitelist + `orderId` sahiplik kontrolü |
| `updateStatus` parametre/erişim doğrulaması yetersiz (rol guard var, ek kontrol yok) | `src/orders/orders.controller.ts:28-36` | **Orta** | Order varlığını kontrol et, geçiş tablosunu (`TRANSITIONS`) uygula; net `NotFound`/durum hatası ver |
| Kart ödemesi her zaman "PAID" olarak simüle ediliyor | `src/orders/orders.service.ts:57-60` | **Orta** | Gerçek gateway (Stripe/PayPal/QuickBooks) entegre olana dek CARD'ı PENDING tut |
| Negatif bakiye ihtimali (floating-point yuvarlama) | `src/orders/orders.service.ts:120-125` | **Orta** | Düşüm sonrası `newBalance < 0` kontrolü; Decimal aritmetiği kullan |
| OTP kodu dev log'una plain text yazılıyor | `src/mail/mail.service.ts:42-45` | **Orta** | Prod'da SMTP zorunlu (hata fırlat); dev'de maskeleme |
| JWT payload `role: string` — sahte rol guard mantığını şaşırtabilir | `src/auth/strategies/jwt.strategy.ts:10` | **Orta** | `role: Role` (Prisma enum) tipini kullan |
| CORS boş `CORS_ORIGINS`'te `origin:true` (wildcard) + credentials | `src/main.ts:22-26` | **Orta** | Prod'da boş origin'i yasakla (hata fırlat), açık liste zorla |
| Etsy `apiKey` plain text saklanıyor | `src/etsy-stores/etsy-stores.module.ts:15-24` | **Orta** | API key'i şifrele (crypto) veya güvenli secret store kullan |
| Şifre minimum 8 karakter | `src/auth/dto/register.dto.ts:8-10` | **Düşük** | `@MinLength(12)` + karmaşıklık kuralları |
| Billing hassas alanlar (tc/ssn/ein/taxNo) plain text | `src/billing/billing.module.ts:14-27` | **Düşük** | Hassas kimlik alanlarını şifrele |
| Global exception filter yok — prod'da stack trace sızabilir | `src/*` | **Düşük** | `HttpExceptionFilter` ekle, prod'da mesajı sadeleştir |
| Order numarası `cuid()` (öngörülebilirlik bilgilendirmesi) | `prisma/schema.prisma:294` | **Düşük** | Mevcut yapı güvenli; not amaçlı |

**Öncelikli düzeltme sırası:** (1) Dosya yetki kontrolleri (#1-#2), (2) Rate-limit + güvenli OTP (#3-#4), (3) Bakiye atomicliği (#5), (4) Dosya boyutu/MIME doğrulaması (#6), (5) CORS sertleştirmesi.

---

## 5. Faz 1 Tamamlanma Durumu

✅ **Tamamlananlar (sağlam temel):**
- Rol & kullanıcı modeli (USER 2×, TEAM_MEMBER $30/ay 1×, TEAM_LEADER, ADMIN, PRODUCTION) ve lider hiyerarşisi
- Bakiye + kredi defteri + $250→%40 indirim + aylık $30 aidat tahsili
- Fiyatlandırma motoru (inch→m², Wallpaper m² bazlı, Wall Decal/Wood flat, extras, Sample 20"×15", %40 indirim, canlı `quote`)
- Sipariş 6 adımı (kategori → ürün türü → detay → ödeme → dosya → teslimat) + durum makinesi + OrderStatusEvent
- R2 presigned multipart dosya yükleme + AssetRole (production/mockup/shipping-label)
- OTP e-posta doğrulama
- EtsyStore + BillingInfo (TR/US) + mağaza seçimi + teslimat alanları + Transaction log

⚠️ **Kısmi (model/altyapı var, tam değil):**
- Admin paneli (rol var, CRUD endpoint'leri yok)
- Üretim paneli (PRODUCTION rolü var, dashboard UI yok)
- Kredi kartı ödemesi (seçim var, gateway yok — simüle PAID)
- Dosya yükleme ilerleme çubuğu / resumable (upload-id var, TUS yok, frontend eksik)
- Etsy API tüketimi (enum + alanlar var, fetch worker yok)
- Google Sheets / Drive (planlı, endpoint yok)
- Profil avatarı (fullName/phone var, avatar yok)

❌ **Eksikler:**
- QuickBooks tam entegrasyonu (fatura oluşturma + ödeme linki + webhook)
- Fatura PDF üretimi
- Barkod / kargo etiketi (4×6") üretimi
- Excel/CSV import & export (toplu sipariş, gelir/müşteri raporu)
- Raporlama (gelir, sipariş, kullanıcı bazlı)
- Admin tema/logo/renk ayarları (Settings modeli yok)

Mockup kapsamına göre backend altyapısı işin yaklaşık **%70'ini** karşılamaktadır; mimari Faz 2+ için esnektir.

---

## 6. Teknik Borç ve İyileştirme Önerileri (Öncelikli)

1. **Yetkilendirme tutarlılığı (Yüksek):** Files modülündeki tüm endpoint'lere (download-url, mark-ready, complete, abort) sahiplik/rol kontrolü eklenmeli. `Public` işaretli iki dosya endpoint'i JWT'ye taşınmalı. Bu, en kritik teknik borçtur.
2. **Finansal işlem güvenliği (Yüksek):** Bakiye kontrolü ve düşümü tek `$transaction` içinde, pessimistic lock ile atomik hale getirilmeli; tüm para aritmetiği `Number` yerine Prisma `Decimal` ile yapılmalı (yuvarlama/negatif bakiye riski).
3. **Kimlik doğrulama sertleştirmesi (Yüksek):** `@nestjs/throttler` ile rate-limit; OTP üretimi `crypto.randomInt`; JWT payload tipi `Role` enum; şifre min uzunluğu artırılmalı.
4. **Dosya yükleme validasyonu (Yüksek):** `initiate`'te MAX_SIZE + MIME whitelist + `orderId` sahiplik kontrolü.
5. **Veri gizliliği (Orta):** Etsy `apiKey` ve billing hassas alanları (tc/ssn/ein/taxNo) at-rest şifrelenmeli.
6. **Operasyonel sağlamlık (Orta):** Global `HttpExceptionFilter` (prod'da stack trace gizleme); CORS prod'da boş origin yasağı; dev OTP log maskelemesi/SMTP zorunluluğu.
7. **Ödeme bütünlüğü (Orta):** CARD ödemeleri gerçek gateway gelene dek PENDING kalmalı; "her zaman PAID" simülasyonu prod'a çıkmamalı.
8. **Test & gözlemlenebilirlik (Orta):** Finansal akışlar (sipariş, aidat, topup) için birim/entegrasyon testleri ve denetim (audit) loglaması güçlendirilmeli.

---

## 7. Sonraki Adımlar

**Hemen (güvenlik — sprint 0):**
- Files endpoint yetki kontrolleri (#1-#2) ve iki `Public` endpoint'in JWT'ye taşınması
- `@nestjs/throttler` + `crypto.randomInt` OTP (#3-#4)
- Bakiye işlemini atomik + Decimal'e çevirme (#5, #9)
- Dosya boyutu/MIME/sahiplik doğrulaması (#6)
- CORS sertleştirme + global exception filter (#12, #16)

**Faz 1 tamamlama (2-3 hafta — kritik dört eksik):**
- Admin paneli endpoint'leri (`GET /admin/orders`, `PATCH /admin/orders/:id/status`, kullanıcı yönetimi)
- Barkod & 4×6" kargo etiketi üretimi (PDF template + kütüphane)
- QuickBooks fatura/ödeme linki (minimum: order'da `quickbooksInvoiceId` + ödeme linki + basit durum takibi)
- Excel/CSV toplu import + sipariş/gelir export

**Faz 2+ (orta vade):**
- Etsy API v3 otomatik sipariş çekme worker'ı (Redis/BullMQ zaten hazır)
- Gerçek kart ödeme gateway entegrasyonu + QuickBooks webhook
- Raporlama (gelir/sipariş/kullanıcı), Google Sheets/Drive senkronizasyonu
- Resumable (TUS) yükleme, admin tema/logo ayarları (Settings modeli), profil avatarı
- Hassas alan şifreleme (apiKey, billing) ve kapsamlı test/audit altyapısı