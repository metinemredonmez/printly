# Ortak Doku (printy) — Yapılacaklar Yol Haritası (öncelikli)

> Kaynak: `GENEL-BACKEND-ANALIZ.md` (genel olgunluk ~61/100) + eksik-parça görev turu + mobil/kuyruk dokümanları.
> Sıra: **P0 kritik → P1 yüksek → P2 orta → P3 sonra → CRED (dış hesap bekleyen)**.
> Görev numaraları `/tasks` listesiyle eşleşir.

---

## 🔴 P0 — KRİTİK (prod-blocker, HEMEN)
Para açıkları + canlıya çıkışı engelleyen kalemler. Bunlar kapanmadan prod'a çıkılmaz.

| # | İş | Dosya | Neden |
|---|---|---|---|
| **#26** | **K1 — Bakiye top-up'ı gerçek ödemeye bağla** | `credits/credits.service.ts:36`, `credits.controller.ts:27` | Self-service `/me/topup` tahsilat olmadan bakiye + %40 indirim veriyor → dolandırıcılık |
| **#27** | **K2 — TEAM_LEADER self-terfi açığını kapat** | `memberships/memberships.module.ts:127-130,161` | USER kendini bedelsiz lider yapıp fiyat çarpanını 2→1 düşürüyor |
| **#28** | **K3 — İptal edilen BALANCE siparişinde iade (REFUNDED)** | `orders/orders.service.ts` updateStatus | İptal'de bakiye iadesi yok; `REFUNDED` enum ölü → müşteri parası yanar |
| **#29** | **Y1 — `main.ts` trust proxy** | `main.ts` | nginx arkasında ThrottlerGuard tek IP'ye sayıp rate-limit'i çökertiyor |
| **#17** | **K4 — Finansal akış testleri** | `package.json` (jest yok) | Para hesaplayan hiçbir akış test edilmemiş; regresyon prod'a sızar |

## 🟠 P1 — YÜKSEK (prod öncesi güçlü öneri)
| # | İş | Neden |
|---|---|---|
| (yeni) | **FK index + pagination** (Order.status/userId/organizationId; listeleme uçları) | 10K+ kayıtta sequential scan + limitsiz sorgu |
| **#22** | **Bull Board dashboard + retry/backoff + idempotency + failed alarm** | Kuyruk güvenilirliği + izlenebilirlik yok |
| (yeni) | **Auth sertleştirme**: OTP/2FA brute-force limiti + `ENCRYPTION_KEY` prod'da Joi ile zorunlu | Kaba kuvvet + zayıf secret riski |
| (yeni) | **Gözlemlenebilirlik**: yapısal log + graceful shutdown + hata izleme (Sentry) | Prod'da kör nokta |

## 🟡 P2 — ORTA (özellik tamamlama — eksik-parça turu)
| # | İş |
|---|---|
| **#10** | Document yönetimi (sipariş/bayi belge upload-download R2) |
| **#11** | Ticket / destek modülü |
| **#12** | Global Search |
| **#13** | Archive (eski sipariş + R2 lifecycle) |
| **#14** | GDPR/KVKK veri export/delete |
| **#16** | Bildirim merkezi + tercihler |
| (yeni) | DRY/refactor: durum-geçiş & fiyat sabitlerini merkezileştir, tsconfig strict |

## 🔵 P3 — SONRA (büyüme / mobil)
| # | İş |
|---|---|
| **#15** | Harita / canlı aktivite (geocode + WebSocket) |
| **#23** | QR/barkod scan backend (POST /scan istasyon→durum) |
| **#24** | Mobil QR tarayıcı uygulaması (React Native) |
| **#25** | Mobil virtual try-on / AR / 3D + AI servis |

## 🔒 CRED — Dış hesap bekliyor (hesap açılınca)
| # | İş |
|---|---|
| **#18** | Etsy API sipariş çekme worker |
| **#19** | QuickBooks + Stripe gerçek ödeme — **K1'in kalıcı çözümü buraya bağlanır** |
| **#20** | Google OAuth + telefon SMS + OneSignal key |
| **#21** | Google Sheets/Drive otomasyonu |

---

### Çalışma akışı (her kalem için)
implement → `npm run build` (Node 20) → migration gerekiyorsa `migrate deploy` → smoke test (mock-login + curl) → commit `[#N]` → push → görevi `completed` işaretle.
