# Entegrasyon / Dis API Haritasi

> ABD pazarinda Etsy bayileri icin B2B Print-on-Demand platformu (Wallpaper m2 / Wall Decal / Wood-CNC). Stack: NestJS + Postgres + Cloudflare R2 + Redis, Hetzner. Para birimi USD. Olcek ~100 → ~1000 kullanici. Tahsilat onceligi QuickBooks. Tum fiyat/limit verileri Haziran 2026 itibariyla dogrulanmistir; varsayim olan yerler ayrica isaretlenmistir.

**Faz tanimi:** Faz 1 = MVP / cekirdek is akisi · Faz 2 = otomasyon / olcek · Faz 3 = gelismis finans-raporlama / maliyet optimizasyonu · Faz 4 = opsiyonel / olcek-sonrasi.

---

## 1) Ozet Ana Tablo

| API | Ne icin | Faz | Auth | Ucret | Oncelik | Doc URL |
|-----|---------|-----|------|-------|---------|---------|
| **Etsy Open API v3** | Siparis cekme (receipts/transactions), listing eslestirme, fulfillment geri-yazma | **1** | OAuth2 Auth Code + zorunlu PKCE | API ucretsiz | **Kritik** | https://developers.etsy.com/documentation/ |
| **QuickBooks Online (Accounting)** | B2B fatura kesme + odeme kaydi, vergi (AST) | **1** | OAuth2 Auth Code | Gelistirme ucretsiz; okuma 500K/ay ucretsiz | **Kritik** | https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/payment |
| **QuickBooks Payments** | Kart / ACH tahsilat (fatura uzerinden) | **2** | OAuth2 (`...payment` scope) | %2.9 + $0.25 kart; ACH ayri | **Yuksek** | https://developer.intuit.com/app/developer/qbpayments/docs/learn/explore-the-quickbooks-payments-api |
| **Stripe** | QuickBooks Payments'a alternatif/yedek tahsilat; abonelik | **2-3** | API key + webhook secret | %2.9 + $0.30 kart; ACH %0.8 (max $5) | Orta (yedek) | https://stripe.com/pricing |
| **EasyPost** | Cok-tasiyici rate-shopping, etiket, tracking, adres dogrulama | **2** | API key (HTTP Basic) | 3.000 etiket/ay ucretsiz, sonra $0.08/etiket | **Yuksek (birincil kargo)** | https://www.easypost.com/pricing/ |
| **Shippo** | EasyPost alternatifi (USPS-agir akista) | **2** | API key (`ShippoToken`) | PAYG $0.05/etiket; Pro $19/ay | Orta (B plani) | https://goshippo.com/pricing/api |
| **USPS Addresses v3** | Uretim-kalite CASS adres dogrulama + ZIP+4 lookup | **1-2** | OAuth2 (client credentials) | Ucretsiz | **Yuksek** | https://developers.usps.com/addressesv3 |
| **UPS Developer API** | Dogrudan tasiyici (yalniz aggregator disi strateji) | **4+** | OAuth2 (client credentials) | API ucretsiz | Dusuk (genelde hic) | https://developer.ups.com/catalog |
| **FedEx Developer API** | Dogrudan tasiyici (yalniz aggregator disi strateji) | **4+** | OAuth2 | API ucretsiz; Ship API certification zorunlu | Dusuk (genelde hic) | https://developer.fedex.com/api/en-us/home.html |
| **zippopotam.us** | ZIP → sehir/eyalet auto-fill (yalniz prototip UX) | **1** (→Faz 2'de degistir) | Yok (public) | Ucretsiz, SLA yok | Dusuk (gecici) | https://docs.zippopotam.us/ |
| **Google Address Validation** | Global adres dogrulama (ABD disina cikilirsa) | **3-4** (ops.) | API key | ~$200/ay ucretsiz kredi (~12K dogrulama) | Dusuk (ops.) | https://developers.google.com/maps/documentation/address-validation |
| **Anthropic Claude Vision** | Gorsel QA / renk-artefakt yorumu (flag uretimi) | **2** | API key (`x-api-key`) | Token bazli; ~$0.004-0.024/gorsel | Orta | https://platform.claude.com/docs/en/build-with-claude/vision |
| **OpenAI Vision** | QA icin yedek vision saglayici (ops.) | **2** (ops.) | API key (Bearer) | ~$0.001-0.02/gorsel (varsayim) | Dusuk (yedek) | https://platform.openai.com/docs/guides/vision |
| **Replicate (Real-ESRGAN)** | AI upscale (dusuk-rez → baski cozunurlugu) | **2-3** | API token (Bearer) | GPU sn-bazli; ~$0.002-0.01/gorsel | Orta (birincil upscale) | https://replicate.com/pricing |
| **Stability AI Upscale** | Conservative/Creative upscale alternatifi | **2-3** | API key (Bearer) | Kredi: Conservative ~$0.25; Creative ~$0.60 | Dusuk (alt.) | https://platform.stability.ai/pricing |
| **Magnific AI** | Premium "reimagine" upscale | **3-4** | API key | ~$0.08/2K, ~$0.16/4K | Dusuk (premium nis) | https://www.myarchitectai.com/blog/magnific-ai-pricing |
| **Topaz Labs API** | Endustri-standardi upscale (kurumsal) | **3** | API key | Kurumsal, fiyat seffaf degil | Dusuk | https://www.topazlabs.com/api |
| **sharp / libvips** | DPI okuma, thumbnail, TIFF, panel bolme (omurga) | **1** | Yok (kutuphane) | Ucretsiz (MIT) | **Kritik** | https://sharp.pixelplumbing.com/ |
| **Cloudflare R2** | Obje deposu (orijinal/TIFF/panel/thumbnail) + CDN | **1** | S3 key veya CF API token | $0.015/GB/ay; egress $0 | **Kritik** | https://developers.cloudflare.com/r2/pricing/ |
| **Google Sheets API** | Siparis kuyrugu operasyon gorunumu (gecici) | **1** (→Postgres) | OAuth2 / Service Account | Ucretsiz | Dusuk (gecici) | https://developers.google.com/workspace/sheets/api/limits |
| **Google Drive API** | Dosya arsivi kopru (gecici) | **1** (→R2) | OAuth2 / Service Account | API ucretsiz; depolama ucretli | Dusuk (gecici) | https://developers.google.com/workspace/drive/api/guides/limits |
| **Postmark** | OTP + siparis/uretim bildirim e-postalari | **1** | API key (`X-Postmark-Server-Token`) | $15/ay = 10K e-posta | **Yuksek (birincil e-posta)** | https://postmarkapp.com/pricing |
| **Amazon SES** | Maliyet-optimal e-posta (olcek plani) | **1 alt. / 3** | AWS IAM + SMTP | $0.10/1.000 e-posta | Orta (olcek) | https://aws.amazon.com/ses/pricing/ |
| **Resend** | Modern DX e-posta alternatifi | **1** (alt.) | API key (Bearer) | Free 3K/ay; Pro $20/ay | Orta (alt.) | https://resend.com/pricing |
| **Twilio (SMS/Verify)** | SMS OTP / kritik bildirim (opsiyonel) | **3-4** | Account SID + Auth Token | SMS ~$0.0083/segment; Verify $0.05/dogrulama | Dusuk (ops.) | https://www.twilio.com/docs/verify |
| **Hetzner Cloud** | VPS (API, Postgres, Redis worker) | **1** | Cloud API token | CX22 ~€4.35/ay; CPX22 ~€7.99/ay | **Kritik** | https://www.hetzner.com/cloud |
| **Cloudflare (DNS/CDN/WAF)** | DNS, CDN, SSL, DDoS, temel WAF | **1** | API token (scoped) | Free; Pro $20/ay | **Yuksek** | https://www.cloudflare.com/plans/ |

---

## 2) Faza Gore Detayli Aciklamalar

### Faz 1 — MVP / Cekirdek Is Akisi

Bu fazda platformun "siparis girer → dosya islenir → fatura kesilir → bildirim gider" temel hatti calismali.

- **Etsy Open API v3 (cekirdek):** Siparis cekme olmadan platform islemez — giris kapisi budur. `getShopReceipts` ile delta-polling (`updated_after` mantigi) yapilir; **webhook yoktur**, senkron BullMQ + Redis ile zamanlanmis job olarak kurulur. Siparis okumak icin **`transactions_r` scope zorunlu**; `buyer_email` icin ayri izin gerekir. **Commercial Access basvurusu bu fazin EN BASINDA kuyruga alinmali** (asagida Bolum 3). Fulfillment geri-yazma (`createShopReceiptShipment`) Faz 2'ye birakilabilir.
- **QuickBooks Online Accounting (cekirdek):** Fatura kesme (Invoice) + odeme kaydi (Payment, `LinkedTxn` ile baglama). Sandbox guclu ve ucretsiz (5 sirkete kadar). Tek-realm mimari varsayimi (Ortak Doku'nun tek kendi QuickBooks sirketi fatura keser) — **is modeline gore netlestirilmeli**.
- **sharp / libvips (omurga):** DPI/cozunurluk uyarisi **%100 deterministik kod** olmali (`metadata().density`), AI'ya birakilmamali. TIFF density'de EXIF desteklenmez → `xres/yres` (px/mm) kullan (en sik atlanan nokta). Buyuk dosyalarda stream API; panel bolme `extract()` dongusu + parametrik bleed payi.
- **Cloudflare R2 (omurga):** Orijinal/TIFF/panel/thumbnail icin ana depo. **Egress $0** — isleme pipeline'ini R2 etrafinda serbestce kur. Client'tan dogrudan R2'ye presigned URL ile yukleme (sunucu RAM/bant korunur).
- **Postmark (birincil e-posta):** OTP gecikmeye en duyarli mesaj; Postmark deliverability'de lider. **DKIM + Return-Path dogrulamasi Faz 1'de sart**, yoksa spam'e duser. OTP/bildirimleri transactional stream'de tut.
- **Hetzner + Cloudflare DNS/CDN/WAF (omurga):** CX22/CPX22 + Cloudflare Free yeterli. **Kritik tuzak:** mail DNS kayitlari (MX/SPF/DKIM/DMARC) Cloudflare'de **proxy KAPALI (DNS-only, gri bulut)** olmali — aksi halde OTP/bildirim e-postalari teslim edilmez. En sik yapilan hata.
- **zippopotam.us (gecici UX):** Yalniz ZIP→sehir/eyalet auto-fill icin; gercek adres dogrulama degil. Faz 2'de USPS v3 ile degistir.
- **Google Sheets / Drive (gecici kopru):** Mevcut mockup davranisini korumak icin. Sheets = sadece operasyon gorunumu (`batchUpdate` ile, satir satir DEGIL), Drive = gecici arsiv koprusu. Gercek veri Postgres + R2'de.

### Faz 2 — Otomasyon / Olcek

- **EasyPost (birincil kargo):** Tek API'den UPS/FedEx/USPS rate-shopping + etiket + tracking + adres dogrulama. **3.000 etiket/ay ucretsiz** kucuk olcegi parasiz karsilar. Webhook'lari ayri controller + BullMQ ile islet, tracking event'lerini idempotent (event id dedup) Postgres'e yaz. **Dikkat:** Haziran 2026'da USPS harcamasinda %3 fee + cuzdan kart-yukleme %3.75 fee geldi — USPS-agir akista maliyeti gizlice sisirir.
- **Shippo (B plani):** Per-label $0.05 (EasyPost'un $0.08'inden ucuz) ve %3 USPS fee yok; ama EasyPost'un 3.000 ucretsiz etiketi dusuk hacimde Shippo'yu geçer. **Kirilim ~aylik 240-300 etiket** civari. Vendor lock-in icin `ShippingProvider` arayuzu arkasinda degistirilebilir tut.
- **USPS Addresses v3:** zippopotam.us'un yerine gecen resmi CASS dogrulama + ZIP+4 lookup. OAuth2 token'i Redis'te cache'le. **12 Temmuz 2026'da v3 enhancement** (near-real-time, gelismis matching) geliyor — sonrasinda yeni davranisa gore test et. POD'da yanlis adres = yeniden basim + yeniden gonderim = dogrudan zarar; checkout dogrulamasi kritik.
- **QuickBooks Payments (yuksek):** Fatura uzerinden gercek kart/ACH tahsilat. **ABD-only**, hesap acmak icin **SSN + underwriting** gerekir (takvim riski). Payments sandbox'i zayif — test kart akisini erken dogrula.
- **Stripe (yedek/alternatif):** QuickBooks Payments onayi/UX'i surtusurse veya abonelik modeli gelirse devreye. **Cift kayit sorunu:** Stripe ile tahsilatta odeme QuickBooks defterine otomatik dusmez → Stripe webhook → QuickBooks Payment entity yazma katmani gerekir. Bu, "QuickBooks onceligi" tercihini dogrular.
- **Claude Vision (AI QA):** Gorseli 1000-1500px'e kucultup gonder (artefakt/banding hala gorunur, token maliyeti minimum), **JSON structured output** al (dpi_ok, color_warning, sharpness_score). Rubric'i prompt caching ile %90 ucuzlat. **Claude DPI olcemez** (28px patch padding + kucultme) — DPI deterministik sharp isi. AI karar degil "flag" uretsin, insan onayi kalsin (B2B'de yanlis red maliyetli). **Haiku 4.5** en ucuz baslangic.
- **Replicate Real-ESRGAN (upscale):** Dusuk-rez yuklemeleri baski cozunurlugune cikar. **Conservative/ESRGAN tercih et, Creative/Magnific'ten kacin** (baski sadakati riski — "detay uydurur"). Senkron degil webhook + BullMQ kuyrugu (upscale uzun surer, HTTP isteğini bloklama).

### Faz 3 — Gelismis Finans-Raporlama / Maliyet Optimizasyonu

- **QuickBooks (raporlama):** Mutabakat, vergi otomasyonu (AST), gelir raporlama. **Vergi tuzagi:** Etsy zaten son-tuketici satis vergisini topluyor; senin bayiye kestigin B2B fatura ayri islem — cift vergilendirme/yanlis nexus'a dusme, vergi hesabini QuickBooks AST'ye birak, B2B vs B2C ayrimini net modelle.
- **Amazon SES (e-posta olcek):** ~1.000 kullaniciya dogru hacim ciddi artarsa Postmark'tan SES'e ($0.10/1.000, en ucuz) gec. Ama **sandbox cikisi + DKIM/DMARC + bounce yonetimi (SNS)** ek is yuku — erken degil, hacim gercekten buyuyunce. SES yeni vendor (AWS) ekler.
- **Topaz / Stability / Magnific (premium upscale):** Hacim olusunca kalite katmani. Topaz API fiyati kurumsal/seffaf degil — hacimde satisla gorus.
- **Cloudflare Pro / Hetzner olcek:** Bot/kotuye kullanim cikarsa Cloudflare Pro ($20/ay, gelismis WAF + Super Bot Fight Mode). Postgres'i ayri node'a ayir (Hetzner managed DB sunmaz — kendin islet ya da harici yonetilen Postgres).

### Faz 4 — Opsiyonel / Olcek-Sonrasi

- **Dogrudan UPS / FedEx:** Yalniz aggregator marji kabul edilemez olunca veya yuksek-hacim dogrudan indirim sozlesmesi alininca. Per-carrier certification (FedEx Ship API zorunlu), token limitleri (FedEx 1.000 token/gun), normalize tracking kaybi → kucuk ekip icin surtunme. **Genelde hic gerekmez.**
- **Twilio SMS / Verify:** E-posta OTP B2B masaustu bayiler icin yeterli. SMS gerekirse **Twilio Verify** kullan. **A2P 10DLC kaydi gunler-haftalar surer** — gerekirse onceden basvur (asagida Bolum 3).
- **Kendi GPU upscale (Hetzner self-host):** Real-ESRGAN container; gorsel basina marjinal maliyet ~0. Dusuk hacimde israf — ~1000 kullaniciya yaklasirken break-even hesabi yap.
- **Google Drive/Sheets tamamen kaldirma:** Kalici backend Postgres + R2'ye tam konsolidasyon; Drive/Sheets koprulerini sokup at.

---

## 3) Simdi Acilmasi / Basvurulmasi Gereken Hesaplar (Takvim Riskleri)

Asagidakiler **onay/inceleme suresi** gerektirdigi icin Faz 1'in EN BASINDA, kod yazmadan paralel baslatilmali. Bunlar projenin kritik takvim riskleridir.

| # | Hesap / Surec | Neden sure alir | Tahmini sure | Ne zaman baslat |
|---|---------------|-----------------|--------------|-----------------|
| **1** | **Etsy Commercial Access** | Uygulaman baska saticilarin magazalarini yonetir → genel-amacli uygulama. Personal access sadece 5 magazaya baglanir; ~100+ bayi icin yetmez. Onay case-by-case. | **24-48 saat ↔ 20+ gun / aylar** (cok degisken) | **Faz 1 gun 0** — en buyuk takvim riski. Bu beklerken personal access (5 magaza) ile gelistir/test et. |
| **2** | **QuickBooks Payments merchant hesabi** | Gercek tahsilat icin **SSN + underwriting (kredi/basvuru onayi)** gerekir. ABD-only. Payments sandbox zayif. | Birkac gun-haftalar (underwriting'e bagli) | **Faz 2'den ONCE** — tahsilat onceligin bu, gecikme tahsilati durdurur. Sandbox kart akisini erken dogrula. |
| **3** | **Amazon SES production access** | Yeni hesap sandbox'ta — sadece dogrulanmis adreslere gonderir. Prod icin destek bileti ile production access talebi. | **Birkac gun** | SES'i secersen Faz 1 planinda ongor (e-posta MVP'nin parcasi). |
| **4** | **Twilio A2P 10DLC kaydi** | ABD'de SMS icin zorunlu: Brand registration ($4.50 sole-prop / $46 standard) + Campaign ($15 + $1.50-10/ay). Tasiyici onayi. | **Gunler-haftalar** | Yalniz SMS'e gecilecekse (Faz 3/4), karar verilir verilmez onceden basvur. |
| **5** | **Etsy `buyer_email` izni** | Alici e-postasi icin `transactions_r` uzerine ek izin talebi. | Degisken | Commercial Access ile birlikte iste (gerekiyorsa). |

**Hemen acilabilen (onay beklemeyen, ama erken kurulmali) hesaplar:** Etsy Developer App (PKCE keystring), QuickBooks Developer (sandbox), Cloudflare (DNS+R2+WAF tek hesap), Hetzner Cloud, Postmark (DKIM dogrulamasi gun alir — erken yap), Anthropic API, Replicate, EasyPost/Shippo.

---

## 4) Bu Projeye Ozel Tavsiyeler (Hangi Saglayici, Neden)

1. **Tahsilat: QuickBooks Payments birincil, Stripe yedek.** Gerekce: QuickBooks tek-defter avantaji — fatura, odeme ve muhasebe ayni yerde, cift-kayit derdi yok. Stripe ile tahsilat yaparsan odeme QuickBooks'a otomatik dusmez ve ayri bir webhook→Payment-entity senkron katmani yazman gerekir. Maliyet neredeyse esit (QB %2.9+$0.25 vs Stripe %2.9+$0.30). **Tetikleyici:** QuickBooks Payments onayi gecikirse VEYA yuksek-tutarli B2B'de **Stripe ACH %0.8 (max $5)** ile maliyet dusurmek istersen Stripe'a kay — o durumda senkron katmanini bastan planla.

2. **Kargo: EasyPost ile basla, Shippo'yu yedekte tut.** Gerekce: EasyPost'un **3.000 ucretsiz etiket/ay** tier'i kucuk olcekte etiket maliyetini sifira indirir; tek API ile cok-tasiyici rate-shopping (agir Wood/CNC paketleri icin kritik). **Tetikleyici:** Aylik ~300 etiketi gecince VEYA akis USPS-agir olup %3 USPS fee canini yakinca Shippo'ya ($0.05, fee yok) gec. Bunun icin **`ShippingProvider` soyutlama arayuzu** yaz — vendor lock-in'i azalt.

3. **Adres dogrulama: USPS Addresses v3 (resmi), zippopotam.us yalniz MVP UX.** Gerekce: ABD-only is icin USPS v3 hem ucretsiz hem CASS-resmi; POD'da yanlis adres dogrudan yeniden-basim zarari. zippopotam.us GeoNames tabanli, SLA'siz, uretimde RISKLI — sadece hizli auto-fill'de birak. Google Address Validation'i yalniz uluslararasi genislersen dusun (ABD'de USPS daha dogru ve ucretsiz).

4. **E-posta: Postmark birincil, SES olcek plani.** Gerekce: OTP'de tek kritik faktor deliverability; Postmark sektor lideri ve $15/ay=10K bu olcekte uzun sure yeter. Vendor sadeligi de onemli: Postmark + Cloudflare + Hetzner = 3 developer-dostu saglayici; SES dorduncu vendor (AWS) ekler, o yuku ancak hacim gercekten buyuyunce tasi. Butce sifirsa **Resend free (3K/ay)** ile MVP baslat, prod'da Postmark'a gec.

5. **AI QA: Anthropic Claude (Haiku 4.5), tek saglayici.** Gerekce: Proje Anthropic-merkezli; iki vision saglayiciyi senkron tutmak prompt bakim yuku. Kucuk olcekte Claude + deterministik sharp kontrolu yeterli. AI **karar degil flag** uretsin (B2B'de yanlis red pahali). DPI'yi koda birak (Claude olcemez).

6. **Upscale: Replicate Real-ESRGAN (Conservative).** Gerekce: PAYG GPU-sn modeli dusuk hacimde ucuz; Conservative baski sadakati korur. Creative/Magnific "detay uydurur" → B2B baskida musteri orijinalden sapma gorur, riskli. Hacim ~1000 kullaniciya yaklasinca Hetzner GPU self-host break-even'ini hesapla.

7. **Omurga: sharp + R2 + Postgres, Google'i kalici backend YAPMA.** Gerekce: DPI/panel/TIFF deterministik kod isi (sharp); R2 egress $0 ile isleme pipeline'i serbest. Google Sheets service-account tek-hesap kotasi 1.000 kullanicida darbogaz olur → Sheets sadece operasyon gorunumu (batchUpdate), Drive sadece gecici kopru; gercek veri Postgres + R2'de tek dogruluk kaynagi.

8. **Mimari notlar (NestJS):** Tum OAuth token'larini (Etsy, QuickBooks, USPS) Postgres'te **sifreli** sakla; refresh rotasyonunu **Redis lock** ile koru (Etsy ve QuickBooks ikisi de rotasyonlu — bir kez kacirirsan kullanici yeniden yetki vermek zorunda). Etsy webhook'u olmadigindan siparis senkronu **BullMQ + Redis delta-polling**; rate limit'i kullanici sayisina gore dagit. Para birimi tek (USD) → kur derdi yok, sadelestir. **Mail DNS kayitlarini Cloudflare'de proxy KAPALI ekle** (en sik hata).

---

> **Dogrulama notu:** Etsy QPS/QPD kesin tabanlari, 2025 QuickBooks App Partner Program detaylari, OpenAI vision token rakami ve Topaz API per-image fiyati kaynak teyitli olmakla birlikte uygulamaya/zamana gore degisebilir — varsayim olarak isaretlenmistir. Etsy tek-realm QuickBooks varsayimini ve QuickBooks Payments tek-merchant mimarisini is modeline gore netlestir.