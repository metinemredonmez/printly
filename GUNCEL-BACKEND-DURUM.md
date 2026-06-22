# Güncel Backend Durum Analizi (Sprint 0/1/2 sonrası)

> Tarih: 2026-06-22. Koddan envanterlendi (hafızadan değil).
> 17 controller · ~50 endpoint · 20 Prisma modeli · 6 migration · Guard: JWT→Roles→Permissions→Throttler (global).
> Önceki gap analizleri: `BACKEND-DETAY-ANALIZ.md`, `BACKEND-OZELLIK-KAPSAMI.md`.

---

## 1. ✅ TAMAMLANANLAR (çalışıyor + test edildi)

| Alan | Endpoint / Özellik |
|---|---|
| **Auth** | register · verify-email (OTP) · resend-otp · login (2FA-aware) · mock-login (dev) · me · permissions · **2FA** setup/enable/disable (QR/TOTP + yedek kod) |
| **Katalog** | materials (list/create/update) · products (list/get/create/update) · extras (list/create/delete) · **Redis cache** (5dk, invalidate) |
| **Fiyat** | quote (inch→m², rol çarpanı 1×/2×, flat/m², extra'lar, %40) |
| **Sipariş** | create (atomik bakiye + audit) · list · get · status (durum makinesi, `order:updateStatus` izni) |
| **Kanban** | board · move (geçiş doğrulamalı) · reorder (`board:manage` izni) |
| **Dosya** | initiate (boyut/format/sahiplik) · mark-ready · complete · abort · download-url (sahiplik) — R2 presigned multipart ≤500MB |
| **Kredi/Bakiye** | me · ledger · topup (self/admin, $250→%40, atomik, audit) |
| **Üyelik** | me · leaders · upgrade ($30 atomik aidat, audit) |
| **İşlemler** | transactions me/all |
| **Etsy mağaza** | CRUD (kullanıcı-scoped) |
| **Fatura bilgisi** | me get/put (TR/US, bireysel/kurumsal) |
| **Settings** | getAll · get · put (audit) — ödeme provider toggle, feature flag |
| **Audit** | list (admin) — order/credit/membership/setting/push/payment hook'ları |
| **Bildirim** | devices (kayıt/liste/sil) · push (OneSignal, ALL/USER_IDS/SEGMENT) · email-bulk (SMTP toplu) · push-logs |
| **Ödeme provider** | providers · checkout (QuickBooks/Stripe, ayardan) · confirm — **stub** (gerçek gateway yok) |
| **Org** | list · me get/patch · get (opsiyonel firma) |
| **Altyapı** | JWT+2FA+RBAC+permission+throttler · Redis cache · OTP e-posta (SMTP/dev) · AES-256-GCM crypto util · DB backup scripti · dev/prod env · Swagger `/api/docs` · Docker (PG 5433/Redis 6380) |

---

## 2. ❌ EKSİKLER (yapılacaklar — tek tek bakacağız)

### A) Faz 1 kapsamında eksik (öncelikli)
1. **Toplu import/export (Excel/CSV)** ← *bugün sorduğun* — toplu sipariş import + gelir/müşteri/sipariş export. **YOK.**
2. **Raporlama / Dashboard** — gelir, sipariş, bayi bazlı KPI + admin/bayi dashboard. **YOK.**
3. **QuickBooks gerçek entegrasyon** — fatura kesme + ödeme alma + webhook (şu an stub). **YOK.**
4. **Barkod / kargo etiketi (4×6" PDF)** — üretim için. **YOK.**
5. **Fatura PDF üretimi** — **YOK.**
6. **Admin paneli geniş CRUD** — kullanıcı yönetimi, sipariş yönetimi (kısmi var; kullanıcı yönetimi yok).

### B) Faz 2 (otomasyon / dış entegrasyon — hesap/cred bekliyor)
7. **Etsy API** (sipariş çekme worker, BullMQ) — **YOK.**
8. **Stripe gerçek** (Checkout Session + webhook) — stub.
9. **Google OAuth + telefon SMS** — cred bekliyor (Google app, Twilio).
10. **OneSignal gerçek key** — kod hazır, key bekliyor.
11. **Google Sheets / Drive otomasyonu** — **YOK.**
12. **Multi-tenant (row-level scoping)** — Organization opsiyonel var ama otomatik tenant filtresi **YOK.**
13. **Document yönetimi** (sipariş/bayi belgeleri) — **YOK.**
14. **Ticket/destek** — **YOK.**
15. **Search (global)** — **YOK.**
16. **Archive (eski sipariş + R2 lifecycle)** — **YOK.**
17. **GDPR/KVKK (veri export/delete)** — **YOK.**
18. **Harita / canlı aktivite (uluslararası)** — **YOK.**
19. **Bildirim merkezi + tercihler** (in-app notification + aç/kapa) — kısmi.

### C) Faz 3+ 
20. **AI servisi** (chatbox, virtual try-on, ölçü — ayrı Python/FastAPI) — planlı, `AI-SERVIS.md`.
21. **RIP / panel bölme / CNC** — Faz 4.
22. **Mobil** (React Native, OneSignal hazır) — sonra.

---

## 3. ⚠️ Teknik borç / kalite (orta-düşük)
- **PII/apiKey at-rest şifreleme:** `crypto.util` hazır (2FA secret şifreli) ama **Etsy apiKey + fatura PII (TC/SSN/EIN) hâlâ düz metin** → crypto.util ile şifrelenmeli.
- **Global exception filter** yok (prod'da stack trace sızabilir).
- **BullMQ worker'lar** yok — toplu mail/push + (ileride) thumbnail/DPI şu an senkron; kuyruğa alınmalı (Redis hazır).
- **Test** yok — finansal akışlar için birim/entegrasyon testi gerekli.
- **JWT payload role tipi** string (kozmetik).

---

## 4. Önerilen sıra (eksikleri tek tek)
**1)** Toplu import/export → **2)** Raporlama/Dashboard → **3)** Barkod/etiket + Fatura PDF → **4)** QuickBooks gerçek → **5)** PII şifreleme + global exception filter (kalite) → **6)** Etsy API/worker → sonra multi-tenant, document, ticket, search...

> Not: Gerçek dış entegrasyonlar (Etsy/QuickBooks/Stripe/OneSignal/Google) **hesaplar açılınca** bağlanır (`MUSTERI-KURULUM-LISTESI.md`).
