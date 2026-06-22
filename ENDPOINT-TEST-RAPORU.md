# Ortak Doku Backend — Endpoint Test & Denetim Raporu

## 1. Yönetici Özeti

Bu rapor, Ortak Doku (printy) NestJS backend'inin 7 fonksiyonel domain'inde gerçekleştirilen canlı endpoint testleri ve kod denetiminin sonuçlarını sentezler. Toplam **76 endpoint** test edildi: **73 geçti, 2 kaldı, 1 atlandı**.

**Genel sağlık:** Backend'in kimlik doğrulama ve yetkilendirme temelleri sağlam. Global `JwtAuthGuard` her istekte JWT'yi DB'den taze doğruluyor (deaktivasyon/rol değişimi anında etkili), `RolesGuard` ve `@Roles` kısıtları büyük ölçüde doğru uygulanıyor, IDOR koruması (files, orders, etsy-stores, billing, credits) testlerde tutarlı çalışıyor, `ValidationPipe` whitelist + `forbidNonWhitelisted` çoğu DTO'da aktif. İki önceden bilinen kritik finansal açık (K1: ödemesiz bakiye/indirim; K2: bedelsiz lider yükseltme) canlı testle **KAPATILMIŞ** olarak doğrulandı.

**2 başarısız endpoint** fonksiyonel bug değil, ortamsal: R2 (object storage) yapılandırılmadığı için multipart upload akışı 500 veriyor (aşağıda detay).

**En kritik 5 sorun (öncelik sırasıyla):**

| # | Sorun | Domain | Önem |
|---|-------|--------|------|
| 1 | **2FA downgrade:** `/2fa/setup` aktif 2FA'yı mevcut kod istemeden sessizce devre dışı bırakıyor (oturum token'ı çalan saldırgan kurbanın 2FA'sını sıfırlayabilir) | auth | **YÜKSEK** |
| 2 | **Billing PII maskesiz:** `tc/ssn/ein/taxNo` API yanıtında tam düz metin dönüyor (at-rest şifreli ama response açık) | files/billing | **YÜKSEK** |
| 3 | **M2 ürün fiyatsız oluşturulabiliyor:** quote sessizce $0 dönüyor, canlı DB'de zaten böyle ürün var (finansal kayıp riski) | catalog/pricing | **YÜKSEK** |
| 4 | **order:create/order:read izinleri ölü:** kodda hiç uygulanmıyor, `order:create` izni olmayan PRODUCTION rolü bile sipariş açabiliyor | orders | **YÜKSEK** |
| 5 | **email-bulk eleman tipi doğrulaması yok:** `emails:[123,{x:1}]` kuyruğa girip worker'a sızıyor | notifications | **YÜKSEK** |

Bunlara ek olarak orta seviye sorunlar: recovery-kod tüketiminde TOCTOU yarış koşulu, multipart hatasında orphan Asset kaydı, mark-ready'de upload doğrulaması yok, quote ölçü/adet üst sınırı yok, category/unit/fiyat tutarsızlığı, settings key whitelist yok, import 'unit' validate edilmiyor + path disclosure.

---

## 2. Sonuç Tablosu (Domain Bazında)

| Domain | Test Edilen | Geçen | Kalan | Atlanan |
|--------|:-----------:|:-----:|:-----:|:-------:|
| auth | 11 | 10 | 0 | 1 |
| catalog + pricing | 9 | 9 | 0 | 0 |
| orders + board + labels + invoices | 9 | 9 | 0 | 0 |
| credits + memberships + transactions | 10 | 10 | 0 | 0 |
| files + billing + etsy + organizations + tenant | 15 | 13 | 2 | 0 |
| notifications + settings + audit | 9 | 9 | 0 | 0 |
| admin-users + reports + import-export + health | 13 | 13 | 0 | 0 |
| **TOPLAM** | **76** | **73** | **2** | **1** |

---

## 3. Başarısız & Dikkat Gerektiren Endpoint'ler

### Başarısız (fail) — 2 adet

Her iki başarısızlık da fonksiyonel kod hatası değil; test ortamında **R2/S3 object storage yapılandırılmadığı** için ağa çıkan multipart akışlarının çökmesinden kaynaklanıyor. Sahiplik/yetki mantığı doğru çalışıyor.

| Method | Path | HTTP | Neden | Çözüm |
|--------|------|:----:|-------|-------|
| POST | `/api/files/initiate` (MULTIPART, >15MB) | 500 | R2 yapılandırılmadığı için `CreateMultipartUploadCommand` → `getaddrinfo ENOTFOUND s3.auto.amazonaws.com`. Ayrıca Asset kaydı S3 çağrısından ÖNCE oluşturulduğu için her başarısız multipart'ta **orphan Asset (status UPLOADING)** kalıyor; listeleme/temizleme endpoint'i yok. | S3 `CreateMultipartUpload`'ı `Asset.create`'ten ÖNCE yap; hata durumunda asset'i sil (status FAILED). İç hatayı 502/503'e indir, ham hostname'i sızdırma. |
| POST | `/api/files/complete` (sahip) | 500 | R2 yokluğu nedeniyle S3 `CompleteMultipartUpload` çağrısı çöküyor. Sahiplik kontrolü doğru (sahip-olmayan önce 403, eksik parts 400, olmayan asset 404). | R2 yapılandır; beklenmeyen S3 hatalarını generic 502/503'e map et. |

### Dikkat gerektiren (pass ama önemli not içeren)

| Method | Path | Not |
|--------|------|-----|
| POST | `/api/auth/2fa/setup` | 2FA zaten açıkken tekrar çağrılınca mevcut kod istemeden sessizce `twoFactorEnabled=false` yapıyor (YÜKSEK güvenlik bulgusu). |
| GET/POST | `/api/billing/me` | `tc/ssn/ein/taxNo` yanıtta tam düz metin (maskesiz) dönüyor (YÜKSEK). |
| POST | `/api/products` | M2 ürün fiyatsız oluşturulabiliyor → quote $0 (YÜKSEK). |
| POST/GET | `/api/orders` | `order:create`/`order:read` izinleri kodda uygulanmıyor; PRODUCTION bile sipariş açabiliyor (YÜKSEK). |
| POST | `/api/notifications/email-bulk` | `emails` dizisinde eleman tipi doğrulaması yok; geçersiz alıcı kuyruğa giriyor (YÜKSEK). |
| POST | `/api/files/:assetId/mark-ready` | R2'de objenin varlığı doğrulanmadan ve status-geçiş guard'ı olmadan READY yapıyor. |
| POST | `/api/pricing/quote` | Ölçü/adet üst sınırı yok; 1e9×1e9 inch → ~2.97e16 fiyat döndü. |

---

## 4. Domain Bazında Endpoint Listesi

### 4.1 auth (11 endpoint)

| Method | Path | Rol | HTTP | Sonuç | Not |
|--------|------|-----|------|:-----:|-----|
| POST | /api/auth/register | @Public | 201/409/400 | pass | Duplicate 409, kısa şifre/geçersiz e-posta 400, throttle 5/dk, email lowercase. |
| POST | /api/auth/verify-email | @Public | 400/429 | pass | Hatalı/eksik/5 haneli kod 400, throttle 5. denemede 429 (OTP brute-force koruması). |
| POST | /api/auth/resend-otp | @Public | 201 | pass | Enumeration koruması: kayıtlı/bilinmeyen e-posta için birebir aynı nötr mesaj. Throttle 3/dk. |
| POST | /api/auth/login | @Public | 201/401/400 | pass | Yanlış şifre/bilinmeyen e-posta aynı 401. 2FA tam akış: no-code/yanlış 401, TOTP/recovery 201, recovery tek-kullanımlık. |
| POST | /api/auth/mock-login | @Public (dev-only) | 201/400/403 | pass | Dev'de açık 201; prod'da ForbiddenException (allowlist sadece development/test). |
| GET | /api/auth/me | authenticated | 200/401 | pass | Tokensiz/geçersiz 401; geçerli token DB'den taze userId/email/role/orgId. |
| GET | /api/auth/permissions | authenticated | 200/401 | pass | ADMIN→['*'], TEAM_LEADER→[order:read,create,member:read,credit:topup]. |
| POST | /api/auth/2fa/setup | authenticated | 201/401 | pass | secret+otpauthUrl+qrDataUrl. **Aktif 2FA'yı sessizce devre dışı bırakıyor (bulgu).** |
| POST | /api/auth/2fa/enable | authenticated | 201/400 | pass | Yanlış kod 400, doğru TOTP 201+8 recovery. DTO'suz `@Body('code')` → whitelist bypass. |
| POST | /api/auth/2fa/disable | authenticated | 201/400 | pass | Kapalıyken 400, doğru TOTP ile secret+recovery sıfırlanıyor. |
| POST | /api/auth/verify-email (pozitif OTP) | @Public | — | **skipped** | Gerçek 6-haneli OTP bcrypt-hash'li DB'de; stdout/DB-yazma görev sınırı gereği erişilemedi. Tüm hata dalları + throttle test edildi, pozitif yol kod incelemesiyle doğrulandı. |

### 4.2 catalog + pricing (9 endpoint)

| Method | Path | Rol | HTTP | Sonuç | Not |
|--------|------|-----|------|:-----:|-----|
| GET | /api/materials | auth (any) | 401/200 | pass | listMaterials hep onlyActive=true; onlyActive=false dalı ölü kod. |
| POST | /api/materials | ADMIN | 201/400/403 | pass | USER/LEADER 403. widthInch≤0 → 400. settings doğrulanmıyor. |
| PATCH | /api/materials/:id | ADMIN | 200/404/403 | pass | Geçersiz id 404. active toggle + cache invalidasyonu doğru. |
| GET | /api/products | auth (any) | 401/200 | pass | Pasif ürünler gizli; cache invalidasyonu doğru. |
| GET | /api/products/:id | auth (any) | 200/404/401 | pass | ADMIN bile pasif ürünü GET edemiyor (küçük UX boşluğu). |
| POST | /api/products | ADMIN | 201/400/403 | pass | USER/LEADER/PRODUCTION 403. **M2 fiyatsız oluşturulabiliyor (bulgu).** |
| PATCH | /api/products/:id | ADMIN | 200/404/403 | pass | Admin pasif ürünü de güncelleyebiliyor. |
| GET | /api/extras | auth (any) | 401/200 | pass | Pasif extra'lar gizli. |
| POST | /api/extras | ADMIN | 201/400/409/403 | pass | Duplicate code 409. `fixedWidthInch`'te @Min YOK → negatif kabul (bulgu). |

> Ek test edilen uçlar: `DELETE /api/extras/:id` (soft-delete, idempotent, IDOR korumalı) ve `POST /api/pricing/quote` (tüm rollerde çalıştı). Fiyat motoru manuel doğrulandı: 12×12 wallpaper @23/m² → USER 2×=4.27, LEADER 1×=2.14.

### 4.3 orders + board + labels + invoices (9 endpoint)

| Method | Path | Rol | HTTP | Sonuç | Not |
|--------|------|-----|------|:-----:|-----|
| POST | /api/orders | any auth (guard yok) | 201/400/401/404 | pass | BALANCE atomik düşüm (85→82.86). **order:create izni uygulanmıyor (bulgu).** |
| GET | /api/orders | any auth (scope) | 200/401 | pass | LEADER kendi, ADMIN/PROD hepsi. order:read uygulanmıyor. |
| GET | /api/orders/:id | owner/ADMIN/PROD | 200/403/404 | pass | IDOR korumalı: başkasının 403, sahip 200. |
| PATCH | /api/orders/:id/status | ADMIN+PROD | 200/400/403/404 | pass | State machine eksiksiz; CANCELLED'da K3 iadesi (REFUNDED, bakiye geri). |
| GET | /api/board | ADMIN+PROD | 200/401/403 | pass | 5 kolon kart sayılarıyla; LEADER 403. |
| PATCH | /api/board/orders/:id/move | ADMIN+PROD | 200/400/403/404 | pass | Geçerli geçiş + boardPosition; CANCELLED'a sürükleme K3 iadesi tetikliyor. |
| PATCH | /api/board/reorder | ADMIN+PROD | 200/400/403 | pass | updateMany {id,status} ile sağlam; yabancı/yok id sessizce atlanır. |
| GET | /api/labels/order/:id | ADMIN+PROD | 200/401/403/404 | pass | Geçerli PDF (4266 byte, %PDF-1.7, Code128 barkod). |
| GET | /api/invoices/order/:id | owner/ADMIN/PROD | 200/401/403/404 | pass | Geçerli PDF (1787 byte). IDOR korumalı; BillingInfo PII safeDecrypt. |

### 4.4 credits + memberships + transactions (10 endpoint)

| Method | Path | Rol | HTTP | Sonuç | Not |
|--------|------|-----|------|:-----:|-----|
| GET | /api/credits/me | USER | 200/401 | pass | Sadece kendi bakiyesi, IDOR yok. |
| GET | /api/credits/me/ledger | USER | 200/401 | pass | Kendi ledger kayıtları. |
| POST | /api/credits/me/topup | USER | 201/400/401 | pass | **K1 KANIT:** {amount:300} sadece PENDING üretir, balance 0 kalır. |
| POST | /api/credits/topup/:transactionId/confirm | ADMIN | 201/404/403 | pass | PENDING→SUCCESS, balance 0→300, hasDiscount40 true. Idempotent. |
| POST | /api/credits/:userId/topup | ADMIN | 201/400/403 | pass | Admin anında yükleme; USER/LEADER 403. |
| GET | /api/memberships/me | USER | 200/401 | pass | Kendi membership kaydı. |
| GET | /api/memberships/leaders | USER | 200/401 | pass | Aktif lider listesi sadece id+fullName (PII sızdırmıyor). |
| POST | /api/memberships/upgrade | USER | 201/400/403/401 | pass | **K2 KANIT:** {tier:TEAM_LEADER}→403. TEAM_MEMBER: lider+30 atomik (300→270). |
| POST | /api/memberships/leader/:userId | ADMIN | 201/400/403 | pass | Admin TEAM_LEADER yapar; USER 403. |
| GET | /api/transactions/me + /api/transactions | USER/ADMIN | 200/403/401 | pass | /me kendi (IDOR yok); / sadece ADMIN (USER/LEADER 403). |

### 4.5 files + billing + etsy-stores + organizations + tenant (15 endpoint)

| Method | Path | Rol | HTTP | Sonuç | Not |
|--------|------|-----|------|:-----:|-----|
| POST | /api/files/initiate (single) | USER/owner | 201/400/404 | pass | Presigned PUT; uzantı/boyut/role/orderId validasyonları çalışıyor. |
| POST | /api/files/initiate (multipart) | USER/owner | 500 | **fail** | R2 yok → ENOTFOUND; orphan Asset kalıyor. |
| POST | /api/files/:assetId/mark-ready | USER/ADMIN/owner | 201/403 | pass | **Upload doğrulaması + status guard yok (bulgu).** |
| POST | /api/files/complete | USER/LEADER | 403/500/400/404 | **fail** | Sahiplik doğru; 500 R2 yokluğuna bağlı. |
| POST | /api/files/abort | LEADER | 403 | pass | S3'ten önce sahiplik doğrulanıyor. |
| GET | /api/files/:assetId/download-url | USER/ADMIN/LEADER | 200/403/404 | pass | Presigned GET; IDOR koruması sağlam (ADMIN/PROD kasıtlı erişim). |
| GET | /api/billing/me | USER | 200 | pass | **Hassas alanlar maskesiz düz metin (YÜKSEK bulgu).** |
| PUT | /api/billing/me | USER | 200/400 | pass | At-rest encrypt doğru; country/type enum + whitelist çalışıyor. |
| GET | /api/etsy-stores | USER/ADMIN | 200 | pass | Kullanıcı-scope; apiKey mask() ile gizli. |
| POST | /api/etsy-stores | USER | 201/400 | pass | apiKey encrypt; hasApiKey:true döner. |
| DELETE | /api/etsy-stores/:id | USER/ADMIN/LEADER | 200/404 | pass | IDOR korumalı: başkasınınki 404. |
| GET | /api/organizations | ADMIN | 200/403 | pass | LEADER 403, tokensiz 401. |
| GET | /api/organizations/me | USER/ADMIN | 200/403 | pass | **Org'daki tüm üyelerin email/rolünü düz USER'a açıyor (bulgu).** |
| PATCH | /api/organizations/me | TEAM_LEADER/ADMIN | 200/400/403 | pass | Reserved slug/format doğru; **theme validatörü yok (bulgu).** |
| GET | /api/organizations/:id | ADMIN | 200/403/404 | pass | users dahil; LEADER 403. |
| GET | /api/tenant/current | @Public | 200 | pass | Header'sız null; reserved 'api' null; malformed/5000-char crash yok. |

### 4.6 notifications + settings + audit (9 endpoint)

| Method | Path | Rol | HTTP | Sonuç | Not |
|--------|------|-----|------|:-----:|-----|
| POST | /api/notifications/devices | auth | 201/400/401/403 | pass | Idempotent upsert; hijack koruması (H2) 403. |
| GET | /api/notifications/devices | auth | 200/401 | pass | Sadece kendi aktif cihazları; cross-user sızıntı yok. |
| DELETE | /api/notifications/devices/:id | auth | 200/404/401 | pass | IDOR koruması: başkasınınki 404 (userId-scoped). |
| POST | /api/notifications/push | ADMIN | 201/400/401/403 | pass | OneSignal key yok → graceful FAILED, crash yok; PUSH_SEND audit. |
| POST | /api/notifications/email-bulk | ADMIN | 201/400/401/403 | pass | BullMQ'ya gerçekten kuyruğa giriyor (Redis 6380 doğrulandı). **emails eleman tipi doğrulaması yok (bulgu).** |
| GET | /api/notifications/push-logs | ADMIN | 200/401/403 | pass | Son 100 kayıt desc; LEADER 403. |
| GET | /api/settings | ADMIN | 200/401/403 | pass | DEFAULT_SETTINGS + DB merge. |
| GET | /api/settings/:key | ADMIN | 200/401/403 | pass | Bilinmeyen key → value:undefined + 200 (404 değil). |
| PUT | /api/settings/:key | ADMIN | 200/400/401/403 | pass | Upsert + SETTING_UPDATE audit. **Key whitelist YOK (bulgu).** |

### 4.7 admin-users + reports + import-export + health (13 endpoint)

| Method | Path | Rol | HTTP | Sonuç | Not |
|--------|------|-----|------|:-----:|-----|
| GET | /api/health | PUBLIC | 200 | pass | DB ping ($queryRaw SELECT 1) çalışıyor. |
| GET | /api/admin/users | ADMIN | 200/403/401/400 | pass | SAFE_SELECT: passwordHash/twoFactorSecret SIZMIYOR. |
| GET | /api/admin/users/:id | ADMIN | 200/404 | pass | SAFE_SELECT + _count.orders. |
| POST | /api/admin/users | ADMIN | 201/409/400/403 | pass | Duplicate 409, fazla alan 400, priceMultiplier rol'e göre. |
| PATCH | /api/admin/users/:id/role | ADMIN | 200/400/404 | pass | Rol değişince priceMultiplier yeniden hesaplanıyor. |
| PATCH | /api/admin/users/:id/active | ADMIN | 200/400/403 | pass | number 1 → 400 (truthy coercion engellendi); string "false" kabul (dökümante edilmeli). |
| GET | /api/reports/dashboard | ADMIN | 200/403/401 | pass | orders/revenue/users/production aggregate. |
| GET | /api/reports/revenue | ADMIN | 200 | pass | **dashboard.revenue.paid ile uzlaşmıyor (bulgu).** |
| GET | /api/reports/dealers | ADMIN | 200 | pass | Top 10 bayi, PAID gelir-sıralı. |
| GET | /api/reports/orders | ADMIN | 200/400 | pass | Geçersiz tarih net 400 (Prisma 500 yerine). |
| GET | /api/export/orders.xlsx | ADMIN | 200/403/401 | pass | Geçerli xlsx binary (7759 byte). |
| GET | /api/export/users.xlsx | ADMIN | 200 | pass | passwordHash içermiyor (8457 byte). |
| GET | /api/export/transactions.xlsx | ADMIN | 200 | pass | Geçerli xlsx (8178 byte). |
| POST | /api/import/products | ADMIN | 201/400/403/401 | pass | Satır-bazı created/errors; **unit validate edilmiyor + path disclosure (bulgu).** |

---

## 5. Kod Denetim Bulguları (Birleştirilmiş & Önem Sırasıyla)

### YÜKSEK

| # | Başlık | Konum | Detay & Öneri |
|---|--------|-------|---------------|
| H1 | **2FA downgrade — setup aktif 2FA'yı sessizce devre dışı bırakıyor** | auth.service.ts:127-130 | setupTwoFactor, 2FA açık olsa bile secret'i eziyor ve enabled=false yapıyor; mevcut TOTP/recovery DOĞRULAMASI yok. Canlı reprodüksiyon (test 45): tek setup çağrısı sonrası login no-code 201 oldu. Çalınan oturum token'ı (JWT 1 gün) ile saldırgan kurbanın 2FA'sını sıfırlayabilir/kendi authenticator'ına bağlayabilir. **Öneri:** re-setup'ı yalnız 2FA kapalıyken serbest bırak; veya secret'i geçici alana yazıp enable onaylanana kadar aktif 2FA'yı bozma. |
| H2 | **Billing PII (tc/ssn/ein/taxNo) API'da maskesiz tam düz metin** | billing.module.ts:38-51,61-67 | decryptRow() hassas alanları tam çözüp response'a koyuyor. Canlı (T25/T31): tc=12345678901, ssn=078-05-1120, ein=12-3456789 döndü. At-rest encrypt var ama API ifşası var (etsy apiKey'in aksine maskelenmiyor). **Öneri:** maskeleyen DTO/serializer ekle; ham PII'yi yalnız açık 'reveal' yetkisiyle dön. |
| H3 | **M2 ürün fiyatsız oluşturulabiliyor → quote sessizce $0** | catalog/dto.ts:30-31; pricing.service.ts:80-83; catalog.service.ts:87-93 | basePricePerM2/flatPrice @IsOptional. Fiyatsız WALLPAPER/M2 ürün 201 oldu; quote 100×100×5 → total 0. Canlı DB'de zaten böyle ürün var (WOOD/M2/fiyatsız: cmqpqc8sx002dyr7r9c30hn0t). Siparişe dönerse finansal kayıp. **Öneri:** unit=M2 ise basePricePerM2>0, unit=FLAT ise flatPrice>0 zorunlu kıl; veya computeItem'de fiyat null/0 ise BadRequest fırlat. |
| H4 | **order:create / order:read izinleri tanımlı ama hiç uygulanmıyor** | orders.controller.ts:11-24; permissions.ts:9-17 | POST/GET /orders uçlarında ne @Roles ne @RequirePermission var; sadece global JWT. PRODUCTION rolüne order:create VERİLMEMİŞ ama canlı: PRODUCTION token'ı ile POST /orders → 201 (test #63). İzin haritası yanıltıcı/ölü. **Öneri:** @RequirePermission('order:create'/'order:read') ekle veya izinleri haritadan kaldırıp bilinçli scope-filter'a geç. |
| H5 | **BulkEmailDto.emails/userIds eleman tipi doğrulaması yok → geçersiz alıcı worker'a sızıyor** | notifications.module.ts:49-50,164-176 | Sadece @IsArray var, @IsString({each:true}) yok. Canlı: {emails:[123,{x:1}]} → 400 yerine 201, Redis'e girdi, worker işledi. Üretimde transporter.sendMail({to:123}) çağrılır. (userIds rastlantısal olarak Prisma sorgusunda korunuyor.) **Öneri:** @IsString/@IsEmail({},{each:true}) + @ArrayMaxSize; processBulkEmail'de gönderim öncesi filtrele. |

### ORTA

| # | Başlık | Konum | Detay & Öneri |
|---|--------|-------|---------------|
| M1 | **verifyTwoFactor recovery-kod tüketiminde TOCTOU yarış koşulu** | auth.service.ts:178-191 | Okuma (findUnique) ile yazma (update) atomik değil; aynı recovery kodla eşzamanlı 2 login ikisini de doğrulayabilir, tek-kullanımlık kırılır. **Öneri:** prisma transaction + koşullu updateMany (where has hash) veya version alanı; affected=0 ise reddet. |
| M2 | **Multipart upload R2 olmadan 500 + her hatada orphan Asset** | files.service.ts:94-149 | prisma.asset.create (UPLOADING) S3 çağrısından ÖNCE; hata sonrası orphan kalır, temizleme endpoint'i yok. **Öneri:** S3 çağrısını create'ten önce yap veya hata durumunda asset'i sil (FAILED). |
| M3 | **mark-ready upload doğrulaması ve status-geçiş guard'ı olmadan READY yapıyor** | files.service.ts:151-157 | Sadece sahiplik kontrol ediyor; R2'de objenin varlığını (HeadObject) ve mevcut status'u doğrulamıyor. İstemci hiç PUT yapmadan READY işaretleyebilir; hayali dosyalar üretime gidebilir. **Öneri:** HeadObject ile objeyi+boyutu doğrula; yalnız UPLOADING→READY geçişine izin ver. |
| M4 | **Quote'ta ölçü/adet üst sınırı yok → astronomik fiyat / olası taşma** | pricing.controller.ts:18-23; pricing.service.ts:70-96 | widthInch/heightInch sadece @Min(0); 1e9×1e9 → ~2.97e16 fiyat, 201. Decimal(12,4)'e yazılırsa overflow. **Öneri:** makul @Max (örn. ~600 inch) + quantity @Max ekle. |
| M5 | **category / unit / fiyat tutarsızlığı doğrulanmıyor** | catalog/dto.ts:25-46; catalog.service.ts:87-103; pricing.service.ts:76-84 | WOOD/unit=M2/sadece flatPrice ürün 201 oldu; quote M2 dalında flatPrice yok sayıldı → 0. **Öneri:** category↔unit eşlemesini zorla (WALLPAPER→M2, WALL_DECAL/WOOD→FLAT) ve doğru fiyat alanını şart koş. |
| M6 | **Settings PUT'ta key whitelist yok → keyfi/zararlı anahtar yazılabiliyor** | settings.module.ts (set) | DEFAULT_SETTINGS dışı anahtarlar reddedilmiyor. Canlı: PUT /settings/__proto__ ve /bigKey → 200 (DB'ye yazıldı). getAll prototype kirlenmesini tesadüfen önlüyor ama çöp satırlar + doğrulanmamış değerler kalıyor. **Öneri:** izinli key listesiyle kısıtla, bilinmeyen→400; kritik anahtarlar için değer şeması (discountRate 0..1 vb.). |
| M7 | **Import: 'unit' validate edilmiyor + Prisma hatası iç dosya yolunu sızdırıyor** | import-export.module.ts:158,182-186 | category includes() ile kontrol edilirken unit doğrulanmadan cast ediliyor. unit=BANANA → Prisma patlıyor, yanıtta TAM iç dosya yolu (.../import-export.module.js:190) dönüyor (path disclosure). **Öneri:** unit için de Object.values().includes() kontrolü; catch'te Prisma hatasında generic mesaj dön. |

### DÜŞÜK

| # | Başlık | Konum | Detay & Öneri |
|---|--------|-------|---------------|
| L1 | 2fa enable/disable DTO'suz `@Body('code')` → whitelist bypass | auth.controller.ts:68,73 | {code, evil} → 'evil' reddedilmedi, 201. code için tip/format yok. **Öneri:** Enable2faDto/Disable2faDto (@IsString @Length(6,10)). |
| L2 | Hesap-bazlı OTP deneme kilidi yok; koruma yalnız IP-throttle | auth.service.ts:60-82 | Yanlış kodda sayaç yok; çok-IP/proxy havuzuyla IP-throttle aşılırsa hesap-bazlı tavan yok. **Öneri:** OtpCode'a attemptCount + belirli denemeden sonra consumedAt ile geçersiz kıl. |
| L3 | ExtraOption fixedWidthInch/fixedHeightInch için @Min yok → negatif kabul | catalog/dto.ts:52-53 | fixedWidthInch:-50 → 201, DB'ye -50 yazıldı. **Öneri:** @Min(0). |
| L4 | Rol çarpanı yuvarlamadan önce uygulanıyor → USER ≠ 2×LEADER | pricing.service.ts:80 | 12×12 @23: USER 4.27, LEADER 2.14 → 2×2.14=4.28≠4.27 (1 cent fark). **Öneri:** 1× fiyatı yuvarlayıp çarpanı sonra uygula veya dokümante et. |
| L5 | orderNumber insan-okunur değil (opak cuid) | prisma/schema.prisma:339 | Fatura/etikette 'Sipariş No' uzun cuid basılıyor; takip zor, id ile çift alan gereksiz. **Öneri:** sıralı numara (ORD-2026-000123) veya id kullan. |
| L6 | board move: aynı statüye 'taşıma' state-machine'i atlıyor | board.module.ts:104-124 | toStatus mevcut statüye eşitse boardPosition güncelleniyor, doğrulama yok (terminal kolonlarda dahi). **Öneri:** toStatus'u board kolonlarıyla sınırla. |
| L7 | me/topup ve membership upgrade'de kullanıcı-bazlı rate-limit yok | credits.controller.ts:28-31 | Yalnız global 120/dk IP. Sınırsız PENDING tx birikimi (hafif DoS/gürültü). **Öneri:** sıkı @Throttle veya kullanıcı başına açık PENDING limiti. |
| L8 | Zaten TEAM_MEMBER iken tekrar upgrade → mükerrer 30$ aidat | memberships.module.ts:58-125 | Mevcut rol kontrol edilmiyor; çift-tık ile tekrar 30$ düşer, renewalDate ileri atar. **Öneri:** aktif üye + geçerli renewalDate'te idempotent erken dön. |
| L9 | GET /settings/:key bilinmeyen anahtar 404 yerine value:undefined+200 | settings.module.ts (getOne) | İstemci var/yok ayrımı yapamıyor. **Öneri:** 404 veya {key,value:null,exists:false}. |
| L10 | 500 hataları internal R2/S3 hostname'ini sızdırıyor | files.service.ts:116-118,162-174 | 'getaddrinfo ENOTFOUND s3.auto.amazonaws.com' ham dönüyor. **Öneri:** generic 502/503, ham hata sadece log'a. |
| L11 | organizations/me org'daki tüm kullanıcıların email/rolünü düz USER'a açıyor | organizations.service.ts:21-28; organizations.controller.ts:39-43 | Canlı (T14): düz USER tüm üyelerin email+rol+isim listesini aldı (PII ifşası). **Öneri:** /me için users alanını çıkar veya yalnız LEADER/ADMIN'e göster. |
| L12 | organizations theme alanında tip doğrulaması yok | organizations.controller.ts:24; organizations.service.ts:38-40 | theme'e string/array yazılabildi (200, DB'ye). Frontend obje bekliyor → veri bütünlüğü/render bozulması. **Öneri:** @IsObject() veya nested DTO. |
| L13 | Billing upsert ülke değişince eski ülkeye özgü PII'yi temizlemiyor | billing.module.ts:43-51 | TR→US değişse bile eski tc kalıyor (stale PII). **Öneri:** ülke/tip değişiminde ilgisiz alanları null'la. |
| L14 | Import: 'unit' default fallback ölü kod (`|| ProductUnit.M2` asla çalışmaz) | import-export.module.ts:158 | İç ifade hep truthy non-empty üretir; sondaki `|| M2` tetiklenmez. **Öneri:** tek net ifadeye indir + enum doğrula. |
| L15 | reports/revenue ile dashboard.revenue.paid uzlaşmıyor (~18$ fark) | reports.module.ts:32-33 vs 64-77 | İki farklı 'gelir' tanımı (Order/PAID vs Transaction/SUCCESS). **Öneri:** tek kaynaktan türet veya alan adlarını netleştir. |

### BİLGİ

| # | Başlık | Konum | Not |
|---|--------|-------|-----|
| I1 | register: doğrulanmamış e-posta tekrar kayıtta 409 + enumeration sızıntısı | auth.service.ts:36-37 | 409 e-posta varlığını sızdırıyor (login/resend enumeration korumasıyla tutarsız). İdempotent kayıt veya nötr yanıt değerlendir. |
| I2 | crypto.util / safeDecrypt dev-fallback anahtarı + sessiz bozulma | common/crypto.util.ts:5-10,36-44 | ENCRYPTION_KEY yoksa 'dev-insecure-key' türetiliyor; prod'da enforce edilmiyor. safeDecrypt çözemezse ham ciphertext dönüyor. **Öneri:** prod'da fail-fast; çözülemezse null/hata dön. |
| I3 | subTypes / settings keyfi doğrulanmamış JSON kabul ediyor | catalog/dto.ts:32,15,21 | Admin-only olduğu için risk düşük; __proto__ Prisma/JSON tarafından düşürüldü. Nested DTO + @ValidateNested önerilir. |
| I4 | Pricing quote DB'deki priceMultiplier'a güveniyor (rol yerine) | pricing.controller.ts:53-65 | priceMultiplier setRole/createStaff ile rol-tutarlı set ediliyor; tek kaynak (setRole) korunmalı. |
| I5 | Fatura PDF extras satırında birim fiyat gösterilmiyor (kozmetik) | invoices.module.ts:93-98 | Hesap doğru, sunum tutarsız. |
| I6 | K3 iade akışı doğru ve çift-iadeye kapalı (POZİTİF) | refund.util.ts:31-37 | İade yalnız CANCELLED && BALANCE && PAID; sonra REFUNDED. Bakiye düşümü $executeRaw ile atomik. Değişiklik gerekmiyor. |
| I7 | confirmTopUp ödeme webhook'una değil ADMIN rolüne bağlı | credits.controller.ts:33-41 | Mevcut tasarımda kabul edilebilir; gerçek ödeme entegrasyonunda imzalı webhook'a bağlanmalı. |
| I8 | Transaction listeleri + export endpoint'lerinde sayfalama/limit yok | transactions.module.ts:11-23; import-export.module.ts:48-115 | Veri büyüdükçe bellek/yanıt boyutu. admin-users'ta take:200 var, burada yok. **Öneri:** take+cursor / streaming xlsx. |
| I9 | push-logs tüm adminler arası paylaşımlı (createdByUserId filtresiz) | notifications.module.ts (pushLogs) | Tek-admin'de etkisiz; çok-admin/çok-kiracılı kurulumda targetIds (userId listesi) görünür. |
| I10 | Push/email-bulk içeriği için uzunluk/sanitizasyon sınırı yok | notifications.module.ts; mail.service.ts:66 | ADMIN-only olduğu için yüzey sınırlı; html ham gidiyor, @MaxLength + sanitize önerilir. |
| I11 | PATCH active string "false"/"true" kabulü (vuln değil, bilinçli) | admin-users.module.ts:60-67 | Tehlikeli truthy coercion ENGELLENMİŞ ({active:1}→400); literal string'ler form-data uyumu için kabul. Dökümante edilmeli. |
| I12 | TenantMiddleware her istekte attacker-kontrollü X-Tenant ile unauth DB sorgusu | tenant.module.ts:26-41 | forRoutes('*'), guard'lardan önce; slug-enumerasyon/hafif DoS yüzeyi. **Öneri:** slug'ı regex ön-doğrula, sonuçları kısa süreli cache'le. |

---

## 6. Doğrulanan Kritik Açıklar (K1 / K2)

İki önceden bilinen kritik finansal açık, canlı testle **KAPATILMIŞ** olarak doğrulandı:

| Açık | Test | Sonuç | Durum |
|------|------|-------|:-----:|
| **K1** — Ödemesiz bakiye + kalıcı %40 indirim | Yeni USER ile `POST /credits/me/topup {amount:300}` | Yalnız **PENDING** transaction üretti; balance 0, hasDiscount40 false, ledger boş kaldı. Admin confirm sonrası balance 300 + %40 indirim **atomik ve idempotent** işlendi (ikinci confirm balance'ı değiştirmedi). | ✅ KAPALI |
| **K2** — Bedelsiz TEAM_LEADER + 1× çarpan | USER ile `POST /memberships/upgrade {tier:TEAM_LEADER}` | **403** döndü, rol USER kaldı. Lider yükseltmesi yalnız admin (`/memberships/leader/:userId`, @Roles(ADMIN)). Meşru TEAM_MEMBER yükseltmesi lider+30$ aidatı **atomik** ($executeRaw koşullu UPDATE) düşürdü: 300→270, priceMultiplier 1, leaderId set; yetersiz bakiyede 400 + hiçbir yan etki yok. | ✅ KAPALI |

İlgili pozitif bulgu **K3** (sipariş iptal → bakiye iadesi): hem `updateStatus` hem `board-move` yolundan doğrulandı; bakiye 85→82.86→85 ve 85→81.66→85, ters CreditLedger çiftleri + REFUNDED, çift-iadeye kapalı (CANCELLED terminal). Bakiye düşümü `$executeRaw` ile yarış-koşulsuz.

---

## 7. Sonuç & Prod-Hazırlık Kanısı

**Genel kanı: Backend mimari olarak sağlam ve büyük ölçüde üretime yakın, ancak production'a geçmeden önce kapatılması gereken bir avuç YÜKSEK öncelikli güvenlik/iş-mantığı bulgusu var.**

**Güçlü yönler:**
- Kimlik doğrulama/yetkilendirme temeli güçlü: her istekte DB'den taze JWT doğrulama, tutarlı 401/403/400/404 davranışı, çok sayıda endpoint'te doğrulanan IDOR koruması.
- İki kritik finansal açık (K1, K2) gerçekten kapatılmış; bakiye/aidat/iade işlemleri atomik (`$executeRaw` koşullu UPDATE).
- Hassas alanlar at-rest şifreli; admin export ve user listelerinde passwordHash/2FA secret sızmıyor (SAFE_SELECT doğru).
- State machine, cache invalidasyonu, BullMQ kuyruğu (canlı Redis doğrulaması), PDF/xlsx binary üretimi çalışıyor.

**Production öncesi kapatılması gereken (engelleyici):**
1. **H1** — 2FA downgrade (setup aktif 2FA'yı sessizce kapatıyor).
2. **H2** — Billing PII yanıtta maskesiz düz metin.
3. **H3** — M2 ürün fiyatsız oluşturulabiliyor (canlı DB'de zaten var; quote $0).
4. **H4** — order:create/order:read izinleri uygulanmıyor (RBAC boşluğu).
5. **H5** — email-bulk eleman tipi doğrulaması yok.
6. **Ortam** — R2/S3 yapılandırması (multipart upload tamamen kırık) + orphan Asset temizliği (M2) ve mark-ready upload doğrulaması (M3).

**Yakında ele alınmalı (orta):** TOCTOU recovery-kod yarışı (M1), quote ölçü/adet üst sınırı (M4), category/unit/fiyat tutarsızlığı (M5), settings key whitelist (M6), import unit validasyonu + path disclosure (M7).

**Net değerlendirme:** Fonksiyonel olgunluk yüksek (73/76 pass; 2 fail tamamen ortamsal R2 eksikliği, 1 skip görev-sınırı kaynaklı). Hiçbir testte veri sızıntısı yoluyla parasal manipülasyon, çift-iade veya kritik IDOR bulunmadı. Yukarıdaki 5 YÜKSEK bulgu + R2 yapılandırması giderildiğinde sistem üretim için hazır kabul edilebilir. Mevcut haliyle **"koşullu prod-hazır"** — engelleyici YÜKSEK bulgular kapatılana kadar canlıya alınması önerilmez.
