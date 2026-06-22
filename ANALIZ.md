# Printy — Uçtan Uca Teknik Analiz (Back / Front / Mobil)

> B2B Print-on-Demand sipariş + üretim takip platformu.
> Bayiler Etsy üzerinden ABD'ye duvar kağıdı / özel baskı satıyor.
> Bu döküman: mimari, veri modeli, kritik teknik problemler, faz planı ve karar gerektiren açık sorular.

---

## 0. Bu proje aslında ne?

ChatGPT doğru tespit etmiş, altını çiziyorum çünkü **bütün mimari kararı buna bağlı:**

Bu bir "duvar kağıdı sitesi" değil. Bu bir **Print Production ERP + Order Management Platform.**

Üstüne 6-12 ay içinde şunlar **aynı veritabanı ve aynı API'nin üzerine** binecek:
Etsy, QuickBooks, RIP (SAi Flexi/Onyx), AI kalite kontrol, barkod, kesim makinesi, CNC/plotter, mobil.

**Sonuç:** WooCommerce/WordPress ölü doğar. İlk günden Next.js + NestJS + PostgreSQL + object storage ile kurulmalı. Doğru karar bu, tartışmaya gerek yok.

---

## 1. En kritik gerçek: Yük trafik değil, dosya

Bu projeyi yanlış kurduran tuzak burada. Klasik web ölçeklemesi (binlerce eşzamanlı kullanıcı) **senin problemin değil.**

| Beklenti | Değer |
|---|---|
| İlk hedef kullanıcı | ~100 |
| Orta vade (2 yıl) | ~1000 |
| Aynı anda aktif | Asla 1000 değil, gerçekçi olarak 50-150 |
| Haftalık sipariş (1000 kullanıcıda) | ~1500 |
| **Asıl yük** | **300-400 MB TIFF upload + storage** |

Hesap: 1 sipariş ≈ 400 MB. 1000 sipariş = **400 GB**. 5000 sipariş = **2 TB**. Christmas curcununda bu hızla şişer.

### Buradan çıkan 3 demir kural
1. **Dosyalar asla uygulama sunucusunun diskinde tutulmaz.** Object storage'a (R2) gider.
2. **Dosyalar app server'dan geçmez.** Tarayıcı doğrudan R2'ye yükler (presigned URL + multipart). App server sadece "izin fişi" verir.
3. **Lifecycle politikası ilk günden tanımlanır.** Sonsuza kadar 400 MB tutmak iflas ettirir.

### Storage seçimi: Cloudflare R2 (kesin)
S3 uyumlu ama **egress (indirme) ücreti YOK.** Senin senaryonda üretim ekibi bu dosyaları sürekli indirip baskıya gönderecek — AWS S3 olsaydı bu indirmeler her ay fatura yakardı. R2'de upload/storage öder, indirmeyi bedava yaparsın. Senin iş modeline birebir.

### Lifecycle politikası (öneri)
```
0–90 gün    → Hot (R2 standard)         — aktif sipariş, anında erişim
90–180 gün  → tamamlanan siparişler işaretlenir, thumbnail tutulur
180–365 gün → R2 Infrequent Access / arşiv
365 gün +   → otomatik sil VEYA müşteriye "tutalım mı?" sor (ek baskı ihtimali)
```
Ek baskı ihtimali olan işler "arşivle" işaretiyle korunur. Metadata (boyut, müşteri, sipariş) PostgreSQL'de **kalıcı** kalır; sadece ağır dosya temizlenir.

---

## 2. Mimari (uçtan uca)

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare (CDN + WAF + DNS)            │
└───────────────┬──────────────────────────┬──────────────────┘
                │                          │
        ┌───────▼────────┐         ┌───────▼────────┐
        │  Next.js Web   │         │  Mobil (faz 2+) │
        │ Bayi portalı + │         │  React Native   │
        │  Admin panel   │         │     (Expo)      │
        └───────┬────────┘         └───────┬────────┘
                │      aynı REST/JSON API    │
                └─────────────┬──────────────┘
                              │
                   ┌──────────▼───────────┐
                   │     NestJS API        │   ← Hetzner VPS/Cloud
                   │ auth│orders│pricing   │
                   │ files│payments│credits│
                   └───┬──────┬───────┬────┘
                       │      │       │
          ┌────────────┘      │       └──────────────┐
          │                  │                       │
   ┌──────▼──────┐   ┌───────▼───────┐      ┌────────▼────────┐
   │ PostgreSQL  │   │     Redis      │      │  Cloudflare R2  │
   │  (metadata) │   │ cache + queue  │      │  (TIFF/görsel)  │
   └─────────────┘   └───────┬────────┘      └─────────────────┘
                            │
                   ┌────────▼─────────┐
                   │  BullMQ Workers   │  thumbnail, DPI kontrol,
                   │ (arka plan job'lar)│  barkod, etiket, AI (sonra)
                   └───────────────────┘
```

### Sunucu: Hetzner (kesin, GoDaddy/reseller hosting değil)
- Başlangıç: 1 adet **CPX31/CPX41** (4-8 vCPU, 8-16 GB RAM) yeter. 100 kullanıcı için fazlasıyla.
- DB ayrı küçük instance veya managed Postgres (Hetzner'de self-host + günlük yedek).
- Hetzner Almanya/ABD lokasyonu var; ABD müşterisi için **Ashburn (ABD)** lokasyonu seç → düşük latency.
- Aylık maliyet başlangıçta **~40-80€** bandında kalır. R2 storage ayrı, kullandıkça öder.

### Neden bu stack (karar gerekçeleri)
| Katman | Seçim | Neden |
|---|---|---|
| Frontend | **Next.js (App Router)** | SSR + tek codebase'de bayi portalı + admin; SEO gerekmez ama hız ve DX iyi |
| Backend | **NestJS (Node/TS)** | Front ile **aynı dil (TypeScript)** → tipler paylaşılır, tek kişi yönetir; modüler yapı ERP büyümesine uygun |
| DB | **PostgreSQL** | İlişkisel sipariş/fiyat/muhasebe verisi; JSONB ile esnek ürün tanımı |
| ORM | **Prisma** veya **Drizzle** | Tip güvenli, migration yönetimi |
| Cache/Queue | **Redis + BullMQ** | Büyük dosya işleme, thumbnail, barkod arka planda |
| Storage | **Cloudflare R2** | S3 uyumlu, egress bedava |
| Auth | **JWT + refresh, RBAC** | Bayi/admin/üretim/eğitim rolleri |
| Mobil | **React Native (Expo)** | Aynı API + paylaşılan TS tipleri; barkod tarama native |
| Ödeme | **QuickBooks Online API** (öncelik), Stripe (alternatif) | Aşağıda detay |

> **Java alternatifi:** Toplantıda "Nest.js veya Java" geçti. Tek geliştirici (sen) ve front + mobil TypeScript olacağı için **NestJS net kazanır** — tek dil, paylaşılan tipler, daha hızlı iterasyon. Java'yı sadece ileride ayrı bir ekip/yüksek throughput gerekirse düşün. Şu an gereksiz karmaşıklık.

---

## 3. Veri modeli (çekirdek)

```
Organization (Bayi/Firma)
  ├─ id, name, taxInfo, quickbooksCustomerId
  ├─ creditBalance, subscriptionId
  └─ Users[]
       └─ id, email, role(OWNER|STAFF|ADMIN|PRODUCTION|TRAINER), orgId

Product            ── id, name, basePrice, unit(m²/adet), materialId, active
Material           ── id, name, widthInch(24/26), pricePerM2, settings(JSONB)
PricingRule        ── id, productId?, materialId?, orgId?(bayiye özel fiyat),
                       tier(m² aralığı), price, formula(JSONB)

Order
  ├─ id, orgId, createdByUserId, status, totalM2, totalPrice
  ├─ paymentStatus, quickbooksInvoiceId, source(MANUAL|ETSY)
  ├─ status: RECEIVED→IN_PRODUCTION→AWAITING_APPROVAL→READY→SHIPPED
  └─ OrderItems[]
       ├─ id, productId, widthCm, heightCm, computedM2, computedPrice, qty
       └─ Assets[]  (yüklenen baskı dosyaları)

Asset (Dosya)
  ├─ id, orderItemId, r2Key, originalName, sizeBytes, mime(tiff/png/...)
  ├─ status(UPLOADING|READY|PROCESSING|FAILED), lifecycleStage(HOT|ARCHIVE|PURGED)
  ├─ thumbnailKey, dpi, widthPx, heightPx
  └─ checks(JSONB)  ← AI/DPI kalite kontrol sonuçları (faz 3)

CreditLedger       ── id, orgId, delta(+/-), reason, orderId?, balanceAfter, ts
Subscription       ── id, orgId, plan, status, periodStart/End
Invoice            ── id, orgId, orderId, quickbooksId, amount, status, paidAt
ProductionJob      ── id, orderId, ripStatus, panels(JSONB), barcode  (faz 4)
Shipment           ── id, orderId, carrier, trackingNo, status        (faz 2)
AuditLog           ── kim, ne, ne zaman (her kritik aksiyon)
```

**Esnek ürün/fiyat:** `Material.settings` ve `PricingRule.formula` JSONB → kod değiştirmeden yeni ürün/kural tanımlanır. Senin "esnek ürün/fiyat tanımı" ve referans sitedeki "hesaplama kuralları" ihtiyacını bu karşılar. **Bunun spec'ini senden bekliyorum** (bkz. §7).

---

## 4. Kritik/zor parçalar (ChatGPT'nin atladığı detaylar)

### 4.1 Büyük dosya upload (en riskli teknik parça)
- **Presigned multipart upload:** Tarayıcı R2'ye doğrudan, parçalı yükler. 400 MB tek parça değil, 5-10 MB chunk'lar.
- **Resumable (TUS protokolü):** Bayinin interneti koparsa kaldığı yerden devam. Üretim ortamında şart — yoksa 400 MB %90'da koparsa millet çıldırır.
- **İlerleme çubuğu + arka plan:** Yüklerken sayfayı terk edebilmeli.
- Upload bitince worker: thumbnail üret + boyut/DPI oku + metadata'yı Postgres'e yaz.

### 4.2 m² / maliyet hesaplama motoru
- Bayi cm/inç girer → m² hesaplanır → `PricingRule` motoru fiyatı bulur (ürün + materyal + bayiye özel + m² kademesi).
- Canlı önizleme: bayi ölçüyü girerken fiyat anında güncellenir (frontend'de hesap, backend'de doğrulama — **fiyat asla sadece frontend'e güvenmez**).

### 4.3 Ödeme — QuickBooks öncelikli (Stripe değil, başta)
Toplantının netleştirdiği önemli nokta: **Stripe değil, QuickBooks.**
- Sen zaten QuickBooks kullanıyorsun (ABD ön muhasebe + fatura + eyalet vergisi entegre).
- Akış: Sipariş onaylanınca → QuickBooks API fatura keser → ödeme linki üretir → müşteri kartla öder → webhook "paid" döner → sipariş `PAID` olur → muhasebeleşir. **Tek hamlede fatura + tahsilat + muhasebe.**
- Stripe'ı sadece QuickBooks ödeme akışı yetmezse **alternatif** olarak bırak. Şu an QuickBooks Payments yeterli.
- **Faz 1'de:** En azından QuickBooks ödeme linkini ekrandan gösterip durumu takip et. QuickBooks API derin entegrasyonu Faz 2 (3-6 ay).

### 4.4 Sipariş durum makinesi
`RECEIVED → IN_PRODUCTION → AWAITING_APPROVAL → READY → SHIPPED`
Her geçiş loglanır (AuditLog), bayiye bildirim gider (e-posta önce, push sonra). Üretim ekibi admin panelden durumu değiştirir.

### 4.5 Barkod / etiket
Sipariş için QR/barkod üret (PDF etiket). Faz 4'te bu barkod kesim makinesini besleyecek (kalibrasyon + offset kesim). Faz 1'de sadece etiket basımı yeter.

### 4.6 RIP + panel bölme (Faz 4, gerçek üretim otomasyonu)
- "Bold mural": koca görsel **24"/26" panellere** bölünür, panellerin **bindirme (overlap) payı** var.
- Bu panelleme + iş emri SAi Flexi / Onyx hotfolder'ına (JDF/job ticket) gönderilir → production kuyruğuna girer.
- Makineler DXF üzerinden besleniyor (router/plotter/CNC/kesim). Barkod ile makine kalibrasyon + offset kesim yapıyor.
- **Bu en derin ve en değerli otomasyon ama 6+ ay.** Faz 1-2'de hiç dokunma; mimari buna **engel olmasın** diye Asset/ProductionJob modelini şimdiden yer açacak şekilde tasarladım.

### 4.7 AI kalite kontrol + upscale (Faz 3)
- **Karar AI'ı (GPT/Claude API):** "Bu görsel 4 m baskı için yetersiz, min 12000×8000 px öneririm" gibi uyarı üretir. Sunucu/eğitim verisi gerekmez, API key yeter.
- **Upscale AI'ı GPT DEĞİL:** Real-ESRGAN / Topaz / Magnific / Flux Upscaler. Görsel büyütmeyi GPT yapmaz. Bu GPU ister (Hetzner GPU veya servis).
- İkisi farklı: GPT karar verir, özel model büyütür.

---

## 5. Faz planı (iş takvimine kilitli)

İş kısıtı: **Önce para alabilmek. Christmas'tan önce sistem oturmuş olmalı. Başlangıç Temmuz.**

### Faz 1 — Para Kazandıran Çekirdek (ilk ~30 gün, hedef 1-1.5 ay)
Amaç: para toplamaya başlamak. **AI yok, Etsy yok, RIP yok, otomasyon yok.**
- [ ] Bayi auth + roller + firma profili
- [ ] Ürün seçimi
- [ ] Ölçü girme → m²/maliyet otomatik hesap (esnek fiyat motoru)
- [ ] Büyük dosya yükleme (presigned multipart + resumable → R2)
- [ ] Sipariş oluşturma + durumlar (RECEIVED→…→SHIPPED)
- [ ] **Ödeme: QuickBooks ödeme linki + durum takibi** (en kritik)
- [ ] Kredi/bakiye + basit abonelik
- [ ] Admin panel: sipariş görüntüleme, durum değiştirme, dosya indirme
- [ ] Barkod/etiket basımı (PDF)
- [ ] Excel import/export, basit raporlama

### Faz 2 — Operasyonu Hızlandır (1-3 ay)
- [ ] QuickBooks API derin entegrasyon (oto fatura + tahsilat + muhasebe)
- [ ] Etsy Open API v3 (sipariş çekme)
- [ ] Kargo takibi (UPS/FedEx/USPS — Etsy'den tracking no çekip göster)
- [ ] Kredi sistemi olgunlaşması (paket, oto düşüm)
- [ ] Eğitim modülü (yeni bayiler için)

### Faz 3 — AI Kalite (3-6 ay)
- [ ] AI görsel kontrol (DPI/çözünürlük/baskı kalitesi uyarısı — Claude/GPT API)
- [ ] AI upscale (Real-ESRGAN/Topaz/Magnific — GPU)
- [ ] QR ile okutma akışları

### Faz 4 — Üretim Otomasyonu (6-12 ay)
- [ ] RIP entegrasyonu (SAi Flexi / Onyx hotfolder, JDF/job ticket)
- [ ] Panel bölme (24"/26" + overlap) otomatik iş emri
- [ ] Kesim makinesi / CNC / plotter (DXF, barkod kalibrasyon)
- [ ] Mobil uygulama olgunlaşması

---

## 6. Mobil

- **İlk etapta gerek yok.** Next.js'i responsive yap → telefon tarayıcısından çalışır (PWA). Bayiler büyük dosyayı zaten masaüstünden yükler.
- **Gerçek native değer:** Üretim tarafında **QR/barkod tarama ile sipariş durumu güncelleme.** Christmas curcununda eleman telefonla barkodu okutup "kargoya verildi" yapar. İşte mobil burada parlar.
- **Teknoloji:** React Native (Expo). Web ile **aynı API + paylaşılan TypeScript tipleri.** Ayrı backend yazılmaz.
- **Zamanlama:** Faz 2-3 arası. Faz 1'de PWA + responsive yeter.

---

## 7. Senden beklenen spec'ler (bunları atınca netleşir)

Sen "spekleri atacağım" dedin — şunlara ihtiyacım var:
1. **Fiyat/hesaplama kuralları:** Referans sitedeki abonelik + m² hesap mantığı. Ürün × materyal × m² kademesi × bayiye özel fiyat nasıl işliyor? (Excel/örnek faturayla göster.)
2. **Ürün listesi:** Hangi ürünler, hangi materyaller (24"/26" vb.), birim (m²/adet).
3. **Abonelik paketleri:** Kaç paket, ne içeriyor, kredi mantığı.
4. **SAi Flexi detayları:** Hangi menü/iş emri ekranı yönetilecek (faz 4 için, şimdilik sadece bilgi).
5. **QuickBooks:** Hangi ülke/eyalet vergi ayarı, mevcut müşteri yapısı (API eşleştirme için).
6. **Tasarımlar:** Geldiğinde frontend'i ona göre kurarım.
7. **Server spec'leri:** Bahsettiğin GPU/RAM/disk notların — ama §1'e göre başta GPU gerekmez, onu faz 3'te konuşuruz.

---

## 8. Özet karar tablosu

| Konu | Karar |
|---|---|
| Mimari | Next.js + NestJS + PostgreSQL + Redis + R2 (WordPress/Woo YOK) |
| Sunucu | Hetzner Cloud (ABD lokasyonu), başta tek küçük instance |
| Dosya | R2 object storage, presigned multipart, lifecycle politikası |
| En kritik problem | Trafik değil → büyük TIFF upload + storage maliyeti |
| Ödeme (öncelik) | QuickBooks Online (Stripe alternatif) |
| İlk teslim | Faz 1 = para kazandıran çekirdek, ~1-1.5 ay |
| Sabit takvim | Christmas öncesi oturmuş olmalı |
| Mobil | Faz 2-3; web PWA önce; native değer = barkod tarama |
| AI | Faz 3; karar=GPT/Claude, upscale=özel model (GPT değil) |
| RIP/üretim oto. | Faz 4; mimari şimdiden yer açıyor |
