# Printy — Backend (Faz 1)

NestJS + Prisma + PostgreSQL + Cloudflare R2.
Para kazandıran çekirdek: bayi auth, ürün/fiyat, ölçü→m² hesap, sipariş + durum
makinesi, büyük dosya yükleme (R2 presigned multipart), kredi/bakiye.

## Mimari (lokal geliştirme)
- **Docker = sadece altyapı**: PostgreSQL (host **5433**) + Redis (host **6380**).
  Back/front Docker'da DEĞİL, lokalde çalışır. (5432/6379 makinende dolu olduğu
  için Printy çakışmayan portlar kullanır.)
- **Backend (NestJS)** → lokalde `npm run start:dev`
- **Frontend (Next.js)** → lokalde (ayrı klasör, sonra eklenecek)
- **Env**: `.env.development` (dev) / `.env.production` (prod). NODE_ENV'e göre seçilir.

## Gereksinimler
- **Node 20** (Node 16 desteklenmez). nvm ile: `nvm install 20 && nvm use 20`
- Docker (yalnızca PostgreSQL + Redis için)

## Kurulum

```bash
cd backend
nvm use 20                 # .nvmrc içinde 20 var
# .env.development zaten dev defaultlarıyla hazır (sadece R2 bilgilerini doldur)
npm install

docker compose up -d       # printy-postgres (5433) + printy-redis (6380)
npm run prisma:generate
npm run prisma:migrate -- --name init   # şemayı veritabanına uygular
npm run db:seed            # admin + örnek ürün/materyal

npm run start:dev          # http://localhost:3001/api
```

Sağlık kontrolü: `GET http://localhost:3001/api/health`
Seed admin: `admin@printy.local` / `admin12345`

> **R2 olmadan da çalışır:** auth/sipariş/fiyat denenebilir. Dosya yükleme
> endpoint'leri gerçek R2 bilgileri girilince çalışır (`.env`).

## API Dokümanı (Swagger)
- Arayüz: **http://localhost:3001/api/docs** (interaktif; "Authorize" ile Bearer token gir)
- OpenAPI JSON: **http://localhost:3001/api/docs-json**

## Roller & fiyatlama (mockup modeli)
- **Roller:** USER (2× fiyat) · TEAM_MEMBER ($30/ay aidat, 1×) · TEAM_LEADER (aidatsız, 1×) · ADMIN · PRODUCTION
- **Ürün:** Wallpaper (m² bazlı, $23/m² 1×) · Wall Decal (FLAT $15) · Wood (FLAT $35)
- **Ölçü:** inch girilir → `sqft=w×h/144`, `sqm=sqft×0.092903`; hem inch hem cm saklanır
- **%40 indirim:** $250 bakiye yükleyen kullanıcıya (`hasDiscount40`)
- **Ek seçenekler:** Shipping Box $2.50 · Installation Kit $3.00 · Sample $2.50

## API (özet)

| Method | Endpoint | Yetki | Açıklama |
|---|---|---|---|
| POST | `/api/auth/register` | herkes | Kayıt (USER) → OTP gönderilir |
| POST | `/api/auth/verify-email` | herkes | OTP doğrula → JWT (oto giriş) |
| POST | `/api/auth/resend-otp` | herkes | Kodu tekrar gönder |
| POST | `/api/auth/login` | herkes | Giriş → JWT (doğrulanmış hesap) |
| GET | `/api/auth/me` | token | Oturum bilgisi |
| GET | `/api/materials` `/api/products` `/api/extras` | token | Katalog (okuma) |
| POST/PATCH | `/api/products` `/api/materials` `/api/extras` | ADMIN | Katalog yönetimi |
| POST | `/api/pricing/quote` | token | Canlı fiyat (items[] inch + extras, rol çarpanı + %40) |
| POST `GET` | `/api/orders` `/api/orders/:id` | token | Sipariş oluştur/listele/detay |
| PATCH | `/api/orders/:id/status` | ADMIN/PRODUCTION | Durum değiştir |
| GET/POST/DELETE | `/api/etsy-stores` | token | Etsy mağaza yönetimi |
| GET/PUT | `/api/billing/me` | token | Fatura bilgileri (TR/US) |
| GET | `/api/memberships/me` `/api/memberships/leaders` | token | Üyelik / lider listesi |
| POST | `/api/memberships/upgrade` | token | Ekip Üyesi/Lider'e yükselt |
| GET | `/api/credits/me` `/api/credits/me/ledger` | token | Bakiye / hareketler |
| POST | `/api/credits/me/topup` | token | Bakiye yükle ($250→%40) |
| POST | `/api/credits/:userId/topup` | ADMIN | Kullanıcıya bakiye yükle |
| GET | `/api/transactions/me` | token | İşlem geçmişi |
| POST | `/api/files/initiate` `/complete` `/abort` | token | R2 presigned upload (≤500MB multipart) |
| GET | `/api/files/:id/download-url` | token | İndirme linki |

## Dosya yükleme akışı (büyük TIFF)
1. `POST /api/files/initiate` → `{ mode, assetId, key, url|parts, uploadId }`
2. Tarayıcı, dönen presigned URL'lere **doğrudan R2'ye** yükler (app server'dan geçmez)
3. Tek parça → `POST /api/files/:assetId/mark-ready`
   Multipart → `POST /api/files/complete` (her parçanın ETag'i ile)

## Seed hesapları
- **Admin:** `admin@ortakdoku.com` / `admin`
- **Lider:** `lider.hakan@ortakdoku.com` / `lider123` (ve `lider.elif@...`)
- Ürün id'leri: `seed-prod-wallpaper` (m²), `seed-prod-decal` (flat), `seed-prod-wood` (flat)

## Hızlı test (seed sonrası)

```bash
# Giriş (admin)
curl -s localhost:3001/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@ortakdoku.com","password":"admin"}'

# Fiyat önizleme (TOKEN'ı yukarıdan al) — wallpaper 40x60 inch
curl -s localhost:3001/api/pricing/quote -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN' \
  -d '{"items":[{"productId":"seed-prod-wallpaper","widthInch":40,"heightInch":60,"quantity":1}]}'
```

> **OTP not (dev):** SMTP boşken kayıt kodu sunucu log'una yazılır (`[DEV OTP] ...`).
> Gerçek e-posta için `.env`'e SMTP bilgilerini gir.

## Sonraki adımlar (yol haritası)
- Faz 1 kalan: QuickBooks ödeme linki, Excel import/export, basit raporlama, barkod/etiket PDF
- Faz 2: QuickBooks API, Etsy API, kargo takibi, BullMQ worker'lar (thumbnail/DPI)
- Detay: kök dizindeki `ANALIZ.md`
