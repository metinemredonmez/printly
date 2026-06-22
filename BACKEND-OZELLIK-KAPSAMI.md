# Backend Özellik Kapsam Spec'i (Ortak Doku)

> Kaynak HTML mockup: `/Users/emre/Desktop/printy/mockup.html`
> Mevcut backend: `/Users/emre/Desktop/printy/backend` (NestJS 10 + Prisma + PostgreSQL + Cloudflare R2 + Redis)
> Tarih: 2026-06-22 · Para birimi: USD · Tüm kurallar mockup JS davranışından çıkarılmıştır.

---

## 1) Özet

**Toplam tespit edilen özellik: 78**

| Durum | Adet | Oran |
|---|---|---|
| ✅ Tam karşılanıyor | 41 | %53 |
| ⚠️ Kısmi karşılanıyor | 18 | %23 |
| ❌ Eksik | 19 | %24 |

**Genel resim:** Backend, mockup iş modelinin çekirdeğini (auth+OTP, fiyatlandırma motoru, sipariş durum makinesi, bakiye/kredi defteri, üyelik, fatura TR/US, Etsy mağaza, R2 dosya yükleme) büyük ölçüde karşılıyor. Üç açık var: (a) **güvenlik açıkları** (kaynak sahipliği, OTP rate-limit, finansal race condition, dosya doğrulama), (b) **operasyonel entegrasyonlar** (Google Sheets/Drive senkronu, gerçek kart gateway, ZIP lookup proxy, kargo etiketi PDF/barkod), (c) **admin/tema yönetimi** (Settings modeli yok). Bu spec her özelliğin backend karşılığını netleştirir ve eksikleri uygulanabilir iş kalemine dönüştürür.

**Faz tanımları:**
- **Sprint-0** = üretime çıkmadan önce kapatılması zorunlu güvenlik kalemleri
- **Faz-1** = mockup'ta var olan ama backend'de eksik/kısmi olan çekirdek işlevler
- **Faz-2** = mockup'ta var ama "nice-to-have" / operasyonel olgunluk

---

## 2) Domain Bazlı Özellik-Kapsam Tabloları

Durum kodları: ✅ tam · ⚠️ kısmi · ❌ eksik. Öncelik: P0 (kritik) · P1 (yüksek) · P2 (orta).

### 2.1 Auth / Üyelik (Kimlik)

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| E-posta+şifre giriş | `performLogin()`, key `ortak_doku_user`, hata "E-posta veya şifre hatalı" | ✅ | `POST /auth/login` → JWT (sub,email,role,orgId) | — | — |
| 2 adımlı kayıt (email+şifre→OTP) | `startEmailVerification()` + `completeRegistration()`, OTP `123456` | ✅ | `POST /auth/register`, `POST /auth/verify-email` | — | — |
| OTP yeniden gönderme | E-posta simülatör popup | ✅ | `POST /auth/resend-otp` | — | — |
| OTP kriptografik üretim | mock sabit kod | ⚠️ | `Math.random()` → `crypto.randomInt`, OtpCode.codeHash | S0 | P0 |
| OTP rate-limit / deneme sayacı | yok (mock) | ❌ | throttler + Redis counter (max 5 yanlış, 5dk TTL, gönderim limiti) | S0 | P0 |
| E-posta doğrulama badge | "E-posta Onaylandı ✅"/"Onay Bekliyor", `isEmailVerified` | ✅ | `User.isEmailVerified` döner | — | — |
| Gerçek e-posta gönderimi | simüle (`noreply@ortakdoku.com`) | ⚠️ | Nodemailer var; prod SMTP/SES + OTP log redaction | S0/F1 | P1 |
| Şifre min uzunluk | min 4 (mock) | ⚠️ | `RegisterDto` min 8 → güçlü policy (8+, karmaşıklık) | S0 | P1 |
| Seed kullanıcılar (admin + 2 lider) | `admin@ortakdoku.com`/admin, Hakan Demir, Elif Şahin | ✅ | `prisma/seed.ts` | — | — |
| Profil tamamlık bloğu (crossover blocker) | `isProfileComplete()` → name+email+phone(+lider) | ⚠️ | FE mantığı; BE'de "profil eksikse sipariş reddi" guard önerilir | F1 | P2 |
| `/auth/me` oturum bilgisi | sidebar/badge render | ✅ | `GET /auth/me` | — | — |
| Şifre sıfırlama akışı | yok (sadece profil içi değiştirme) | ❌ | `POST /auth/forgot`, `POST /auth/reset` + OtpCode.purpose=PASSWORD_RESET | F2 | P2 |

### 2.2 Sipariş (Order Flow — 6 Adım)

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| Kategori seçimi (Wallpaper/Wall Decal/Wood) | `selectCategory()` | ✅ | `Order.category` enum | — | — |
| Adım atlama (Decal/Wood → Step 2 skip) | FE step mantığı | ✅ (FE) | BE'de productType opsiyonel (FLAT için) | — | — |
| Wallpaper ürün tipi (Smooth/Canvas/Traditional) | radio `product_type` | ✅ | `Order.productType` + `Product.subTypes` JSON | — | — |
| Ek opsiyonlar (Box/Kit/Sample) | checkbox `extra_products`, $2.50/$3.00/$2.50 | ✅ | `ExtraOption` (SHIPPING_BOX/INSTALLATION_KIT/SAMPLE), `OrderExtra` snapshot | — | — |
| Sample ölçü kilitleme (20"×15") | `toggleSampleMode()` readonly | ⚠️ | FE kilit var; BE'de "Sample seçiliyse dims=20×15" doğrulaması ekle | F1 | P1 |
| Genişlik/Yükseklik + m² hesap | `calculateAreaAndPrice()` (÷144 ×0.092903) | ✅ | `OrderItem.widthInch/heightInch/sqm`, pricing.util | — | — |
| Etsy sipariş no + tarih | `order_etsy_no`, `order_date` | ✅ | `Order.etsyOrderNo`, `Order.orderDate` | — | — |
| Etsy no uniqueness/format | yok | ❌ | (mağaza+etsyNo) unique index + format doğrulama | F2 | P2 |
| Mağaza seçimi (dropdown) | `order_store_select`, no-store alert | ✅ | `Order.etsyStoreId` | — | — |
| Ödeme yöntemi seçimi (Bakiye/Kart) | `selectPaymentMethod()` | ✅ | `Order.paymentMethod` BALANCE/CARD | — | — |
| Fatura özeti (base/extras/discount/total) | `bill-*` elemanları | ✅ | `POST /pricing/quote` | — | — |
| Tasarım dosyaları (production+mockup) | `file_production`,`file_mockup` zorunlu | ✅ | `Asset` role=PRODUCTION/MOCKUP | — | — |
| Teslimat bilgileri (client*) | Adım 6 form alanları | ✅ | `Order.client*` alanları | — | — |
| ZIP → şehir/eyalet auto-fill | `triggerZipLookup()` zippopotam.us (FE direkt) | ⚠️ | BE proxy `GET /geo/zip-lookup?country&zip` (SSRF/timeout/cache) | F1/F2 | P2 |
| Kargo etiketi yükleme | `file_shipping_label` zorunlu | ✅ | `Asset` role=SHIPPING_LABEL | — | — |
| Sipariş oluşturma + bakiye tahsili | `submitOrderForm()` | ✅ (race riski) | `POST /orders` → Transaction + CreditLedger | — | — |
| Sipariş durum makinesi | mockup'ta yok (sadece create) | ✅ | `PATCH /orders/:id/status`, OrderStatusEvent | — | — |
| Sipariş listeleme/detay | mockup'ta yok | ✅ | `GET /orders`, `GET /orders/:id` | — | — |
| Yetersiz bakiye reddi | "Yetersiz bakiye!" mesajı | ✅ | orders.service kontrol | — | — |

### 2.3 Fiyat / Ödeme / Bakiye (Finansal)

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| Rol bazlı çarpan (User 2x / Team 1x) | `multiplier = isUser?2:1` | ✅ | `User.priceMultiplier`, pricing.util | — | — |
| Wallpaper $23/m² | `sqm×23×mult` | ✅ | `Product.basePricePerM2` | — | — |
| Wall Decal $15 flat | `15×mult` | ✅ | `Product.flatPrice` | — | — |
| Wood $35 flat | `35×mult` | ✅ | `Product.flatPrice` | — | — |
| %40 bakiye indirimi | `hasDiscount40` → ×0.40 | ✅ | `User.hasDiscount40`, quote.discount40 | — | — |
| $250 toplu bakiye yükleme | `loadBulk250()` → balance+=250, discount40=true | ✅ | `POST /credits/me/topup` | — | — |
| Bakiye bitince %40 sonlanması | "bakiye bitene kadar geçerli" | ❌ | balance=0 olunca `hasDiscount40=false` reset mantığı (mevcut: kalıcı) | F1 | P1 |
| Bakiye defteri (ledger) | localStorage | ✅ | `GET /credits/me/ledger`, CreditLedger | — | — |
| $30/ay ekip aidatı tahsili | `upgradeToTeamMember()` | ✅ | `POST /memberships/upgrade`, Transaction MEMBERSHIP_FEE | — | — |
| Aylık abonelik yenileme | "aylık abonelik başlatıldı" | ⚠️ | `Membership.renewalDate` var; cron/worker yok | F2 | P2 |
| Kredi kartı ödeme (3D Secure) | checkout form, "256-bit SSL" | ⚠️ | gerçek gateway yok → simüle PAID; Stripe/iyzico tokenization | F1 | P1 |
| Kart formu (name/number/expiry/cvc) | `checkout_card_*` | ⚠️ | gateway entegrasyonu; kart verisi BE'de tutulmamalı (PCI) | F1 | P1 |
| Finansal atomiklik (transaction+lock) | localStorage senkron | ⚠️ | `$transaction` var; `SELECT FOR UPDATE` row-lock eksik | S0 | P0 |
| Idempotency (çift ödeme önleme) | yok | ❌ | `Idempotency-Key` header + dedupe store | S0 | P0 |
| Server-side fiyat doğrulama | FE hesaplıyor | ⚠️ | `/orders` create'te tutarı yeniden hesapla, FE total'a güvenme | S0 | P0 |
| Negatif bakiye önleme (yuvarlama) | — | ⚠️ | minor-unit/Decimal kontrol + non-negative constraint | S0 | P1 |
| İşlem geçmişi | localStorage | ✅ | `GET /transactions/me`, `GET /transactions` (admin) | — | — |

### 2.4 Katalog

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| Kategori listesi | sabit 3 buton | ✅ | `Product.category` enum | — | — |
| Wallpaper ürün tipleri | sabit 3 radio | ✅ | `Product.subTypes` JSON | — | — |
| Ek opsiyon listesi | sabit 3 checkbox | ✅ | `GET /extras` | — | — |
| Ürün/malzeme/extra CRUD (admin) | mockup'ta yok | ✅ | `/products`,`/materials`,`/extras` (ADMIN) | — | — |
| Katalog FE'ye dinamik besleme | FE sabit kodlu | ⚠️ | FE'nin `/products`,`/extras` tüketmesi (entegrasyon) | F1 | P2 |

### 2.5 Etsy Mağaza

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| Mağaza ekle (ad + API key) | `saveNewStore()`, `ortak_doku_stores` | ✅ | `POST /etsy-stores` | — | — |
| Mağaza listele | kart grid + boş durum | ✅ | `GET /etsy-stores` (user-scoped) | — | — |
| Mağaza sil | trash ikon | ✅ | `DELETE /etsy-stores/:id` | — | — |
| API key şifreleme | düz metin | ❌ | AES-256-GCM (KMS envelope), GET'te key dönmemeli | S0 | P0 |
| Etsy API tüketimi (sipariş çekme) | sadece key saklama | ❌ | OAuth + worker (kapsam dışı, faz sonrası) | F2 | P2 |

### 2.6 Fatura

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| TR Bireysel (TC 11) | `billing_tr_tc` | ✅ | `BillingInfo.tc` | — | — |
| TR Kurumsal (unvan/vergi dairesi/no 10) | `billing_tr_*` | ✅ | `companyTitle`,`taxOffice`,`taxNo` | — | — |
| US Bireysel (SSN/ITIN) | `billing_us_ssn` | ✅ | `BillingInfo.ssn` | — | — |
| US Kurumsal (EIN/eyalet) | `billing_us_ein`,`state` | ✅ | `ein`,`state` | — | — |
| Dinamik alan gösterimi | `toggleBillingFields()` | ✅ (FE) | `country`,`type` enum | — | — |
| Fatura adresi | `billing_address` zorunlu | ✅ | `BillingInfo.address` | — | — |
| Kaydet/getir | `saveUserBillingOnly()` | ✅ | `GET/PUT /billing/me` | — | — |
| PII alan şifreleme | düz metin | ❌ | TC/SSN/EIN/taxNo AES-256-GCM + maskeleme | S0 | P0 |

### 2.7 Dosya (R2)

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| Dosya yükleme başlat (presigned) | drag-drop input | ✅ | `POST /files/initiate` | — | — |
| Multipart yükleme (>15MB) | 500MB limit metni | ✅ | `/files/complete`,`/files/abort` (10MB part) | — | — |
| Dosya sahiplik kontrolü | — | ❌ | `mark-ready`,`download-url`,`complete`,`abort` Public→JWT+ownership | S0 | P0 |
| Dosya boyut/MIME doğrulama | accept attr (FE) | ❌ | Content-Length-Range policy + magic-byte (`file-type`) | S0 | P0 |
| İndirme presigned URL | drive link mock | ⚠️ | `GET /files/:id/download-url` var ama Public; kısa TTL+ownership | S0 | P0 |
| Antivirüs taraması | yok | ❌ | ClamAV/bulut AV, pending→clean state | F2 | P2 |
| Dosya yaşam döngüsü (hot/archive) | yok | ⚠️ | `Asset.lifecycleStage` var; otomasyon yok | F2 | P2 |

### 2.8 Operasyon / Sheets-Drive

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| Google Sheets veri dökümü | `sheets-modal`, `activeSheetsPayload` | ❌ | Apps Script/Sheets API push, `POST /integrations/sheets` | F1 | P1 |
| Google Drive dosya arşivleme | mock drive linkleri | ❌ | Drive API v3, `/Ortak Doku Siparişleri/{etsyNo}/` | F1 | P1 |
| CSV dışa aktarma | `downloadCSVData()` (FE) | ⚠️ | FE yapıyor; BE `GET /orders/export-csv` önerilir | F2 | P2 |
| 9 sütunlu sipariş satırı | sheet header | ⚠️ | order payload alanları mevcut; sheet mapping eksik | F1 | P1 |

### 2.9 Admin / Tema

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| Admin panel erişimi | `email===admin@ortakdoku.com` | ⚠️ | RBAC ADMIN rolü var; FE e-posta-bazlı kontrolü role-bazlıya çevir | F1 | P1 |
| Tema renkleri (primary/navy) | `theme_color_*`, `ortak_doku_theme` | ❌ | `Settings` modeli + `POST /admin/theme` | F1 | P2 |
| Logo SVG + hero başlık | `theme_logo_svg`,`theme_hero_title` | ❌ | `Settings` (logoSvg,heroTitle) | F1 | P2 |
| Tema sıfırlama | `resetThemeToDefault()` | ❌ | `POST /admin/theme/reset` | F1 | P2 |
| Admin: kullanıcı/sipariş yönetimi paneli | yok (mockup'ta sadece tema) | ❌ | admin CRUD endpoint'leri + raporlama | F2 | P2 |
| Bakiye yükleme (admin→kullanıcı) | yok | ✅ | `POST /credits/:userId/topup` | — | — |
| Organizasyon yönetimi | yok | ✅ | `/organizations` (opsiyonel) | — | — |

### 2.10 Bildirim

| Özellik | HTML'de nasıl | Backend durumu | Gereken model/endpoint/alan | Faz | Öncelik |
|---|---|---|---|---|---|
| Toast bildirimleri (4 tip) | `showNotification()` info/success/error/warning | ✅ (FE) | BE gerekmez; HTTP status + mesaj döner | — | — |
| E-posta simülatör (OTP) | `email-simulator-container` | ⚠️ | gerçek e-posta gönderimine bağlı (2.1) | S0/F1 | P1 |
| Sipariş onay e-postası | yok (mockup) | ❌ | `OrderConfirmation` mail template | F2 | P2 |

### 2.11 Varlıklar (Veri Modeli — referans)

| Varlık | Mevcut alanlar (Prisma) | Durum | Eksik/eklenecek |
|---|---|---|---|
| User | id,email,passwordHash,fullName,phone,role,priceMultiplier,balance,hasDiscount40,isEmailVerified,active,leaderId,organizationId | ✅ | — |
| Order | orderNumber,category,productType,status,paymentMethod,paymentStatus,subtotal,extrasTotal,discount40,total,totalSqm,client*,etsyOrderNo,orderDate,etsyStoreId,quickbooksInvoiceId | ✅ | — |
| OrderItem / OrderExtra | widthInch,heightInch,sqm,fiyat / name,price,qty snapshot | ✅ | — |
| Product / Material / ExtraOption | category,unit,basePricePerM2,flatPrice,subTypes / widthInch,settings / code,price,fixedW/H | ✅ | — |
| Asset | r2Key,mime,sizeBytes,role,status,lifecycleStage,uploadId,orderId,userId | ✅ | MIME/boyut doğrulama mantığı |
| CreditLedger / Transaction | delta,balanceAfter,reason / type,amount,status,method | ✅ | — |
| BillingInfo | country,type,tc,companyTitle,taxOffice,taxNo,ssn,ein,state,address | ⚠️ | hassas alan şifreleme |
| EtsyStore | name,apiKey | ⚠️ | apiKey şifreleme |
| Membership | tier,leaderId,renewalDate | ⚠️ | yenileme worker |
| OtpCode | email,codeHash,purpose,expiresAt,consumedAt | ⚠️ | rate-limit/attempt counter |
| **Settings** | — | ❌ | **yeni: primaryColor,navyColor,heroTitle,logoSvg** |
| **IdempotencyKey** | — | ❌ | **yeni: key,userId,endpoint,response,createdAt** |
| **AuditLog** | — | ❌ | **yeni: actorId,action,resourceType,resourceId,ip,ua,ts,before/after** |

---

## 3) Backend Yapılacaklar Backlog'u (öncelik sıralı)

Tahmin: 🟢 küçük (≤0.5g) · 🟡 orta (0.5–2g) · 🔴 büyük (2g+).

### Sprint-0 — Güvenlik (üretim öncesi zorunlu, P0)

1. **Dosya endpoint'lerine sahiplik + JWT zorunluluğu** — `mark-ready`, `complete`, `abort`, `download-url`'i Public'ten çıkar; `Asset.userId === req.user.id` (veya ADMIN/PRODUCTION) kontrolü ekle. R2 key'i `userId/orderId/uuid` ile namespace'le. 🟡
2. **Dosya boyut + MIME doğrulama** — presigned'a Content-Length-Range policy göm; upload sonrası magic-byte (`file-type`) doğrula; izinli MIME allow-list; `Content-Disposition: attachment`. 🟡
3. **OTP sertleştirme** — `Math.random()` → `crypto.randomInt`; OtpCode hash'li saklama (zaten var, teyit); doğrulamada max 5 deneme + iptal; gönderim limiti (kimlik başına dk/saat). 🟡
4. **OTP + auth endpoint rate-limit** — `@nestjs/throttler` + Redis storage; `/auth/*` ve maliyetli endpoint'lere sıkı limit; enumeration önleyici generic cevap. 🟢
5. **Finansal atomiklik (row-lock)** — bakiye tahsilinde kontrol+düşme aynı `$transaction` içinde, `SELECT ... FOR UPDATE` (Prisma `$queryRaw`/pessimistic). orders.service.ts ve credits. 🟡
6. **Idempotency-Key altyapısı** — `IdempotencyKey` modeli + global interceptor; `/orders`, `/credits/topup`, `/memberships/upgrade` için mükerrer işlem engeli. 🟡
7. **Server-side tutar doğrulama** — `/orders` create'te total'i FE'den almak yerine pricing.util ile yeniden hesapla; uyuşmazlıkta reddet. 🟢
8. **Hassas alan şifreleme (PII + secret)** — `EtsyStore.apiKey`, `BillingInfo.{tc,ssn,ein,taxNo}` AES-256-GCM (KMS envelope), Prisma middleware/transformer; GET response'larda maskeleme; apiKey hiç dönmesin. 🔴
9. **Şifre policy + OTP/secret log redaction** — min 8+ karmaşıklık; mail.service OTP düz log'unu kaldır; pino/winston redaction. 🟢
10. **Negatif bakiye guard** — Decimal kontrol + DB `CHECK (balance >= 0)` / uygulama düzeyi non-negative. 🟢
11. **CORS allow-list + Helmet + global ValidationPipe whitelist** — `origin` env allow-list; `helmet()`; `forbidNonWhitelisted:true` ile mass-assignment önleme (role/balance/ownerId PATCH ile değişemez). 🟢

### Faz-1 — Mockup eksikleri (P1)

12. **Gerçek kredi kartı gateway** — Stripe/iyzico tokenization; kart verisi BE'de saklanmaz (PCI SAQ-A); `paymentStatus` gerçek webhook ile PAID; webhook imza+dedupe. 🔴
13. **Google Sheets entegrasyonu** — sipariş sonrası 9 sütunlu satırı Sheets API/Apps Script'e push; `POST /integrations/sheets`; queue ile async. 🟡
14. **Google Drive arşivleme** — production/mockup/shipping_label dosyalarını `/Ortak Doku Siparişleri/{etsyNo}/` altına; gerçek drive linkleri Order'a yaz. 🟡
15. **%40 indirim bakiye-bitince reset** — bakiye 0'a ulaşınca `hasDiscount40=false` (her tahsil sonrası kontrol). 🟢
16. **Sample ölçü doğrulama (server-side)** — Sample extra seçiliyse `widthInch=20 && heightInch=15` zorla. 🟢
17. **Admin RBAC'i e-posta yerine role-bazlı** — FE'nin `admin@ortakdoku.com` kontrolünü `role===ADMIN`'e bağla; admin endpoint'leri zaten ADMIN guard'lı. 🟢
18. **Settings modeli + tema endpoint'leri** — `Settings`(primaryColor,navyColor,heroTitle,logoSvg); `GET /settings/theme` (public), `POST /admin/theme`, `POST /admin/theme/reset`. 🟡
19. **Katalog FE entegrasyonu** — FE'nin sabit kodlu kategori/ürün/extra'yı `/products`,`/extras`'tan tüketmesi. 🟡
20. **Gerçek e-posta gönderimi (prod SMTP/SES)** — OTP + ileride sipariş onayı. 🟢
21. **Profil-eksik / üyelik-bekliyor guard'ları (BE)** — profil eksik veya `pendingRole` ödeme bekliyorsa sipariş oluşturmayı reddet (FE blocker'ı BE'de teyit). 🟢

### Faz-2 — Operasyonel olgunluk (P2)

22. **ZIP lookup BE proxy** — `GET /geo/zip-lookup`; SSRF guard, timeout, Redis cache (zippopotam.us). 🟢
23. **Audit log** — `AuditLog` modeli + interceptor; para hareketi/PII erişimi/apiKey/auth/403; append-only. 🟡
24. **Aylık abonelik yenileme worker** — BullMQ cron; `renewalDate` gelince $30 tahsil/iptal. 🟡
25. **Şifre sıfırlama akışı** — `forgot`/`reset` + OtpCode PASSWORD_RESET. 🟢
26. **Kargo etiketi 4×6" PDF + barkod** — etiket üretimi. 🟡
27. **Antivirüs taraması** — ClamAV/bulut AV, pending→clean state machine. 🟡
28. **QuickBooks tam entegrasyonu** — fatura+ödeme linki+webhook (`quickbooksInvoiceId` alanı hazır). 🔴
29. **Admin yönetim paneli + raporlama** — kullanıcı/sipariş CRUD, gelir/sipariş raporları, Excel/CSV bulk import-export. 🔴
30. **Etsy no uniqueness** — (storeId, etsyOrderNo) unique index + format. 🟢
31. **Secrets manager + CI secret scanning + key rotation** — Vault/Doppler; gitleaks; `@nestjs/config` zod validasyonu. 🟡
32. **Postgres RLS (tenant izolasyonu)** — derinlemesine savunma. 🟡
33. **KVKK/GDPR silme-anonimleştirme + retention** — veri sahibi hakları; ledger'da PII anonimleştirme. 🟡
34. **Sipariş onay e-postası** — template + tetikleme. 🟢

---

## 4) Güvenlik Gereksinimleri (özellik-bazlı kontrol listesi)

Çerçeve: OWASP ASVS 5.0, OWASP API Security Top 10 (2023). En yüksek üç risk: **BOLA/IDOR**, **finansal bütünlük**, **PII+secret sızıntısı**.

### 4.1 Kaynak yetkisi (BOLA/IDOR — en kritik)
- [ ] Her endpoint'te sahiplik DB seviyesinde zorlansın: query'ye daima `userId`/`orgId` filtresi (`findOne({where:{id, userId}})`), bulunamazsa **404** (403 değil — varlık sızdırma yok).
- [ ] **Fatura**: PII alanları sadece sahip/yetkili rol; normal görünümde maskeli.
- [ ] **Sipariş/teslimat**: yalnız siparişin sahibi + ADMIN/PRODUCTION.
- [ ] **Dosya**: `mark-ready`/`complete`/`abort`/`download-url` → JWT + `Asset.userId` eşleşmesi (şu an Public — açık).
- [ ] **Etsy apiKey**: hiçbir GET'te dönmesin; sadece bağlayan kullanıcı.
- [ ] **Bakiye/kredi**: yalnız hesap sahibi; admin topup ADMIN guard'lı.
- [ ] Mass-assignment (BOPLA): `whitelist+forbidNonWhitelisted`; `role/balance/priceMultiplier/userId` PATCH ile değiştirilemez.
- [ ] Dışa dönen ID'ler CUID/UUID (enumeration zorlaştırma — sahiplik kontrolünün yerini tutmaz).

### 4.2 Şifreleme (at-rest + in-transit)
- [ ] `EtsyStore.apiKey` + `BillingInfo.{tc,ssn,ein,taxNo}` AES-256-GCM, KMS envelope.
- [ ] Geri okunması gerekmeyen sırlar hash (OTP/şifre: bcrypt/argon2; mevcut bcrypt OK).
- [ ] Anahtar versiyonlama + rotasyon prosedürü.
- [ ] Tüm trafik TLS; HSTS; PII UI/log'da maskeli.

### 4.3 Rate-limit
- [ ] `/auth/login`,`/auth/verify-email`,`/auth/resend-otp` sıkı throttler (IP+identifier kompozit).
- [ ] OTP: max 5 yanlış deneme→iptal; gönderim dk/saat limiti (SMS/e-posta abuse).
- [ ] Global rate-limit + maliyetli endpoint (upload/ödeme) override; Redis storage (multi-instance tutarlı).

### 4.4 Finansal atomiklik
- [ ] Bakiye kontrol+düşme tek `$transaction` + `SELECT FOR UPDATE` row-lock (race → negatif bakiye/çift harcama önle).
- [ ] Idempotency-Key: `/orders`,`/credits/topup`,`/memberships/upgrade`; webhook'larda imza+event dedupe.
- [ ] Tutar daima server-side hesaplanır; FE total'a güvenilmez.
- [ ] Para Decimal/minor-unit (float yasak); non-negative constraint.
- [ ] Kart verisi BE'de tutulmaz (PCI SAQ-A, tokenization); log'da PAN/CVV yok.
- [ ] Ledger append-only (çift kayıt); bakiye = ledger toplamı denetlenebilir.

### 4.5 Dosya güvenliği
- [ ] Presigned'da Content-Length-Range (boyut DoS önleme) + kullanıcı/org kotası.
- [ ] Upload sonrası magic-byte MIME doğrulama; SVG/HTML/aktif içerik reddi.
- [ ] R2 bucket private; sadece presigned erişim; key sunucu üretir (path traversal yok).
- [ ] Download presigned öncesi sahiplik doğrulaması + kısa TTL (1–5dk).
- [ ] Antivirüs taraması (pending→clean), tarama bitene kadar indirilemez.

### 4.6 Audit
- [ ] Kayıt: login (başarılı/başarısız OTP), rol/üyelik değişimi, para hareketleri, apiKey okuma/yazma, PII erişimi, dosya indirme/silme, presigned üretimi, 403.
- [ ] Alanlar: `actorId,action,resourceType,resourceId,ip,ua,ts,before/after (maskeli)`.
- [ ] Append-only/tamper-evident; PII/secret/OTP/token log'a yazılmaz (redaction).

### 4.7 Uyum (KVKK/GDPR/PCI)
- [ ] TC/SSN özel nitelikli — şifreleme + veri minimizasyonu + retention politikası.
- [ ] Veri sahibi hakları: erişim/düzeltme/silme/taşınabilirlik; ledger'da PII anonimleştirme.
- [ ] İhlal bildirimi 72 saat (audit+monitoring); VERBİS kaydı; AB aktarımı SCC.
- [ ] PCI: kart verisi tutulmaz; tokenization; redaction.
- [ ] Secrets manager + CI secret scanning (gitleaks); `.env` prod'da repo dışı; config zod validasyonu (eksik secret'la boot etmesin).

---

## 5) Açık Sorular / İş-Modeli Netleşmesi Gerekenler

1. **%40 indirim ömrü:** "bakiye bitene kadar" — bakiye tam $0 olunca mı, yoksa indirim hakkı verirken yüklenen $250 tükenince mi (kısmi kullanım takibi)? Mevcut backend kalıcı `hasDiscount40` tutuyor; net kural gerekli.
2. **Aylık $30 aidat:** Tek seferlik mi yoksa gerçek recurring abonelik mi? Yenileme başarısız olursa rol otomatik USER'a düşer mi? Gateway recurring mi yoksa her ay bakiyeden mi tahsil?
3. **Çarpan kaynağı:** Fiyat çarpanı role'den mi (mevcut `priceMultiplier`) yoksa üyelik tier'ından mı türetilecek? İkisi çelişirse hangisi kazanır?
4. **Kart ödemesi vs bakiye:** Kart ödemesinde de %40 indirim geçerli mi, yoksa indirim sadece bakiye yükleyene mi? (mockup'ta indirim bakiyeye bağlı ama sipariş kart ile de ödenebiliyor.)
5. **Etsy entegrasyon derinliği:** apiKey sadece saklanacak mı (mevcut) yoksa gerçek Etsy sipariş çekme/senkron mu beklenecek? OAuth mı API key mi?
6. **Google Sheets/Drive:** Müşteri başına ayrı Sheet/Drive mı, tek merkezi mi? Servis hesabı yetkilendirmesi nasıl? Senkron real-time mı batch mi?
7. **Admin kapsamı:** Mockup'ta admin sadece tema. Üretimde kullanıcı/sipariş yönetimi, manuel bakiye/iade, rapor beklentisi var mı?
8. **Çoklu mağaza + Etsy no:** Aynı etsyOrderNo farklı mağazalarda olabilir mi? Uniqueness scope (global/store-bazlı)?
9. **Organizasyon modeli:** Backend'de `Organization` var ama mockup B2B bireysel satıcı odaklı. Org/multi-tenant gerçekten kullanılacak mı, yoksa kaldırılacak mı? (Güvenlik tenant izolasyonu bu karara bağlı.)
10. **Vergi/fatura çıktısı:** Fatura bilgisi sadece saklanacak mı yoksa resmi fatura/QuickBooks invoice üretimi mi? (`quickbooksInvoiceId` alanı var ama entegrasyon yok.)
11. **Dosya boyut limiti:** UI "500MB" diyor — R2 maliyeti ve part config buna uygun mu, kullanıcı başına kota ne?
12. **Şifre sıfırlama:** Mockup'ta yok; üretimde zorunlu mu (önerilir)?