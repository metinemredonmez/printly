# Ortak Doku Backend — Endpoint Test & Denetim Raporu

## 1. Yönetici Özeti

Bu rapor, "Ortak Doku" (printy) NestJS backend'inin **7 domain'inde** yapılan canlı endpoint testleri ve eşlik eden kod denetiminin sonuçlarını sentezler. Testler `http://localhost:3001/api` üzerinde, gerçek HTTP çağrılarıyla (taze kullanıcılar, mock-login, admin ön-veri kurulumu) yürütülmüştür.

**Genel sonuç:**

| Metrik | Değer |
|---|---|
| Test edilen endpoint | **72** |
| Geçen (pass) | **67** |
| Kalan (fail) | **4** |
| Atlanan (skipped) | **1** |

Fonksiyonel iskelet sağlamdır: JWT + Roles + Permissions global guard zinciri her domain'de tutarlı çalışıyor (tokensiz → 401, yetkisiz rol → 403, geçerli istek → 2xx, geçersiz body/enum/fazla alan → 400, throttle → 429). ValidationPipe whitelist + forbidNonWhitelisted rol-enjeksiyonunu engelliyor. IDOR koruması (orders, invoices, files, etsy-stores, credits/transactions) büyük ölçüde doğru. At-rest şifreleme (billing TC/SSN/EIN, etsy apiKey, 2FA secret) DB'de doğrulandı. Hassas alanlar (passwordHash, twoFactorSecret, recoveryCodes) admin uçları ve export'larda sızmıyor.

**Ancak iş-mantığı ve güvenlik katmanında prod'u durduran ciddi açıklar var.** En kritik 5 sorun:

1. **[KRİTİK] Ödemesiz sınırsız bakiye + kalıcı %40 indirim (K1)** — `POST /credits/me/topup` hiçbir ödeme gateway'i çağırmadan bakiyeyi artırıyor; amount≥250 ise `hasDiscount40=true`. Canlı: 0→300, indirim açıldı, üst limit yok.
2. **[KRİTİK] Bedelsiz self-servis TEAM_LEADER yükseltmesi (K2)** — `POST /memberships/upgrade {tier:TEAM_LEADER}` herhangi bir USER'ı ücretsiz lider yapıp `priceMultiplier` 2→1 düşürüyor; aynı üründe fiyat $18 → $5.40 (~%70).
3. **[KRİTİK] İptal edilen BALANCE siparişinde iade yok (K3)** — `PATCH /orders/:id/status` CANCELLED geçişinde bakiye iadesi yapmıyor; `paymentStatus` PAID kalıyor, ters ledger yok. Bayinin parası kalıcı yanıyor.
4. **[KRİTİK] `mark-ready` happy-path tamamen kırık** — `POST /files/:assetId/mark-ready` başarılı yolda HER ZAMAN 500 ("Do not know how to serialize a BigInt"). Tek-parça yükleme tamamlama akışı çalışmıyor; complete/abort da aynı latent hataya sahip.
5. **[YÜKSEK] Token revocation yok (stale session)** — `jwt.strategy.ts` payload'ı DB'ye sormadan döndürüyor. Admin bir kullanıcıyı deaktive ettiğinde login 401 olur ama eski token `/me`'de hâlâ 200 döner; deaktive/rolü düşürülen kullanıcı ~1 gün erişime devam eder (canlı kanıtlandı).

Ek olarak: cihaz upsert ile başka kullanıcının cihazını ele geçirme (YÜKSEK), TEAM_MEMBER'ın aidattan kaçışı (YÜKSEK), `@IsBoolean()` bypass ile string "false" kullanıcıyı aktifleştirme (YÜKSEK) ve birden çok yerde ham Prisma 500 + iç dosya yolu sızıntısı tespit edildi.

---

## 2. Sonuç Tablosu (Domain Bazında)

| Domain | Test | Geçen | Kalan | Atlanan |
|---|---:|---:|---:|---:|
| auth | 11 | 10 | 0 | 1 |
| catalog + pricing | 9 | 9 | 0 | 0 |
| orders + board + labels + invoices | 9 | 9 | 0 | 0 |
| credits + memberships + transactions | 9 | 9 | 0 | 0 |
| files + billing + etsy-stores + organizations + tenant | 12 | 9 | 3 | 0 |
| notifications + settings + audit | 9 | 9 | 0 | 0 |
| admin-users + reports + import-export + health | 13 | 12 | 1 | 0 |
| **TOPLAM** | **72** | **67** | **4** | **1** |

> Not: "pass" burada endpoint'in beklenen HTTP/auth davranışını gösterdiği anlamına gelir. "pass" işaretli birçok endpoint'te de iş-mantığı/güvenlik bulguları mevcuttur (notlara bakınız); bu bulgular Bölüm 5'te tekilleştirilmiştir.

---

## 3. Başarısız & Dikkat Gerektiren Endpoint'ler

### 3.1 FAIL sonuçları (4 adet — hepsi `files+...` ve `admin-users` domainlerinde)

| # | Method | Path | HTTP | Neden | Çözüm |
|---|---|---|---|---|---|
| 1 | POST | `/files/:assetId/mark-ready` | 500 | **KRİTİK** — Başarılı yolda HER ZAMAN 500. `Asset.sizeBytes` Prisma'da `BigInt`; NestJS `JSON.stringify` BigInt'i serialize edemiyor. Tek-parça yükleme tamamlama akışı tamamen kırık (complete/abort aynı latent hata). IDOR doğru (başkası→403, yok→404). | `files.service.ts:153-156/175-178/190-193` ham Asset dönüşlerini BigInt'siz yap (sizeBytes→Number veya seçili alan), ya da `main.ts`'te global `BigInt.prototype.toJSON` patch ekle. |
| 2 | DELETE | `/etsy-stores/:id` | 200 | **ORTA** — Silme yanıtında ham Prisma kaydı dönüyor; `mask()` bypass edilerek şifreli `apiKey` ciphertext + `userId` sızıyor. (IDOR koruması doğru: başkasınınki→404.) | `EtsyStoresService.remove()` sonucunu `mask()`'ten geçir veya `{id, deleted:true}` minimal yanıt dön. |
| 3 | PATCH | `/organizations/me` | 200/500 | **ORTA** — USER rolü kendi org `slug/theme/name` yazabiliyor; slug HİÇ valide edilmiyor (`'api'`, `'BAD SLUG!!@#'` kabul). `'api'` reserved subdomain'le çakışıyor. Slug çakışmasında P2002 → 500 (409 olmalı). | `slug`'a `@Matches(/^[a-z0-9-]{3,40}$/)` + reserved listesi reddi; PATCH'i org-yöneticisi rolüne kısıtla; P2002→`ConflictException(409)`. |
| 4 | PATCH | `/admin/users/:id/active` | 200 | **YÜKSEK** — `enableImplicitConversion` nedeniyle `@IsBoolean()` bypass. `{active:"false"}` (string) ve `{active:1}` → `active=true` (HTTP 200). Aktiflik/yetki-kritik alanda tehlikeli tip-coercion. Sadece alan eksikse 400. | `enableImplicitConversion`'ı kapat (global etki, ekiple netleştir) VEYA boolean DTO alanlarında `@Transform` ile katı parse + `@IsBoolean`. |

### 3.2 Atlanan (1 adet)

| Method | Path | Neden |
|---|---|---|
| POST | `/auth/verify-email` happy-path (gerçek OTP) | OTP bcrypt-hash'li ve dev-log erişilemediğinden gerçek kod elde edilemedi; DB'ye `codeHash` override denemesi kullanıcının infra-sınırı (shared Postgres'e UPDATE) nedeniyle classifier tarafından reddedildi. Üç negatif dal (yanlış kod, 5-haneli kod, OTP'siz email) ile kod yolu doğrulandı. |

### 3.3 "Pass" ama dikkat gerektiren (gizli 500/davranış) endpoint'leri

Aşağıdaki uçlar auth/HTTP testini geçti ama belirli girdilerde 500 dönüyor veya beklenmedik davranıyor:

| Method | Path | Sorun |
|---|---|---|
| POST | `/api/products` | Geçersiz `materialId` (FK) → ham Prisma 500 (dosya yolu + constraint adı sızıyor). |
| POST | `/api/extras` | Duplicate `code` (unique) → ham Prisma 500. |
| POST | `/api/orders` | Geçersiz `etsyStoreId` → ham FK 500; `category` ürün kategorisiyle çapraz doğrulanmıyor (WOOD sipariş + WALLPAPER ürün → 201). |
| PATCH | `/api/board/reorder` | Yok olan id → ham 500 (transaction kırılıyor); boş items → `{updated:0}` (ArrayMinSize yok). |
| PUT | `/api/settings/:key` | `value` alanı eksikse → 500 + dist kaynak yolu sızıntısı (DTO yok). |
| GET | `/api/audit` | `?take=abc` → NaN → 500; `take=-5` beklenmedik "son N" davranışı. |
| GET | `/api/reports/orders` | `?from=NOTADATE` → 500 (Invalid Date, validasyon yok). |
| POST | `/api/import/products` | Geçersiz `unit`/`materialId` per-row hatasında ham Prisma 500 mesajı (dist mutlak yol) yanıta **koşulsuz** sızıyor (prod'da bile). |

---

## 4. Domain Bazında Endpoint Listesi

### 4.1 auth (10 pass / 1 skipped)

| Method | Path | Rol | HTTP | Sonuç | Not |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | public | 201/409/400 | pass | Duplicate→409 (enumeration); kısa şifre/geçersiz email→400; fazla `role`→400 (rol-enjeksiyon engelli); OTP bcrypt-hash. |
| POST | `/api/auth/verify-email` | public | 400 | pass | Negatif dallar doğrulandı (yanlış kod, 5-haneli, OTP'siz email). |
| POST | `/api/auth/resend-otp` | public | 201/400 | pass | Bilinmeyen→400 (enumeration); zaten doğrulanmış→400; throttle 3/dk (4.→429). |
| POST | `/api/auth/login` | public | 201/401/400 | pass | Doğrulanmamış→401; yanlış şifre/bilinmeyen→aynı generic 401 (iyi); 2FA matrisi tam; throttle 10/dk. |
| POST | `/api/auth/mock-login` | public(dev) | 201/400 | pass | Var olan→201 token (şifresiz/OTP'siz, doğrulanmamış için bile); prod-guard runtime NODE_ENV'e bağlı. |
| GET | `/api/auth/me` | any-auth | 200/401 | pass | alg=none/imza-tampered/expired forge→401; geçerli→200, payload aynen döner (DB'den taze çekmiyor). |
| GET | `/api/auth/permissions` | any-auth | 200 | pass | İzinler token'daki rolden hesaplanıyor (DB'den değil). |
| POST | `/api/auth/2fa/setup` | any-auth | 201/401 | pass | secret+qrDataUrl+otpauthUrl; otplib ile uçtan uca doğrulandı. |
| POST | `/api/auth/2fa/enable` | any-auth | 201/401/400 | pass | Geçerli TOTP→201 + 8 recoveryCode. **UYARI:** isEmailVerified kontrolü yok. |
| POST | `/api/auth/2fa/disable` | any-auth | 201/401/400 | pass | Recovery-kod ile disable çalışıyor; re-enable sonrası eski recovery kod→400 (tek-kullanım doğrulandı). |
| — | `verify-email happy-path` | — | — | skipped | Gerçek OTP elde edilemedi (bkz. 3.2). |

### 4.2 catalog + pricing (9 pass)

| Method | Path | Rol | HTTP | Sonuç | Not |
|---|---|---|---|---|---|
| GET | `/api/materials` | any-auth | 200/401 | pass | Sadece active=true, cache 5dk TTL. |
| POST | `/api/materials` | ADMIN | 201/403/400 | pass | LEADER→403; whitelist çalışıyor. **NOT:** `widthInch:-100` kabul (@Min yok). |
| PATCH | `/api/materials/:id` | ADMIN | 200/404/403 | pass | Geçersiz id→404; LEADER→403. |
| GET | `/api/products` | any-auth | 200 | pass | active=true + material include, cache'li. |
| GET | `/api/products/:id` | any-auth | 200/404 | pass | **NOT:** pasif (active=false) ürünleri de döndürüyor (liste uçlarıyla tutarsız). |
| POST | `/api/products` | ADMIN | 201/403/400/500 | pass | LEADER→403; bad enum/negatif fiyat→400. **Geçersiz materialId→500 ham Prisma.** |
| PATCH | `/api/products/:id` | ADMIN | 200/404/403 | pass | 404 kontrolü var; LEADER→403. |
| GET | `/api/extras` | any-auth | 200 | pass | active=true, cache'li. |
| POST | `/api/extras` | ADMIN | 201/403/400/500 | pass | LEADER→403. **Duplicate code→500 ham Prisma.** |
| DELETE | `/api/extras/:id` | ADMIN | 200/404/403 | pass | Soft delete; idempotent 200. |
| POST | `/api/pricing/quote` | any-auth | 201/401/400/404 | pass | Fiyat matematiği manuel doğrulandı; %40 indirim gerçek akışla teyitlendi. |

### 4.3 orders + board + labels + invoices (9 pass)

| Method | Path | Rol | HTTP | Sonuç | Not |
|---|---|---|---|---|---|
| POST | `/api/orders` | any-auth (order:create) | 201/400/404 | pass | **category çapraz-doğrulanmıyor** (WOOD+WALLPAPER→201); geçersiz etsyStoreId→ham 500 (FK). |
| GET | `/api/orders` | ADMIN/PROD/owner | 200/401 | pass | LEADER yalnız kendi siparişlerini görüyor (scopeFilter doğru). |
| GET | `/api/orders/:id` | owner/ADMIN/PROD | 200/403/404 | pass | Yabancı USER→403 (assertAccess IDOR korumalı). |
| PATCH | `/api/orders/:id/status` | ADMIN/PROD | 200/400/403 | pass | State machine doğru. **CANCELLED'da BALANCE iadesi YOK (K3).** |
| GET | `/api/board` | ADMIN/PROD (board:manage) | 200/401/403 | pass | LEADER→403; kolon yapısı doğru. |
| PATCH | `/api/board/orders/:id/move` | ADMIN/PROD | 200/400/403/404 | pass | Geçersiz geçiş→400; position eksik→400. |
| PATCH | `/api/board/reorder` | ADMIN/PROD | 200/403/500 | pass | Boş items→`{updated:0}` (ArrayMinSize yok); yok olan id→ham 500; status kolonu doğrulanmıyor. |
| GET | `/api/labels/order/:id` | ADMIN/PROD | 200/401/403/404 | pass | USER/LEADER→403; application/pdf, %PDF magic, Code128 barkod doğru. |
| GET | `/api/invoices/order/:id` | owner/ADMIN/PROD | 200/401/403/404 | pass | Yabancı USER→403 (servis-içi ownership); controller'da explicit guard yok. |

### 4.4 credits + memberships + transactions (9 pass)

| Method | Path | Rol | HTTP | Sonuç | Not |
|---|---|---|---|---|---|
| GET | `/api/credits/me` | USER | 200/401 | pass | Bakiye + hasDiscount40; IDOR yok. |
| GET | `/api/credits/me/ledger` | USER | 200/401 | pass | userId scope'lu. |
| POST | `/api/credits/me/topup` | USER | 201/400/401 | pass | **K1:** 300→bakiye 0→300, hasDiscount40 false→true, ÖDEME YOK; üst limit yok. |
| POST | `/api/credits/:userId/topup` | ADMIN | 201/403/400 | pass | USER→403; olmayan userId→400. |
| GET | `/api/memberships/me` | USER | 200/401 | pass | Membership yoksa null. |
| GET | `/api/memberships/leaders` | USER | 200/401 | pass | **Tüm TEAM_LEADER e-postalarını her authenticated kullanıcıya döndürüyor (PII).** |
| POST | `/api/memberships/upgrade` | USER | 201/400/401 | pass | **K2:** TEAM_LEADER→rol USER→LEADER, mult 2→1, BEDELSIZ; TEAM_MEMBER atomik aidat tahsilatı doğru. |
| GET | `/api/transactions/me` | USER | 200/401 | pass | userId scope'lu, IDOR yok. |
| GET | `/api/transactions` | ADMIN | 200/403 | pass | USER→403; RBAC doğru. |

### 4.5 files + billing + etsy-stores + organizations + tenant (9 pass / 3 fail)

| Method | Path | Rol | HTTP | Sonuç | Not |
|---|---|---|---|---|---|
| GET | `/tenant/current` | PUBLIC | 200 | pass | X-Tenant header ile org çözülüyor; geçersiz/reserved slug→null+200. |
| GET | `/billing/me` | any-auth | 200/401 | pass | Hassas alanlar (tc/ssn/ein/taxNo) sahibe **maskesiz düz metin**. |
| PUT | `/billing/me` | any-auth | 200/400 | pass | TR/US upsert çalışıyor; DB'de iv:tag:cipher şifreli; enum-dışı/eksik→400. |
| GET | `/etsy-stores` | any-auth | 200/401 | pass | apiKey maskeli, user-scoped. |
| POST | `/etsy-stores` | any-auth | 201/400 | pass | apiKey DB'de şifreli, dönüş maskeli. |
| DELETE | `/etsy-stores/:id` | any-auth | 200 | **fail** | **Ham kayıt dönüyor → şifreli apiKey + userId sızıyor (mask bypass).** IDOR doğru. |
| GET | `/organizations` | ADMIN | 200/403 | pass | LEADER→403. |
| GET | `/organizations/:id` | ADMIN | 200/403/404 | pass | Olmayan id→404. |
| GET | `/organizations/me` | any-auth | 200/403 | pass | organizationId yoksa→403. |
| PATCH | `/organizations/me` | any-auth | 200/400/500 | **fail** | **USER slug yazabiliyor; slug valide edilmiyor; çakışma→500 (409 olmalı).** |
| POST | `/files/initiate` | any-auth | 201/400/403/404 | pass | Tek-parça presign; boyut/uzantı/IDOR doğrulamaları doğru; multipart S3'te 500 (R2 creds boş—beklenen). |
| POST | `/files/:assetId/mark-ready` | any-auth | 500 | **fail** | **Başarılı yolda HER ZAMAN 500 (BigInt serialize).** IDOR doğru. |

### 4.6 notifications + settings + audit (9 pass)

| Method | Path | Rol | HTTP | Sonuç | Not |
|---|---|---|---|---|---|
| POST | `/api/notifications/devices` | any-auth | 201/401/400 | pass | **Cross-user token ile cihaz sahipsizleştiriliyor (hijack — YÜKSEK).** |
| GET | `/api/notifications/devices` | any-auth | 200/401 | pass | userId+isActive scope'lu, doğru izolasyon. |
| DELETE | `/api/notifications/devices/:id` | any-auth | 200/404/401 | pass | Ownership kontrolü VAR (başkasınınki→404, IDOR yok). |
| POST | `/api/notifications/push` | ADMIN | 201/403/401/400 | pass | OneSignal key yok→graceful FAILED, crash yok; LEADER→403. |
| POST | `/api/notifications/email-bulk` | ADMIN | 201/403/400 | pass | BullMQ'ya gerçekten girdi; worker işledi (sent:2); EMAIL_BULK audit yazıldı—uçtan uca. |
| GET | `/api/notifications/push-logs` | ADMIN | 200/403/401 | pass | Son 100 log; LEADER→403. |
| GET | `/api/settings` | ADMIN | 200/403/401 | pass | DEFAULT_SETTINGS + DB merge; LEADER→403. |
| GET | `/api/settings/:key` | ADMIN | 200 | pass | Olmayan key→404 yerine `{key, value:undefined}` 200 (fallback tasarımı). |
| PUT | `/api/settings/:key` | ADMIN | 200/403/401/500 | pass | **`value` eksikse→500 + dist yol sızıntısı (DTO yok).** |
| GET | `/api/audit` | ADMIN | 200/403/401/500 | pass | **`take=abc`→NaN→500 + dist yol sızıntısı.** |

### 4.7 admin-users + reports + import-export + health (12 pass / 1 fail)

| Method | Path | Rol | HTTP | Sonuç | Not |
|---|---|---|---|---|---|
| GET | `/api/health` | PUBLIC | 200 | pass | `{status:ok, db:up}`, tokensiz erişilebilir. |
| GET | `/api/admin/users` | ADMIN | 401/403/200 | pass | SAFE_SELECT temiz: passwordHash/twoFactorSecret/recoveryCodes SIZMIYOR. |
| GET | `/api/admin/users/:id` | ADMIN | 200/404 | pass | Secret yok; olmayan id→404. |
| POST | `/api/admin/users` | ADMIN | 201/400/409/403 | pass | Duplicate→409; whitelist (balance fazla alan)→400; secret dönmüyor. |
| PATCH | `/api/admin/users/:id/role` | ADMIN | 200/400/404/403 | pass | Rol + priceMultiplier güncelleniyor. |
| PATCH | `/api/admin/users/:id/active` | ADMIN | 200 | **fail** | **`@IsBoolean()` bypass: string "false"/1 → active=true (YÜKSEK).** |
| GET | `/api/reports/dashboard` | ADMIN | 401/403/200 | pass | Aggregate'ler tutarlı (paid 128.24). |
| GET | `/api/reports/revenue` | ADMIN | 200 | pass | Aylık ORDER_PAYMENT+SUCCESS; dashboard ile tutarlı. |
| GET | `/api/reports/dealers` | ADMIN | 200 | pass | **revenue ödeme durumundan bağımsız (205.24 vs paid 128.24); sıralama sipariş SAYISINA göre.** |
| GET | `/api/reports/orders` | ADMIN | 200/500 | pass | **`?from=NOTADATE`→500 (validasyon yok, 400 olmalı).** |
| GET | `/api/export/orders.xlsx` | ADMIN | 200 | pass | Doğru xlsx MIME/Content-Disposition/Length; LEADER→403. |
| GET | `/api/export/users.xlsx` | ADMIN | 200 | pass | bakiye/email/rol var ama passwordHash YOK (güvenli). |
| GET | `/api/export/transactions.xlsx` | ADMIN | 200 | pass | Geçerli xlsx, doğru başlıklar. |
| POST | `/api/import/products` | ADMIN | 201/400/403/401 | pass | Satır-bazlı hata raporu; **geçersiz unit/materialId'de ham Prisma (dist yol) yanıta sızıyor.** |

---

## 5. Kod Denetim Bulguları (Tekilleştirilmiş, Önem Sırasına Göre)

### KRİTİK

| # | Başlık | Konum | Detay & Öneri |
|---|---|---|---|
| C1 | **Ödemesiz sınırsız bakiye + kalıcı %40 indirim (K1)** | `src/credits/credits.controller.ts:27-30`; `src/credits/credits.service.ts:36-90`; `pricing.util.ts:9` | `topUp` gerçek ödeme gateway'i çağırmadan bakiyeyi artırıyor; amount≥250 ($BULK_LOAD_FOR_DISCOUNT)→`hasDiscount40=true`. Üst limit yok (99999999 kabul). **Öneri:** Self-topup'ı gerçek ödeme doğrulamasına (webhook) bağla; balance/hasDiscount40 ödeme onaylanmadan ASLA değişmesin; `hasDiscount40` sunucuda kümülatif ödenen tutara göre hesaplansın; `@Max` ekle. |
| C2 | **Bedelsiz self-servis TEAM_LEADER yükseltmesi (K2)** | `src/memberships/memberships.module.ts:43-144` (özellikle 126-135) | `upgrade(tier:TEAM_LEADER)` ücret/onay/yetki kontrolü olmadan `role=TEAM_LEADER`, `priceMultiplier=1` yapıyor. Fiyat etkisi ~%70 (mult 2→1 + %40). **Öneri:** Lider yükseltmesini iş kuralına (admin onayı/ödeme/davet) bağla; self-servis ücretsiz yükseltmeyi kaldır; priceMultiplier yalnız güvenilir akıştan değişsin. |
| C3 | **İptal edilen BALANCE siparişinde iade yok (K3)** | `src/orders/orders.service.ts:197-235`; `src/board/board.module.ts move()` | `updateStatus` CANCELLED'da yalnız status yazıyor; iade mantığı yok. Canlı: 100→85, iptal sonrası HÂLÂ 85, `paymentStatus` PAID, ters ledger yok. **Öneri:** `$transaction` içinde bakiyeyi geri ekle + ters `creditLedger` + Transaction'ı REFUNDED işaretle + `paymentStatus`'u düzelt. board move CANCELLED'da da uygula. |
| C4 | **`mark-ready`/complete/abort başarılı yanıtta BigInt serialize 500** | `src/files/files.service.ts:153-156, 175-178, 190-193`; `schema.prisma:476` | Raw Asset dönüyor; `sizeBytes` BigInt → `JSON.stringify` patlıyor → 500. Tek-parça tamamlama tamamen kırık. **Öneri:** sizeBytes'i Number'a çevir/seçili alan dön, ya da `main.ts`'te global `BigInt.prototype.toJSON` patch ekle. |

### YÜKSEK

| # | Başlık | Konum | Detay & Öneri |
|---|---|---|---|
| H1 | **Token revocation yok — deaktive/rol-değişimi token'ı geçersiz kılmıyor (stale session)** | `src/auth/strategies/jwt.strategy.ts:26-33`; `src/common/guards/jwt-auth.guard.ts`; `roles.guard.ts:22-23`; `auth.module.ts` (expiresIn 1d) | `validate()` payload'ı DB'ye sormadan döndürüyor; active/rol/2FA yeniden kontrol edilmiyor; tokenVersion/jti yok. Canlı: deaktive sonrası login 401 ama eski token `/me`→200. Rol düşürme de ~1 gün yansımıyor. JWT/DB rol desenkronizasyonu (self-promote sonrası eski token role=USER). **Öneri:** `validate` içinde user'ı DB'den çek, active=false→401, rolü DB'den al; veya tokenVersion/securityStamp; kısa erişim token + refresh. |
| H2 | **Cihaz upsert ile başka kullanıcının cihazı ele geçiriliyor (device hijack)** | `src/notifications/notifications.module.ts:63-69` | `deviceToken` (@unique) üzerinde koşulsuz upsert; mevcut token re-register edilince `userId` yeni çağırana atanıyor. Canlı: leader'in cihazı admin'e geçti, leader'in listesi boşaldı; push hedefleme bozulur. **Öneri:** update dalında userId'yi değiştirme; `findUnique({deviceToken})` ile sahip farklıysa reddet, veya where'i `{deviceToken,userId}` bileşik yap. |
| H3 | **TEAM_MEMBER bedelsiz TEAM_LEADER'a kaçıp aidattan kurtuluyor** | `src/memberships/memberships.module.ts:43-49,126-135` | TEAM_MEMBER (aidat ödemiş) `upgrade {tier:TEAM_LEADER}` ile bedelsiz lider olup leaderId=null, 1x fiyatı koruyor. Mevcut rol/aidat durumu kontrol edilmiyor. **Öneri:** Rol geçiş kuralları ekle; TEAM_MEMBER→TEAM_LEADER self-servis olmasın (admin onayı). |
| H4 | **`@IsBoolean()` bypass — string "false" kullanıcıyı aktifleştiriyor** | `src/main.ts:18` (enableImplicitConversion); `src/admin-users/admin-users.module.ts:56-58` (UpdateActiveDto) | Global `enableImplicitConversion:true`; `{active:"false"}`/`{active:1}` → active=true. Güvenlik-kritik alanda sessiz coercion. **Öneri:** enableImplicitConversion'ı kapat (global etki, ekiple netleştir) veya boolean alanlarda `@Transform` katı parse + `@IsBoolean`. |
| H5 | **Prisma P2002/P2003 hataları 500 + iç detay sızıntısı (catalog)** | `src/catalog/catalog.service.ts:84, 112`; `src/common/filters/all-exceptions.filter.ts:14-58` | `AllExceptionsFilter` Prisma known errors'ı ele almıyor → 500. Dev'de ham mesaj + mutlak dosya yolu + constraint adı sızıyor (geçersiz materialId, duplicate code canlı kanıtlandı). **Öneri:** Global `PrismaExceptionFilter`: P2002→409, P2003/P2025→400/404; 5xx mesajları generic'e indir. |

### ORTA

| # | Başlık | Konum | Detay & Öneri |
|---|---|---|---|
| M1 | **Sipariş `category` ürün kategorisiyle çapraz doğrulanmıyor (data integrity)** | `src/orders/orders.service.ts:78` | `dto.category` olduğu gibi yazılıyor; `computeItem` kategori eşleşmesini kontrol etmiyor. Canlı: WOOD sipariş + WALLPAPER ürün→201. Etiket/fatura/board/raporlama bozulur. **Öneri:** create öncesi her ürün için `product.category === dto.category` doğrula; uyuşmazlıkta BadRequest. |
| M2 | **`settings` PUT `value` eksikse 500 + iç kaynak yolu sızıntısı** | `src/settings/settings.module.ts:82-89 (set:47-62)` | DTO yok → ValidationPipe devrede değil; `value` undefined→Prisma "Argument value is missing"→500 + dist yol. **Öneri:** `SetSettingDto { @IsDefined() value }` ekle (eksik→400). |
| M3 | **`audit ?take` NaN/negatif olunca 500 / beklenmedik davranış** | `src/audit/audit.module.ts:52-53, 70-74` | `parseInt('abc')`→NaN→`Math.min(NaN,500)=NaN`→Prisma 500; `take=-5`→"son N". **Öneri:** Güvenli parse (`Number.isFinite && >0`) veya DTO + `@IsInt/@Min/@Max`. |
| M4 | **DELETE `/etsy-stores/:id` ham kayıt → şifreli apiKey + userId sızıyor** | `src/etsy-stores/etsy-stores.module.ts (remove)` | `delete()` sonucu doğrudan dönüyor; `mask()` bypass. Canlı: apiKey ciphertext + userId döndü. **Öneri:** `mask()`'ten geçir veya `{id, deleted:true}`. |
| M5 | **Organization slug hiç valide edilmiyor (reserved/junk kabul); USER yazabiliyor** | `src/organizations/organizations.controller.ts:15-20, 40-44` | `slug` yalnız `@IsOptional @IsString`. Canlı: `'api'` (reserved subdomain) ve `'BAD SLUG!!@#'` 200. **Öneri:** `@Matches(/^[a-z0-9-]{3,40}$/)` + reserved listesi; PATCH'i org-yöneticisine kısıtla. |
| M6 | **`reports/orders` tarih query'si valide edilmiyor — 500 + iç yol sızıntısı** | `src/reports/reports.module.ts:95-101, 139-143` | Ham string `new Date()`→Invalid Date→Prisma 500; dev'de dist yol görünüyor. **Öneri:** `@IsOptional @IsDateString` DTO; NaN→BadRequest. |
| M7 | **CSV import per-row hatasında ham Prisma (mutlak yol) yanıta KOŞULSUZ sızıyor** | `src/import-export/import-export.module.ts:158, 170, 184-186` | `unit`/`materialId` valide edilmiyor; `e.message` errors[]'e ham konuyor — exception filter'dan geçmediği için prod'da bile maskelenmez. Canlı doğrulandı. **Öneri:** `unit`'i enum ile valide et; catch'te ham mesaj yerine sadeleştirilmiş mesaj, ham metni yalnız logla. |
| M8 | **JWT/DB rol desenkronizasyonu (stale token)** | `src/auth/strategies/jwt.strategy.ts:26-33`; `src/common/guards/roles.guard.ts:22-23` | upgrade/setRole DB'yi değiştiriyor ama eski JWT eski rolü taşıyor; RolesGuard token'a, PricingController DB'ye bakıyor → under/over-privilege. (H1 ile aynı kök neden — birlikte çözülmeli.) **Öneri:** Yetki kararını her istekte DB'den taze rolle ver veya rol değişiminde token geçersizleştir. |

### DÜŞÜK

| # | Başlık | Konum | Detay & Öneri |
|---|---|---|---|
| L1 | **`GET /products/:id` pasif ürünleri döndürüyor** | `src/catalog/catalog.service.ts:74-81` | active filtresi yok; pasif ürün tüm alanlarıyla (fiyat) dönüyor (liste uçlarıyla tutarsız). **Öneri:** tüketici uçlarına active:true filtre / pasif→404. |
| L2 | **Material `widthInch` negatif değer kabul ediyor** | `src/catalog/dto.ts:14, 20` | `@IsInt` var, `@Min` yok; `-100`→201. Üretim/yerleşim hesaplarını bozar. **Öneri:** `@Min(1)`. |
| L3 | **Geçersiz etsyStoreId / reorder id → ham Prisma 500** | `src/board/board.module.ts:133-143`; `src/orders/orders.service.ts:88` | Yok olan id/FK'da 500; status 400/404 olmalı. **Öneri:** ön-doğrulama (findMany count) / P2025→404; etsyStoreId sahiplik kontrolü; `ArrayMinSize(1)`. |
| L4 | **`reorder()` taşınan kartların doğru status kolonunda olduğunu doğrulamıyor** | `src/board/board.module.ts:133-143` | `dto.status` yalnız dönüş değerinde; where `{id}` ile sınırlı → başka kolon/kullanıcı id'leri sessizce taşınır. Board staff-only olduğu için risk düşük. **Öneri:** where'i `{id, status}` yap. |
| L5 | **TEAM_LEADER e-postaları her authenticated kullanıcıya sızıyor (`/memberships/leaders`)** | `src/memberships/memberships.module.ts:34-41, 156-159` | `@Roles` yok; id+fullName+email dönüyor (PII / phishing yüzeyi). **Öneri:** email alanını çıkar (id+fullName yeterli) veya yetkilendir. |
| L6 | **Billing hassas kimlik alanları sahibe maskesiz düz metin** | `src/billing/billing.module.ts (get/decryptRow)` | tc/ssn/ein/taxNo her GET'te tam dönüyor (DB'de şifreli ama API tam açıyor). **Öneri:** GET'te maskeli (son 4 hane); tam değer ayrı uçta. |
| L7 | **slug unique çakışması 500 (409 olmalı)** | `src/organizations/organizations.service.ts:24-32` | P2002 try/catch'siz→500. **Öneri:** P2002→`ConflictException`. |
| L8 | **User enumeration: resend-otp / mock-login / register var-yok sızdırıyor** | `src/auth/auth.service.ts:87, 197, 37` | resend-otp bilinmeyen→400, kayıtlı→201; register duplicate→409. (login doğru: generic 401.) Throttle etkiyi sınırlıyor. **Öneri:** resend-otp'yi nötr 200 dön. |
| L9 | **Doğrulanmamış hesapta 2FA etkinleştirilebiliyor** | `src/auth/auth.service.ts:116-148` | isEmailVerified/active kontrolü yok; doğrulanmamış hesapta 2FA setup→enable çalıştı. **Öneri:** setup/enable başında isEmailVerified=true & active=true doğrula. |
| L10 | **`topUp` amount üst sınırı ve ondalık kontrolü zayıf** | `src/credits/credits.controller.ts:8-10` | yalnız `@Min(1)`; üst limit yok, `1.5` kabul. Decimal(12,2) taşması riski. **Öneri:** `@Max` + 2-ondalık doğrulama (C1'in parçası). |
| L11 | **topDealers: gelir ödeme durumundan bağımsız + yanlış metrikle sıralama** | `src/reports/reports.module.ts:73-92` | `_sum.total` ödenmemiş/iptal dahil (205.24 vs paid 128.24); `orderBy _count desc`→"en çok sipariş" (gelir değil). **Öneri:** `paymentStatus:PAID` (ve status!=CANCELLED) filtresi; sıralamayı `_sum.total`'a çevir veya alan adını netleştir. |
| L12 | **R2_ENDPOINT boşsa SDK AWS'e (s3.auto.amazonaws.com) düşüyor** | `src/files/r2.client.ts:5-15` | Boş endpoint→presign AWS'e gidiyor; multipart 500. Başlangıç guard'ı yok. **Öneri:** açılışta R2_ENDPOINT/BUCKET/creds zorunlu kontrolü (prod fail-fast). |
| L13 | **ENCRYPTION_KEY eksik/bozuksa zayıf dev-fallback anahtarı** | `src/common/crypto.util.ts:5-12`; `src/app.module.ts` (Joi default '') | 64-hex değilse `scryptSync('dev-insecure-key','printy-salt')` sabit anahtarı; prod'da zorunlu değil. Set unutulursa tüm PII/2FA secret öngörülebilir anahtarla "şifrelenir". **Öneri:** prod'da ENCRYPTION_KEY zorunlu (Joi required), yoksa başlatma. |

### BİLGİ

| # | Başlık | Konum | Detay |
|---|---|---|---|
| I1 | **mock-login prod-guard'ı runtime NODE_ENV'e bağlı** | `auth.controller.ts:45-49`; `auth.service.ts:190-199` | Yalnız `NODE_ENV==='production'`→403. Yanlış set (staging/boş) prod'da auth-bypass'a döner. **Öneri:** allowlist (`===development`) / build-time kaldır / ENV flag. |
| I2 | **Simülasyon topup gerçek CARD işlemi gibi audit'e yazılıyor** | `src/credits/credits.service.ts:69-77` | method undefined→default CARD; sahte CARD `BALANCE_LOAD` kaydı denetim izlerini yanıltır. |
| I3 | **settings değerleri audit meta'sına ham yazılıyor** | `src/settings/settings.module.ts:53-60` | İleride secret tutan ayar plaintext loglanır + admin audit GET ile okunur. **Öneri:** hassas key allowlist'i ile maskele/atla. |
| I4 | **Invoices controller'da explicit guard yok (servis-içi ownership güvenli)** | `src/invoices/invoices.module.ts:123-141` | @Roles/@RequirePermission yok; erişim yalnız servis-içi ownership ile. Canlı güvenli ama defense-in-depth için decorator önerilir. |
| I5 | **settings/subTypes JSON alanları şema doğrulamasından geçmiyor** | `src/catalog/dto.ts:15,21,32,43` | `settings`/`subTypes` serbest (Record/unknown); derin/büyük payload kabul. **Öneri:** iç içe DTO + `@ValidateNested`. |
| I6 | **import idempotent değil — id'li satır sessizce yeni create** | `src/import-export/import-export.module.ts:163-195` | Verilen id bulunmazsa yeni cuid; kullanıcı id'si kaybolur; audit entityId'siz. **Öneri:** gerçek upsert veya bulunamayan id'yi hata raporla. |
| I7 | **SEGMENT push'ta segment adı log'a yazılmıyor; failureCount kozmetik yanlış** | `src/notifications/notifications.module.ts:88-92, 117-128` | segment adı persist edilmiyor; 0 alıcıda failureCount=1. **Öneri:** segment adını meta'ya yaz; failureCount'u gerçek hedefe göre hesapla. |
| I8 | **initiate yarım akışta orphan UPLOADING Asset bırakıyor** | `src/files/files.service.ts:94-118` | S3 patlarsa Asset UPLOADING kalıyor, geri alınmıyor. **Öneri:** S3 hatasında Asset'i sil/FAILED; temizlik job'ı. |
| I9 | **Cache invalidation: onlyActive=false varyantı hiç cache'lenmiyor** | `src/catalog/catalog.service.ts:24-40 vb.` | Risk yok; ileride onlyActive=false uca açılırsa anahtara dahil edilmeli. |
| I10 | **(Olumlu) SAFE_SELECT ve export'lar hassas alan sızdırmıyor** | `src/admin-users/admin-users.module.ts:30-45`; `src/import-export/import-export.module.ts:81-109` | passwordHash/twoFactorSecret/recoveryCodes hiçbir yanıtta/export'ta yok. **Öneri:** regresyona karşı test ekle. |

---

## 6. Doğrulanan Kritik Açıklar (Canlı Kanıt)

| Kod | Açık | Canlı senaryo | Gözlemlenen sonuç |
|---|---|---|---|
| **K1** | Ödemesiz bakiye + kalıcı %40 indirim | Taze USER → `POST /credits/me/topup {amount:300}` | Bakiye 0→300, `hasDiscount40` false→**true**, HTTP 201, **hiçbir tahsilat yok**. `{amount:99999999}` da kabul (üst limit yok). |
| **K2** | Bedelsiz TEAM_LEADER yükseltmesi | USER → `POST /memberships/upgrade {tier:TEAM_LEADER}` | Rol USER→TEAM_LEADER, `priceMultiplier` 2→1, monthlyFee 0, HTTP 201, **bakiye değişmedi**. Fiyat etkisi: aynı ürün (WALL_DECAL flat $9, 1 adet) taze USER'da total **$18** → manipüle hesapta **$5.40** (~%70). Self-promoted hesap `/memberships/leaders` listesine de giriyor. |
| **K3** | İptal edilen BALANCE siparişinde iade yok | LEADER bakiye 100$ → 15$'lık BALANCE siparişi (bakiye 85$) → ADMIN RECEIVED→CANCELLED | Bakiye **HÂLÂ 85$** (iade yok), ters creditLedger **yok**, `paymentStatus` **HÂLÂ PAID**. Para kalıcı yanıyor. board move() da aynı. |
| **H1** | Token revocation yok | Kullanıcı oluştur → token al → ADMIN `PATCH /admin/users/:id/active {active:false}` → eski token ile `/me` | Yeni login **401** ama eski token `/me`→**200**. Deaktive/rolü düşürülen kullanıcı ~1 gün (JWT_EXPIRES_IN) erişime devam ediyor. |
| **H2** | Cihaz hijack | ADMIN, leader'in `leader-token-001` cihazını `POST /notifications/devices` ile register | Aynı id/createdAt korunarak `userId` `seed-lider-hakan`→`seed-admin` değişti; leader'in cihaz listesi **boşaldı**. |
| **H4** | `@IsBoolean()` bypass | `PATCH /admin/users/:id/active {active:"false"}` (string) | `active=true` oldu (HTTP 200). `{active:1}` de true. |

Ek olarak email-bulk akışı uçtan uca pozitif doğrulandı: BullMQ kuyruğuna girdi (Redis `bull:notifications:2`), worker işledi (`returnvalue {sent:2}`), completed'a geçti, EMAIL_BULK audit kaydı yazıldı.

---

## 7. Sonuç & Prod-Hazırlık Kanısı

**Genel kanı: Mevcut haliyle PROD'A HAZIR DEĞİL.** Fonksiyonel ve auth/RBAC iskeleti olgun ve tutarlı (67/72 endpoint beklenen davranışı gösterdi, IDOR koruması ve at-rest şifreleme büyük ölçüde doğru), ancak **para ve kimlik katmanında prod'u durduran açıklar** var.

**Prod öncesi MUTLAKA kapatılması gerekenler (release-blocker):**

1. **K1 — Ödeme entegrasyonu.** Self-topup gerçek ödeme doğrulamasına bağlanmadan canlıya çıkılamaz; aksi halde herkes ödemesiz sınırsız bakiye + kalıcı %40 indirim alır.
2. **K2 + H3 — Membership yükseltme iş kuralı.** Self-servis bedelsiz TEAM_LEADER yükseltmesi kaldırılmalı/admin onayına bağlanmalı (fiyat çarpanı suistimali ve aidat kaçışı).
3. **K3 — İptal/iade mantığı.** CANCELLED geçişinde atomik bakiye iadesi + ters ledger + paymentStatus düzeltmesi eklenmeli (finansal veri tutarlılığı).
4. **C4 — `mark-ready` BigInt 500.** Tek-parça yükleme tamamlama akışı şu an tamamen kırık; temel bir kullanıcı akışı çalışmıyor.
5. **H1/M8 — Token revocation.** Deaktive/rol değişimi anında etkili olmalı (DB'den taze doğrulama veya tokenVersion); aksi halde ban/rol-düşürme ~1 gün etkisiz.
6. **H2 — Cihaz hijack.** Upsert'te userId koruması; push hedefleme bütünlüğü ve hesap güvenliği için.
7. **H4 — `@IsBoolean()` bypass.** Güvenlik-kritik `active` alanı tip-coercion'a karşı sertleştirilmeli (global `enableImplicitConversion` kararı ekiple netleştirilmeli — tüm domain'i etkiler).

**İkinci dalga (prod öncesi güçlü tavsiye):**

- Global `PrismaExceptionFilter` (H5, L3, L7, M7) — tüm domain'lerde tekrar eden ham Prisma 500 + dosya yolu sızıntısını tek noktadan kapatır; iç dist yolu sızıntıları (settings PUT, audit take, reports orders, import) güvenlik açısından önemli.
- Girdi validasyonu boşlukları: org slug (M5), tarih query'leri (M6), settings value (M2), audit take (M3), material widthInch (L2), order category çapraz-doğrulama (M1).
- PII minimizasyonu: leader e-postaları (L5), billing maskeleme (L6), etsy DELETE ciphertext sızıntısı (M4).
- Konfig sertleştirme: ENCRYPTION_KEY prod-zorunlu (L13), R2 fail-fast (L12), mock-login allowlist (I1).

**Olumlu yanlar (korunmalı):** SAFE_SELECT/export'larda secret sızmıyor; 2FA yaşam döngüsü ve recovery tek-kullanım sağlam; JWT forge dirençli (alg=none/tampered/expired→401); ValidationPipe whitelist rol-enjeksiyonunu engelliyor; throttle çalışıyor; BullMQ email-bulk uçtan uca; çoğu uçta IDOR/ownership doğru; at-rest şifreleme DB'de doğrulandı.

**Özet:** Mimari ve auth temeli güçlü; eksik olan, **monetizasyon iş-mantığının ödeme/yetki kontrolüne bağlanması, oturum geçersizleştirme ve birkaç serileştirme/validasyon hatasının giderilmesi.** Yukarıdaki 7 release-blocker kapatıldıktan sonra sistem prod adayı olarak yeniden değerlendirilmelidir.
