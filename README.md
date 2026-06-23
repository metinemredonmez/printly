# Printy / Ortak Doku

B2B Print-on-Demand sipariş + üretim takip platformu. Bayiler Etsy üzerinden ABD'ye
**Wallpaper (m²) / Wall Decal / Wood (CNC)** satıyor.

**Stack:** NestJS + PostgreSQL + Prisma + Cloudflare R2 + Redis · Frontend (Next.js, sonra) · AI servisi (ayrı, Python/FastAPI, sonra).

## Yapı
- [`backend/`](backend) — NestJS API (auth+OTP, katalog, fiyat motoru, sipariş+durum makinesi, R2 dosya yükleme, kredi/üyelik, Etsy mağaza, fatura). Kurulum: [backend/README.md](backend/README.md).
- `docs/` — `mockup.html` (tasarım referansı).

## Dökümanlar
| Döküman | İçerik |
|---|---|
| [ANALIZ.md](ANALIZ.md) | Uçtan uca mimari |
| [BACKEND-DETAY-ANALIZ.md](BACKEND-DETAY-ANALIZ.md) | Mimari + güvenlik denetimi |
| [BACKEND-OZELLIK-KAPSAMI.md](BACKEND-OZELLIK-KAPSAMI.md) | HTML→backend özellik eşlemesi (78 özellik) |
| [ENTEGRASYON-API.md](ENTEGRASYON-API.md) | Dış API haritası (Etsy/QuickBooks/kargo/AI...) |
| [BACKEND-GENISLETME-PLANI.md](BACKEND-GENISLETME-PLANI.md) | 2FA, multi-tenant, ödeme, cache, bildirim, harita, kanban |
| [AI-SERVIS.md](AI-SERVIS.md) | AI servisi (chatbox, virtual try-on, guardrails) |
| [ADMIN-MAIL.md](ADMIN-MAIL.md) | Admin içeriden mail (SMTP+IMAP) |
| [KANBAN-BOARD.md](KANBAN-BOARD.md) | Sipariş/üretim kanban |
| [PUSH-ONESIGNAL.md](PUSH-ONESIGNAL.md) | OneSignal toplu push |
| [KUYRUK-YONETIMI.md](KUYRUK-YONETIMI.md) | BullMQ kuyruk yönetimi (Bull Board dashboard, retry/backoff, scheduled, alarm) |
| [MOBIL-QR.md](MOBIL-QR.md) | QR/barkod okutma — backend + mobil (üretim istasyon takibi) |
| [MOBIL-AR-3D-VIRTUAL.md](MOBIL-AR-3D-VIRTUAL.md) | Mobil virtual try-on / AR / 3D duvar uygulaması + AI |
| [SUNUCU-PROD-KURULUM.md](SUNUCU-PROD-KURULUM.md) | Prod sunucu runbook (Hetzner + systemd + nginx/certbot + GitHub Actions + yönetilen DB/Redis) |
| [GENEL-BACKEND-ANALIZ.md](GENEL-BACKEND-ANALIZ.md) | Backend genel denetim (7 boyut, ~61/100, kritik para/güvenlik bulguları + yol haritası) |
| [ENDPOINT-TEST-RAPORU.md](ENDPOINT-TEST-RAPORU.md) | 72 endpoint canlı test (67 geçti/4 kaldı) + tekilleştirilmiş kod bulguları |
| [YAPILACAKLAR-YOL-HARITASI.md](YAPILACAKLAR-YOL-HARITASI.md) | Öncelikli backend yapılacaklar (P0→CRED) |
| [KIYASLAMA-POD-PLATFORMLARI.md](KIYASLAMA-POD-PLATFORMLARI.md) | Printful/Printify/Gooten kıyaslama + gap analizi + rakip-ilhamı yol haritası |
| [MUSTERI-KURULUM-LISTESI.md](MUSTERI-KURULUM-LISTESI.md) | Müşteri hesap/kurulum listesi |

## Çalıştırma (backend)
```bash
cd backend && nvm use 20
cp .env.example .env.development   # değerleri doldur
docker compose up -d               # Postgres :5433 + Redis :6380
npm install && npm run prisma:migrate && npm run db:seed
npm run start:dev                  # http://localhost:3001/api  (Swagger: /api/docs)
```
