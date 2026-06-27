# Printful ↔ Ortak Doku — Alan-Alan Fark Analizi (Gap Analysis)

> Hazırlık tarihi: 2026-06-27. Kapsam: Printful'un tüm özellik envanteri vs. Ortak Doku (NestJS backend + Next.js frontend) mevcut yetenekleri. Doğrulama: backend kaynağı (`backend/src`) ilgili modüllerde elle teyit edildi (mockup üreticisi yok, gerçek Etsy API çağrısı yok, AI görsel/upscale/arka-plan kaldırma yok, desen-tekrar motoru yok, DPI denetimi istemci-değerine dayalı).

## 1. Yönetici Özeti

Ortak Doku'nun **operasyon, finans ve üretim omurgası Printful ile büyük ölçüde eşdeğer, bazı alanlarda daha güçlü**:

- **Daha güçlü olduğumuz yerler:** m² bazlı parametrik fiyatlama (Printful sabit-variant'ı bunu yapamıyor), yarış-koşulsuz atomik cüzdan/bakiye + ledger, kademeli üyelik (Standart/Pro/Elit) + otomatik aidat yenileme, HMAC imzalı partner webhook (retry/backoff), proof onay + artwork revizyon, üretim routing + QR istasyon okutma + Kanban, white-label slip/tracking, KVKK/GDPR export+anonimleştirme, çok-kiracılı branding, R2 dosya + spec doğrulama, denetim kaydı.
- **Çekirdek stratejik avantaj:** Bizim 3 ürün hattı (m² Duvar Kağıdı, büyük-format Wall Decal, Ahşap/CNC) **Printful'da hiç yok**. Printful POD wallpaper, büyük-format removable wall decal ve doğrudan ahşap/CNC üretmiyor. Bu, doldurduğumuz pazar boşluğunun ta kendisi.

**Asıl boşluklar tasarım/içerik katmanında yoğunlaşıyor** (cred GEREKTİRMEZ, yüksek değer):
1. **Hiç mockup üreticisi yok** — Etsy satış dönüşümünün en kritik aracı.
2. **Sunucu-taraflı görsel/DPI denetimi zayıf** — mevcut doğrulama istemcinin gönderdiği `dpi` değerine güveniyor, dosyayı açıp gerçek pikseli/DPI'ı/TIFF iddiasını okumuyor; otomatik upscale yok.
3. **Desen-tekrar (repeat/half-drop/seamless) motoru yok** — duvar kağıdı iş kolumuzun çekirdeği.
4. **Bulk/hacim indirim motoru yok**, resale-certificate/ABD eyalet vergi davranışı yok, bayi net-kâr raporu yok.

**CRED bekleyenler:** Etsy API otomatik sipariş çekme + tracking sync-back + production-partner beyanı; gerçek ödeme (Stripe/QuickBooks); Google OAuth/SMS/OneSignal push; AI görsel sağlayıcısı.

**Kapsam dışı (fit=na):** tişört iç/dış etiket, nakış, sabit-variant tişört/poster/canvas ürünleri, Getty stok görsel — modelimize uymaz.

---

## 2. Alan-Alan Fark Tablosu

| Özellik | Printful | Biz | Uygunluk | Cred-Blok | Efor |
|---|---|---|---|---|---|
| Mockup / oda-sahne üretici | 1.400+ mockup + Custom Maker + API | none | high | hayır | L |
| Sunucu-taraflı DPI denetimi + upscale | Gerçek DPI okuma + AI upscale + sRGB | partial | high | hayır | M |
| Desen-tekrar (seamless/half-drop) | Pattern Creator | none | high | hayır | L |
| Print template / bleed / cut-line / toolpath | Ürün-bazlı indirilebilir template | partial | high | hayır | M |
| Bulk / hacim indirimi | 25+ adet %55'e kadar | none | high | hayır | M |
| Resale certificate + ABD eyalet vergisi | Yükle→onay→muafiyet + facilitator | none | high | hayır | M |
| Bayi net-kâr / marj raporu | Statistics + Etsy Profit Calc | partial | high | hayır | M |
| Etsy API sipariş çekme + tracking sync-back | Auto import + geri yazma + partner beyanı | partial | high | **EVET** | L |
| Self-servis tasarım editörü | Design Maker (metin/katman/grid) | none | medium | hayır | L |
| Arka plan kaldırma + cut-contour | Tek-tık BG removal | none | medium | hayır | M |
| Pack-in / branding preset (kit) | Insert + preset atama | partial | high | hayır | M |
| Numune limit + anti-abuse | Kademeli limit + adres sınırı | partial | high | hayır | S |
| Split shipment / partial fulfillment | Çoklu paket + tracking | none | high | hayır | M |
| Sipariş klonlama / reorder | Copy order | none | high | hayır | S |
| Fraud-risk skoru | MinFraud sinyalleri | none | medium | hayır | M |
| Wallet auto-recharge | Eşik-bazlı otomatik yükleme | partial | high | **EVET** | M |
| Çoklu satış kanalı (Shopify/Woo/Amazon) | 20+ entegrasyon | none | low | **EVET** | L |
| Public API (store token/scope/webhook) | OAuth + 14 olay | partial | medium | hayır | M |
| Üyelikle feature-gating + setup-ücret affı | large-print kilidi | partial | medium | hayır | S |
| AI görsel üreteci (text-to-image) | Prompt→görsel→upscale | none | medium | **EVET** | M |
| QuickBooks / muhasebe | Zapier/Make köprü | partial | medium | **EVET** | M |
| Kapasite-bazlı routing + yedek fallback | Auto-route + backup tesis | partial | medium | hayır | M |
| Markalı tracking (çok dil/sosyal) | Logo+sosyal+11 dil | partial | medium | hayır | S |
| Markalı iade/gönderici adresi (2 mod) | Platform vs bayi adresi | partial | high | hayır | M |
| Sorun-raporu (Submit Issue) reprint/iade | Foto+rapor→reprint/wallet | partial | high | hayır | M |
| 3 aşamalı QC + hold/fail tetikleyici | Tasarım→üretim→son | partial | high | hayır | M |
| Tişört iç/dış etiket + nakış | inside/outside label | none | **na** | hayır | S |
| Sabit-variant ürünler (canvas/poster/sticker) | Sabit matris | none | **na** | hayır | S |
| Getty / 80M+ stok görsel | Design Maker içi | none | **na** | **EVET** | M |

---

## 3. Gruplama

### A) HEMEN yapılabilir — cred'siz, yüksek değer
Bunlar API anahtarı gerektirmez, doğrudan mevcut NestJS+Next mimarisine oturur ve satış/operasyon değeri en yüksek olanlardır:

- **Sunucu-taraflı görsel/DPI denetimi + otomatik upscale (M)** — mevcut `files.service.ts` istemci `dto.dpi`'ına güveniyor; gerçek piksel okuma şart. Red/iade oranını doğrudan düşürür.
- **Mockup / oda-sahne üretici (L)** — Etsy dönüşümünün en kritik aracı; bayi fotoğraf çekmeden listeler = en büyük değer önerisi.
- **Desen-tekrar motoru (L)** — duvar kağıdı çekirdek özelliği, bizde hiç yok.
- **Print template / bleed / cut-line (M)** — bayi hatasını üretim öncesi sıfırlar.
- **Bulk/hacim indirim motoru (M)** + **indirim çakışma kuralı** ("stack etme, en avantajlıyı uygula" — marj koruması).
- **Resale certificate + ABD eyalet vergi davranışı (M)** — B2B üretici olarak yasal zorunluluk + maliyet doğruluğu.
- **Bayi net-kâr raporu (M)** — Printful'un retail-cost birleştirme boşluğunu kapatır.
- **Hızlı kazanımlar (S/M):** Sipariş klonlama/reorder (S), numune anti-abuse (S), split-shipment/partial (M), sorun-raporu→reprint/iade (M), 3-kapılı QC + hold/fail (M), markalı iade adresi (M), fraud-risk skoru (M), pack-in/branding preset (M).

### B) CRED bekleyen (anahtar gelince devreye)
- **Etsy API** otomatik sipariş çekme + tracking sync-back + production-partner beyanı (L) — şimdilik manuel/CSV sipariş köprüsüyle kısmi karşıla (Printful'da CSV yok = fırsat).
- **Wallet auto-recharge** (kart-on-file için Stripe gerekir) — o zamana kadar "düşük bakiye uyarısı" ile karşıla.
- **AI görsel üreteci** (görüntü modeli anahtarı) — mutlaka upscale+DPI zinciriyle.
- **QuickBooks** native push.
- **Google OAuth / SMS / OneSignal push** (login ve toplu push altyapısı kodda hazır, anahtar bekliyor).

### C) Kapsam dışı (fit=na, geliştirme)
- Tişört iç/dış etiket + nakış dijitizasyon (apparel).
- Sabit-variant tişört/poster/canvas/küçük sticker/tapestry.
- Getty/80M+ stok görsel (lisans+telif karmaşası).
- Çoklu satış kanalı (Shopify/Woo/Amazon) — düşük öncelik; tek kanal Etsy. Mimariyi kanal-agnostik kur ama şimdi yatırma.
- Mobil RN QR + AR/3D try-on — kullanıcı tarafından zaten kapsam dışı.

---

## 4. Önerilen 3 Aşamalı Yol Haritası

### Faz 1 — "Tasarım & Print-Readiness Kapısı" (cred'siz, en yüksek ROI)
**Hedef:** Bayinin üretim öncesi hata yapmasını engelle + Etsy listing kalitesini yükselt.
1. Sunucu-taraflı görsel/DPI denetimi (sharp ile gerçek piksel) + otomatik upscale + sRGB normalize → düşük çözünürlükte otomatik HOLD.
2. Mockup/oda-sahne üretici (BullMQ `mockups` kuyruğu, R2 çıktısı; duvar kağıdı/decal/ahşap sahne setleri).
3. Desen-tekrar motoru (half-drop/brick/mirror + drop-match önizleme).
4. Ürün-bazlı print template / bleed / safe-area / cut-line / CNC toolpath indirme.
5. Hızlı kazanımlar: sipariş klonla/reorder, numune anti-abuse.

### Faz 2 — "Ticari & Operasyonel Olgunluk"
**Hedef:** Marj görünürlüğü, vergi uyumu, kalite/iade disiplini.
1. Bulk/hacim indirim motoru + indirim çakışma kuralı.
2. Resale certificate + ABD eyalet satış vergisi davranışı (Etsy facilitator çifte-vergi koruması).
3. Bayi net-kâr/marj raporu (Etsy retail fiyatı + bizim maliyet).
4. Sorun-raporu (foto→reprint/cüzdan iadesi) + markalı iade adresi (2 mod) + 3-kapılı QC/hold-fail.
5. Split-shipment/partial fulfillment + çoklu tracking, fraud-risk skoru, pack-in/branding preset.

### Faz 3 — "Entegrasyon & Self-Servis Genişleme" (cred gelince + ileri)
1. Etsy API: otomatik sipariş çekme + tracking sync-back + production-partner beyanı; sonra Wallet auto-recharge (Stripe).
2. AI görsel üreteci (upscale zinciriyle) + arka plan kaldırma + cut-contour + hafif metin/yerleştirme editörü.
3. QuickBooks native, public API (store-scoped token/scope), kapasite-bazlı routing + yedek fallback, üyelikle feature-gating.
4. (Opsiyonel/düşük öncelik) çoklu satış kanalı, markalı tracking zenginleştirme.

---

**Net sonuç:** Operasyon/finans/üretim omurgamız olgun ve yer yer Printful'u geçiyor. Rekabet farkı **tasarım/print-readiness/mockup katmanını** (Faz 1) hızla kapatıp, **m² duvar kağıdı + büyük-format decal + ahşap/CNC** boşluğundaki doğal avantajı Etsy'de görünür kılmaktan geçiyor.