# Backend Genişletme Planı (Ortak Doku)

> Kullanıcının yeni gereksinimleri. **Sadece backend.** Her madde: ne / neden / önerilen yaklaşım (NestJS) / faz / etki.
> AI servisi ayrı dokümanda: `AI-SERVIS.md`.

---

## 1. Çift Faktör (2FA) — login'de mail dışında kod

- **Ne:** Şifre + e-posta'ya ek olarak **authenticator app (TOTP)** kodu ile 2FA.
- **Neden:** Hesap güvenliği; B2B'de bakiye/ödeme olduğu için önemli.
- **Yaklaşım:** `otplib` (TOTP). Akış: kullanıcı 2FA'yı etkinleştirir → QR (otpauth URL) → authenticator (Google Authenticator/Authy) tarar → login'de TOTP kodu istenir. **Recovery codes** (yedek kodlar) üret. `User.twoFactorSecret` (şifreli), `User.twoFactorEnabled`.
- **İlişki:** Mevcut e-posta OTP (kayıt doğrulama) ayrı kalır; 2FA login adımına eklenir. SMS 2FA istenirse telefon sağlayıcı (madde 3) ile.
- **QR + klasik login:** Kullanıcı "sadece klasik (şifre) login" istemiyor → standart akış **login + QR/TOTP 2FA**. QR = authenticator kurulum QR'ı (otpauth URL → QR görseli).
- **Referans (hazır kod):** `~/Desktop/uzman-fly-app` → `MfaService`/`MfaController` (TOTP secret + `dev.samstevens.totp` + ZXing ile QR data URI). NestJS'e **`otplib` + `qrcode`** ile port edilecek. SMTP/mail kodu da oradan referans (bkz. `ADMIN-MAIL.md`).
- **Faz:** 1-2. **Etki:** orta (auth akışına ek adım + endpoint).

## 2. Multi-tenant — müşteriler ayrı arayüzde kendi siparişleri

- **Ne:** Her müşteri/firma bir **tenant**; verisi izole, kendi arayüzünden girer, sadece kendi siparişlerini görür/verir.
- **Neden:** "tenant ayrı arayüz" — SaaS kiracı modeli.
- **Yaklaşım (öneri — şimdilik pragmatik):** Mevcut **Organization = Tenant** yap; her `User` bir `tenantId`'ye (org) bağlı. Tüm sorgulara **otomatik tenant filtresi** (Prisma middleware / interceptor) — kullanıcı sadece kendi tenant'ının verisini görür. Subdomain/branding ayrımı (frontend) için `Tenant.slug`, `Tenant.theme`. **Tam izolasyon (ayrı şema/DB)** ileride gerekirse; başlangıçta **row-level tenant scoping** yeterli ve güvenli.
- **Karar gerek:** (a) Row-level tenant scoping (önerilen, hızlı) mı, (b) şema/DB başına tenant (tam izolasyon, ağır) mı?
- **Faz:** 1-2 (mimari karar — erken netleşmeli). **Etki:** yüksek (tüm sorgulara tenant filtresi).

## 3. Auth sağlayıcıları — telefon, Google OAuth, mock

- **Ne:** Birden çok giriş yöntemi: **Google OAuth** (sosyal giriş), **telefon (SMS OTP)**, **mock auth** (dev/test).
- **Yaklaşım:**
  - **Google OAuth:** `passport-google-oauth20` → ilk girişte kullanıcı oluştur/eşle (`User.googleId`, `authProvider`).
  - **Telefon:** SMS OTP (Twilio Verify veya benzeri) → `User.phone` doğrulama + login.
  - **Mock:** sadece `NODE_ENV=development`'ta açık bir "mock login" (seçili kullanıcıyla token üret) — testte hızlı giriş.
- **Model:** `User.authProvider` (LOCAL|GOOGLE|PHONE), `googleId?`, `phoneVerified`.
- **Faz:** 2 (Google + telefon), mock Faz 1 (dev kolaylığı). **Etki:** orta.

## 4. Ödeme sağlayıcıları — pluggable + ayardan kontrol

- **Ne:** Mevcut (QuickBooks) + **Stripe** ek; **admin ayarından** hangisi aktif seçilir.
- **Yaklaşım:** **`PaymentProvider` arayüzü** (strategy pattern): `QuickBooksProvider`, `StripeProvider`. `Settings.activePaymentProviders` (açık/kapalı + öncelik). Sipariş ödeme akışı aktif sağlayıcıya yönlenir. Webhook controller'ları her sağlayıcı için ayrı.
- **Settings:** DB'de `Settings` modeli (key-value veya tipli) — admin endpoint'leri ile yönetilir. Bakiye ödemesi her zaman var; kart ödemesi seçili provider'a gider.
- **Faz:** 2. **Etki:** orta (soyutlama + 2 entegrasyon, ama temiz).

## 5. Yedekleme (DB) + Cache (Redis)

- **DB yedekleme:**
  - **Ne:** Postgres düzenli otomatik yedek + geri yükleme prosedürü.
  - **Yaklaşım:** Cron ile `pg_dump` → R2'ye (veya Hetzner volume) yükle; günlük + retention (ör. 7 gün). Prod'da ayrıca PITR için yönetilen Postgres düşünülebilir. Geri yükleme adımları dokümante.
- **Cache:**
  - **Ne:** Sık okunan veriyi (katalog/ürün/fiyat, ayarlar) Redis'te cache'le.
  - **Yaklaşım:** `@nestjs/cache-manager` + `cache-manager-redis-yet` (Redis 6380 zaten ayakta). TTL'li cache; yazınca invalidasyon. Ayrıca rate-limit (`@nestjs/throttler`) Redis store ile.
- **Faz:** 1-2. **Etki:** düşük-orta (altyapı, iş mantığına minimum dokunur).

## 6. AI Servisi (ayrı backend)

- Detay: **`AI-SERVIS.md`**. Özet: ayrı servis, Gemini, chatbox + virtual try-on/ölçü, ayarlar admin'den, ana backend ince proxy `ai` modülü. **Faz:** 2-3.

## 7. Yetki bazlı (granüler permission)

- **Ne:** Rol bazlı (RBAC) zaten var; "yetki bazlı" için daha granüler **permission** (ör. `order:read`, `order:updateStatus`, `user:manage`, `settings:write`).
- **Yaklaşım:** `Permission` + rol→permission eşlemesi (veya CASL ile policy). Başlangıçta rol→permission sabit map; ileride DB'den yönetilir. Guard'ı `@RequirePermission('order:updateStatus')` ile genişlet.
- **Faz:** 2. **Etki:** orta (guard genişletme).

## 8. Env dev/prod ayrı sunucu

- **Ne:** Dev ve prod **ayrı sunucularda**; her biri kendi DB/Redis/AI servisi/secrets ile.
- **Yaklaşım:** `.env.development` / `.env.production` (var). Prod sunucu: Hetzner (API + ayrı/yönetilen Postgres + Redis + ayrı AI servisi). CI/deploy: prod'da `prisma migrate deploy` (script var), `npm run start:prod`. Secrets prod sunucuda (git'te değil). Sağlık/monitoring + log toplama. Reverse proxy (Caddy/Nginx) + Cloudflare.
- **Faz:** 1-2 (devreye alırken). **Etki:** operasyonel.

---

## 9. Bildirim altyapısı — SMTP toplu + Push (OneSignal + Firebase)

- **SMTP toplu bildirim (broadcast):**
  - **Ne:** Tüm bayilere veya segment'e duyuru/bildirim maili (kampanya, sistem duyurusu, sipariş durumu toplu).
  - **Yaklaşım:** **BullMQ kuyruğu** ile batch gönderim (rate-limit, retry), şablon (MailTemplate ile ortak), unsubscribe linki, gönderim logu. Yüksek hacimde **Amazon SES** (ucuz broadcast), düşük hacimde Postmark.
- **Push bildirim:**
  - **OneSignal:** web + mobil push, segment/topic. **Birincil.** **Hazır kod referansı:** `~/Desktop/bütün-projeler/uzman/podcast_app` (NestJS — aynı stack; provider+service+controller+UserDevice/PushNotificationLog modelleri) → uyarlanmış tasarım: **`PUSH-ONESIGNAL.md`**. 2000+ alıcı için chunk (~2000/istek) + BullMQ.
  - **Firebase Cloud Messaging (FCM):** mobil app (React Native) gelince native push; web push de destekler.
  - **Model:** `UserDevice` (userId, deviceToken, platform), `PushNotificationLog`. Tetikleyici: sipariş durum değişimi, ödeme, duyuru.
- **Bildirim merkezi:** in-app bildirim + kullanıcı tercihleri (e-posta/push aç-kapa, Settings ile).
- **Faz:** 2. **Etki:** orta.

## 10. Harita / Canlı Aktivite (uluslararası)

- **Ne:** Uluslararası operasyon için **harita üzerinde aktif siparişler** + bayi/üretim aktivitesi (admin dashboard). "Firmaların/bayilerin ne zaman hareket (işlem) yaptığı" canlı görünür.
- **Yaklaşım (backend):**
  - **Geocoding:** teslimat adresi (ülke/şehir/ZIP) → lat/lng (Google Geocoding / Mapbox / self-host Nominatim). `Order.lat/lng` (veya ayrı tablo), cache'li.
  - **Endpoint'ler:** `GET /admin/map/active-orders` (durum+konum), `GET /admin/activity` (son hareketler feed'i — kim, ne zaman, ne yaptı).
  - **Canlı güncelleme:** WebSocket (Socket.IO) + Redis pub/sub → harita anlık güncellenir.
  - Aktivite kaydı: AuditLog/ActivityLog (sipariş oluşturma, durum değişimi, bayi girişi) zaman damgalı.
- **Frontend:** harita kütüphanesi (Mapbox/Leaflet/Google Maps) — frontend işi; backend endpoint + geocode + realtime sağlar.
- **Faz:** 2-3. **Etki:** orta.

## 11. Kanban Board (sipariş/üretim takibi)

- **Ne:** Üretim ekibinin siparişleri sürükle-bırak ile yönettiği pano (kolon=durum, kart=sipariş). Detay: `KANBAN-BOARD.md`.
- **Yaklaşım:** Mevcut `Order.status` + durum makinesi yeniden kullanılır; tek ekleme `Order.boardPosition`. Endpoint'ler: `GET /board`, `PATCH /board/orders/:id/move`, `PATCH /board/reorder`. Reorder pattern Pure projesinden (`items:[{id,position}]` + `$transaction`). Frontend: dnd-kit.
- **Referans:** `~/Desktop/bütün-projeler/freelancer/pure` (NestJS+Prisma status pipeline + reorder).
- **Faz:** 1-2 (üretim için yüksek değer). **Etki:** düşük-orta (mevcut sipariş modeline hafif ekleme).

## 12. Benzer projelerden alınacak modüller (uzman-fly referans)

`~/Desktop/uzman-fly-app` (Java/Spring) incelendi; Ortak Doku'ya uygun, ileride **port edilebilecek** modüller:

| Modül | Ne için | Faz |
|---|---|---|
| **Ticket / Destek** (Ticket + TicketComment) | Bayi destek talepleri, atama, durum, yorum | 2-3 |
| **AuditLog** | Kim ne yaptı (denetim/uyum) — finansal akışlar için kritik | 1-2 |
| **Document** | Sipariş/bayi belgeleri (fatura, sözleşme) yükle/indir (R2) | 2 |
| **JobQueue / Batch** | Arka plan iş kuyruğu + toplu işlem (BullMQ ile) | 2 |
| **Search** | Modüller arası global arama (sipariş/bayi/ticket) | 2-3 |
| **Dashboard / Report** | Admin KPI + bayi/gelir/sipariş raporları | 2 |
| **Archive** | Tamamlanan eski siparişleri arşivleme (R2 lifecycle ile uyumlu) | 3 |
| **GDPR/KVKK** | Veri dışa aktarma/silme talebi (ABD + AB uyum) | 3 |
| **IntegrationConfig** | Etsy/QuickBooks/Stripe/Printful bağlantı ayar deposu (Settings ile) | 2 |
| **Notification merkezi** | E-posta/SMS/push tercih + log (madde 9 ile) | 2 |

> Havayolu-spesifik modüller (flight, EMD, deposit matrix, Saudia mail import) **alınmaz**.

---

## Önerilen uygulama sırası (backend)

**Sprint 0 — güvenlik (önce, kısa):** files yetki kontrolleri, OTP rate-limit + crypto, bakiye atomicliği, dosya boyut/MIME — (BACKEND-DETAY-ANALIZ.md'deki yüksek bulgular).

**Sprint 1 — altyapı & ayarlar:** `Settings` modeli + admin endpoint'leri, Redis cache + throttler, DB backup cron, mock auth (dev), **AuditLog** (§12), **Kanban board** (§11, sipariş/üretim takibi).

**Sprint 2 — kimlik & ödeme & bildirim:** 2FA QR/TOTP (uzman-fly MfaService referans) + Google OAuth + telefon, ödeme provider soyutlama (QuickBooks+Stripe, ayardan), granüler permission, **bildirim altyapısı** (SMTP toplu + OneSignal/Firebase push).

**Sprint 3 — multi-tenant + admin mail + harita:** tenant scoping (Organization=Tenant), per-tenant ayar/branding; **admin içeriden mail** (SMTP+IMAP, çoklu hesap, şablon — `ADMIN-MAIL.md`, referans uzman-fly); **harita/canlı aktivite** (uluslararası aktif siparişler + geocode + WebSocket).

**Sprint 4 — AI servisi (ayrı Python/FastAPI mikroservis):** PARK — prod'da eklenecek. chatbox, virtual try-on/ölçü (Gemini). Bkz. `AI-SERVIS.md`.

---

## Karar gereken noktalar
1. **Multi-tenant:** row-level scoping (önerilen) mı, şema/DB izolasyonu mu?
2. **2FA yöntemi:** TOTP (authenticator) — onaylıyor musun? SMS 2FA de istiyor musun (telefon sağlayıcı gerekir)?
3. **AI servis dili:** Python (FastAPI) mı, Node (NestJS) mı?
4. **Stripe ile QuickBooks:** ikisi aynı anda aktif olabilsin mi, yoksa tek seçili mi?
5. **Sıra:** önerilen sprint sırası uygun mu, yoksa bir şeyi öne mi alalım?
