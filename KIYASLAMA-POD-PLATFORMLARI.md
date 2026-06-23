# Ortak Doku vs Printful / Printify / Gooten — Kıyaslama & Gap Analizi

> Tarih: 2026-06-23 · Kapsam: Printful / Printify / Gooten araştırma bulguları + Ortak Doku (printy) backend envanteri sentezi
> Konum: `/Users/emre/Desktop/printy` · Stack: NestJS 10 + Prisma/Postgres + Cloudflare R2 + Redis/BullMQ

---

## 1) Yönetici Özeti

**Kısa cevap: Hayır, Ortak Doku bu üçüyle aynı kategoride değil — ve olmaya da çalışmamalı.**

Printful, Printify ve Gooten üçü de **genel amaçlı POD fulfillment platformları**: yüzlerce/binlerce SKU içeren bir katalog, dünya genelinde dağıtık baskı ağı (kendi tesisi veya 3. parti) ve "herhangi bir satıcı, herhangi bir ürüne tasarım bas" vaadi. Gelirleri ya abonelik ya da ürün marjından gelir; hedef kitleleri milyonlarca küçük dropshipping satıcısıdır.

Ortak Doku ise **tek üretici operasyonu için niş B2B özel sipariş + üretim yönetim sistemidir**. Bayiler Etsy üzerinden ABD'ye yalnızca üç şey satıyor: **m² bazlı büyük format duvar kağıdı (TIFF), wall decal ve CNC oyma ahşap**. Bu, bir pazaryeri değil; bilinen bir üreticinin sipariş hattını, fiyatlandırmasını, finansını ve üretim akışını dijitalleştiren bir iç/B2B platformdur.

**Net sonuç:**

| Boyut | Büyük 3 (Printful/Printify/Gooten) | Ortak Doku |
|---|---|---|
| Doğa | Genel POD pazaryeri/ağı | Tek üretici niş B2B sipariş+üretim sistemi |
| Katalog | 508 – 1.300+ ürün | 3 kategori (Wallpaper / Decal / Wood) |
| Üretim | Çok-tesis / çok-üretici ağ | Tek tesis, kendi operasyonu |
| Çekirdek niş ürün | **YOK** (m² wallpaper + CNC wood yok) | **Tam buası** |
| Müşteri | Milyonlarca dropshipper | Sınırlı, yönetilen bayi ağı |

**Önemli içgörü:** Ortak Doku'nun çekirdek nişi (m² büyük format TIFF duvar kağıdı + CNC ahşap oyma) **her üç rakipte de gerçek anlamda yok**. Üçü de sabit-ebatlı poster/kanvas/decal SKU mantığıyla çalışıyor. Yani bunlar **doğrudan rakip değil** — fakat sipariş akışı, API tasarımı, white-label, webhook, proofing ve fiyat-şeffaflığı konularında **öğrenilecek çok şey var**. Bu doküman "onlara benzeme" değil, "onların olgun çözdüğü problemleri niş bağlama uyarlama" perspektifiyle yazılmıştır.

---

## 2) Özellik Kıyas Tablosu

| Boyut | Printful | Printify | Gooten | **Ortak Doku** |
|---|---|---|---|---|
| **İş modeli** | Dikey entegre, kendi 7 üretim merkezi; beyaz etiketli üretici | Aggregator: 140+ 3. parti sağlayıcı tek katman altında | Networked: 30+ ortak / 70+ üretim noktası, OrderMesh orkestrasyon | **Tek üretici, niş B2B özel sipariş+üretim sistemi** |
| **Ürün** | ~508 ürün; giyim ağırlıklı + poster/kanvas/giclée/metal duvar sanatı | 1.300+ blueprint; giyim + canvas/poster/decal | 500+ ürün; apparel + kanvas-odaklı wall art (100+ boyut) | **3 kategori: m² Wallpaper (TIFF) + Wall Decal + CNC Wood** |
| **Entegrasyon** | 22+ platform (Etsy, Shopify, Woo, Amazon, TikTok…) + Sync API | 13+ platform + Pop-up Store + REST API | Shopify Plus Certified, Etsy, Woo, BigCommerce, TikTok + REST | **Etsy (yalnız apiKey şifreli saklama; OAuth/sipariş çekme YOK)** |
| **Mockup / tasarım** | Design Maker + AI sahne mockup (Premium) + Mockup Generator API | 5 araç: Mockup Gen, Library, Product Creator, AI Image (OpenAI), Pattern | Listeleme mockup'ı; standalone editör zayıf; proofing YOK | **YOK** — mockup kullanıcı yükler (`AssetRole.MOCKUP`); AR/try-on feature-flag kapalı |
| **API** | REST v1 + v2 Open Beta; imzalı/HTTPS webhook, taslak sipariş+maliyet, 120/dk | REST + Webhooks + OAuth2; 600/dk global, net rate-limit | REST; RecipeID+PartnerBillingKey; order/price-estimate/address-validate + webhook | **İç REST (~80 endpoint, 33 modül); JWT+RBAC; dışa açık partner API/dış webhook YOK** |
| **Fulfillment** | 7 in-house merkez + partnerler; coğrafi yakınlık routing; aylık 1M+ | 140+ sağlayıcı; Geo/Order Routing | 30+ ortak/70+ nokta; OrderMesh smart routing; <3 gün SLA, %99 doğruluk | **Tek tesis; Kanban board + QR/barkod istasyon scan ile iç üretim akışı** |
| **Fiyat** | Free $0 + Growth $24.99/ay; ürün başı maliyet + hizmet ücretleri | Free $0 / Premium $39 (yıllık $24.99) / Enterprise; ürün marjı | Abonelik YOK; pay-per-order, şeffaf base-price (~%10-20 düşük) | **m² fiyat motoru (alan×birim×çarpan), FLAT (Decal/Wood); rol çarpanı USER=2x/TEAM=1x; %40 indirim; kredi/bakiye + $30 üyelik** |
| **White-label** | Tam: markasız slip + iç/dış etiket + custom mailer + pack-in | Sınırlı/opt-in; varsayılan markasız değil; Premium'da Connect | Custom slip + markalı tracking + neck label (+$2); apparel-odaklı | **Org branding/tema + tenant subdomain; PDF fatura/etiket bayi bilgisiyle; markalı packing/tracking sayfası HENÜZ üründeğil** |
| **Sipariş yönetimi** | Draft order + maliyet tahmini + iptal/güncelle/fulfillment onay | Sipariş onay gecikme penceresi (1sa/24sa/günlük); auto-import | order submit/get, artwork-update endpoint, status webhook | **Atomik bakiye düşümü ($executeRaw), durum makinesi (RECEIVED→…→SHIPPED), atomik iade, arşiv, rol-kapsamlı listeleme** |
| **Müşteri hizmet** | Standart destek + numune (Growth'ta ücretsiz digitization) | 7/24 (Premium), Sellers Club mentor, Connect | White-glove (enterprise) | **Ticket sistemi (internal not, durum makinesi, atama) + global arama + bildirim merkezi + OneSignal push + BullMQ toplu mail** |

---

## 3) Ortak Doku'nun GÜÇLÜ Yanları (bu nişte rakiplerden iyi/farklı)

1. **Çekirdek niş = rakiplerin boşluğu.** m² bazlı büyük format TIFF duvar kağıdı ve CNC oyma ahşap her üç rakipte de yok. Bu kasıtlı, az-rekabetli bir konumlandırma. Rakipler sabit-SKU poster/kanvas ile sınırlı; Ortak Doku gerçek alan-bazlı üretim yapıyor.

2. **Niş için doğru fiyat motoru.** `pricing.service.ts` alan-bazlı hesap yapıyor (inç²→ft²→m², `sqm × basePricePerM2 × multiplier`), Decal/Wood için FLAT, Decimal/round(2) ile float güvenliği. Server-side yeniden hesaplama (`/orders` create FE total'ına güvenmiyor). Rakiplerin sabit-SKU fiyatı bu niş için yetersiz kalır — burası Ortak Doku'nun teknik avantajı.

3. **B2B finansal omurga (rakiplerde yok).** Kredi/bakiye ledger, **yarış-koşulsuz atomik bakiye düşümü** (`$executeRaw UPDATE ... WHERE balance >= total`), atomik iade, $30 ekip üyeliği, rol çarpanı (USER=2x / TEAM=1x), %250 yüklemede %40 indirim. Rakipler "pay-per-order" basit; Ortak Doku gerçek bir bayi cari/kredi sistemi işletiyor.

4. **Kendi üretim akışı kontrolü.** Kanban board (kolon-bazlı, geçiş validasyonlu kart taşıma + reorder) + QR/barkod istasyon scan (`POST /scan`, idempotent, istasyona göre durum geçişi). Rakipler bunu "kara kutu" ağa devrediyor; Ortak Doku üretimin her aşamasını görüyor ve kontrol ediyor.

5. **Kendi büyük-dosya altyapısı (R2).** Presigned tek-PUT + multipart (600MB'a kadar), her endpoint'te sahiplik kontrolü, sunucu-üretimli namespace, kısa-TTL indirme. Büyük TIFF'ler için bu kritik — rakiplerin sabit-ebat baskısında bu sorun yok, Ortak Doku'da çözülmüş.

6. **Olgun güvenlik/uyumluluk altyapısı.** 2FA (TOTP + recovery kodları), AES-256-GCM şifreleme (Etsy apiKey, billing PII, 2FA secret), RBAC+izin matrisi, audit log, throttler, GDPR/KVKK export+anonimleştirme. Niş B2B için bu olgunluk rakiplerin "self-servis dropshipper" deneyiminin ötesinde.

7. **Tek üretici = tutarlı kalite vaadi.** Çoklu-üretici ağların (özellikle Printify/Gooten) dezavantajı kalite/tracking tutarsızlığı. Ortak Doku tek tesisle "tutarlı kalite + güvenilir takip"i bir satış argümanına çevirebilir.

---

## 4) EKSİKLER / Alınması Gereken Fikirler (önem sırasına göre)

### 🔴 YÜKSEK ÖNCELİK

| # | Fikir | Kaynak | Ortak Doku'ya uyarlama |
|---|---|---|---|
| H1 | **Duvar/oda mockup & dijital proof önizleme** | Printful AI mockup, Printify AI Mockups | Niş için en yüksek getirili eksik. m² duvar kağıdı/decal için **duvarda ölçekli oda önizlemesi** + baskı öncesi **dijital proof onayı** (bayi/müşteri approve). Gooten'da proofing YOK — bu doğrudan farklılaştırıcı. Etsy listing kalitesini artırır, iade oranını düşürür. (`virtualTryOn` flag + `AI-SERVIS.md`/`MOBIL-AR-3D` ile bağla.) |
| H2 | **Üretime düşmeden onay/tampon penceresi** | Printify sipariş onay gecikmesi (1sa/24sa/günlük) | Pahalı, iadesi zor m² wallpaper/CNC için durum makinesine "RECEIVED → (manuel onay / X saat tampon) → IN_PRODUCTION" adımı ekle. Hatalı dosya/ölçü kaybını engeller. Mevcut `TRANSITIONS` makinesine düşük maliyetle eklenir. |
| H3 | **Dosya teknik validasyonu (DPI/TIFF/print-area)** | Printful Catalog "printable areas + printfiles" | Yüklenen TIFF yeterli mi (çözünürlük/boyut/renk profili)? Şu an sadece uzantı whitelist var; magic-byte/MIME doğrulaması bile yok. m² için DPI×boyut validasyonu üretim hatasını baskı öncesi yakalar. Katalog şemasına "dosya gereksinimi" alanı ekle. |
| H4 | **Etsy sipariş otomasyonu + tracking geri-yazma** | Printify/Gooten Etsy entegrasyonu | Şu an sadece apiKey şifreli saklanıyor; gerçek OAuth/sipariş çekme yok. Etsy'den **otomatik sipariş içe aktarma** + üretim ilerledikçe **kargo takip no'sunu Etsy'ye otomatik geri yazma**. Bayinin manuel girişini kaldırır — en kritik kanal. |

### 🟡 ORTA ÖNCELİK

| # | Fikir | Kaynak | Ortak Doku'ya uyarlama |
|---|---|---|---|
| O1 | **Checkout öncesi quote API: m² fiyat + kargo + adres doğrulama** | Gooten price-estimate + address-validation + shipping-quote | `/pricing/quote` zaten var. Üzerine **adres doğrulama** + **kargo ücreti tahmini** (şu an hiç yok) ekle. Hatalı büyük-format siparişi maliyetli — sipariş girilmeden doğrulama. |
| O2 | **Dışa açık partner API + imzalı webhook** | Printful v2 (imzalı/HTTPS webhook), Printify (Catalog/Orders/Uploads/Webhooks), Gooten status webhook | İç REST var ama dışa açık partner API ve **giden webhook** yok. NestJS event + Redis ile sipariş-durum/üretim-aşaması **imzalı (request signing) webhook** yayını kur. Bayi başına uzun ömürlü token. |
| O3 | **White-label paketleme + markalı tracking sayfası ürünleştirme** | Printful tam white-label, Gooten markalı tracking + neck label | Org branding/tema + PDF fatura/etiket altyapısı var. Üzerine **bayi-özelleştirilebilir packing slip** (logo, iade adresi, mesaj) + **markalı tracking sayfası** + rulo/tüp etiketi & kurulum talimatı. Tek üretici olduğu için tutarlı yapabilir — satış argümanı. |
| O4 | **Artwork-update (revizyon) endpoint deseni** | Gooten ayrı artwork-update endpoint | R2'deki büyük TIFF'e sipariş kalemini URL ile bağla; üretim öncesi **dosya revizyonu için ayrı güncelleme akışı**. Büyük dosyalarda kritik. Document/Ticket modülleriyle bağla. |
| O5 | **Kapasite-bazlı iç üretim routing** | Printful coğrafi routing, Printify Geo/Order Routing, Gooten OrderMesh | Coğrafi routing tek üreticide gereksiz; fikri **iç üretim hattı routing**'e çevir: TIFF baskı kuyruğu / CNC kuyruğu / kesim istasyonuna otomatik job atama. Mevcut Bull/Redis + Kanban + QR ile örtüşüyor. |

### 🟢 DÜŞÜK ÖNCELİK

| # | Fikir | Kaynak | Ortak Doku'ya uyarlama |
|---|---|---|---|
| D1 | **Katmanlı bayi/üyelik + hacim indirimi** | Printful Growth (eşik sonrası bedava), Printify Free→Premium | Mevcut $30 üyelik + %40 indirim mantığını **kademeli m² indirimi / aylık taahhüt** + üst planda **öncelikli üretim kuyruğu** olarak genişlet. `memberships` + `settings.discountRate` ile. |
| D2 | **Numune/sample sipariş akışı** | Printful indirimli numune + ücretsiz digitization | Duvar kağıdı/ahşapta bayiye **düşük maliyetli fiziksel numune** (renk/doku doğrulama). İade ve şikayet maliyetini düşürür. |
| D3 | **Etsy "production partner" ifşa otomasyonu** | Printful/Gooten Etsy 3rd-party manufacturing uyumu | Etsy üretici ifşa zorunluluğunu ürünleştir: listing'de production-partner alanını otomatik yöneterek bayilerin **Etsy uyumluluğunu/askıya alınma riskini** sen yönet. |
| D4 | **Şeffaf malzeme/finish fiyat tablosu** | Printify provider fiyat karşılaştırması | Tek üretici olsa da bayiye **malzeme/finish bazında (mat/parlak/laminasyon, ahşap türü) şeffaf m² fiyat tablosu** sun — aynı güven hissi. |
| D5 | **Mockup/render'ı ayrı düşük rate-limit + kuyruk** | Printful mockup düşük limit | H1 gelince: render/mockup gibi pahalı işleri ayrı (düşük) limitte, Bull kuyruğunda asenkron işle. Mevcut Bull Board/retry altyapısı birebir uygun. |

---

## 5) Bilinçli FARKLAR — Ortak Doku'nun Niş Gereği YAPMAYACAĞI Şeyler

Bunlar eksik değil, **kapsam netliğidir**. Ortak Doku bu yollara girmemeli:

| Yapılmayacak | Neden | Rakipte karşılığı |
|---|---|---|
| **Binlerce ürünlü genel katalog** | Tek üretici, 3 sabit kategori. Çok-satıcı/çok-SKU katalog iş modeline aykırı. | Printify 1.300+, Printful 508, Gooten 500+ |
| **Global çok-tesis baskı ağı** | Tek tesis operasyonu. Coğrafi routing gereksiz. | Printful 7 merkez, Printify 140+, Gooten 70+ nokta |
| **Çok-üretici aggregator olma** | Tutarlı kalite vaadi tek üreticiden gelir; ağ olmak avantajı yok eder. | Printify/Gooten ana modeli |
| **Genel dropshipper kitlesine açılma** | Hedef = yönetilen bayi ağı, milyonlarca self-servis satıcı değil. | Üçünün de hedef kitlesi |
| **Apparel/giyim, kupa, telefon kılıfı vb.** | Niş duvar/ahşap dekoru. Yatay genişleme odağı dağıtır. | Üçünde de giyim en büyük segment |
| **Online tasarım editörü (full design suite)** | Tasarım dışarıda hazırlanıp yüklenir. Editör niş için gereksiz ağırlık. | Printful Design Maker, Printify Product Creator |
| **22+ platforma yayılma** | Etsy-merkezli B2B. Tek kanalda derinlik > yüzeysel genişlik. | Printful 22+, Printify 13+ |

> **Kural:** "Genel POD'a benzemeye çalışma." Farklılaşma m² fiyat motoru + büyük TIFF/R2 akışı + CNC + tek-üretici kalite tutarlılığında. Rakiplerden **mekanizma** al (draft order, webhook, proofing, white-label), **kapsam** alma.

---

## 6) Önceliklendirilmiş Yol Haritası

Mevcut backend zaten S0-güvenlik + Faz-1 kalemlerinin neredeyse tamamını kapatmış (2FA, şifreleme, atomik finans, RBAC, audit, GDPR, kuyruk, kanban, QR, PDF). Aşağıdaki yol haritası **rakip-ilhamı katma değer** üzerine kuruludur.

### Faz 0 — Mevcut açık eksikleri kapat (rakip-bağımsız, temel borç)
- Şifre sıfırlama akışı (`forgot/reset` — `OtpPurpose.PASSWORD_RESET` enum hazır, endpoint yok)
- Dosya **magic-byte/MIME doğrulaması** + (opsiyonel) AV taraması → H3'ün ön koşulu
- Abonelik-yenileme cron + %40-reset mantığı (`renewalDate` yazılıyor ama worker yok)
- Gerçek ödeme gateway (Stripe/QuickBooks stub → canlı tokenization/webhook)

### Faz 1 — Sipariş güvenilirliği & Etsy derinliği (YÜKSEK)
- **H2:** Üretime düşmeden onay/tampon penceresi (durum makinesine adım) — düşük efor, yüksek koruma
- **H3:** TIFF/DPI/print-area teknik validasyonu (katalog şeması + upload validation)
- **H4:** Etsy OAuth + otomatik sipariş içe aktarma + tracking geri-yazma
- **O1:** Checkout öncesi quote genişletme (adres doğrulama + kargo tahmini)

### Faz 2 — Görsel değer & proofing (YÜKSEK, AI-servis ile)
- **H1 + D5:** Duvar/oda mockup önizleme + dijital proof onayı (Bull kuyruğunda asenkron render, düşük rate-limit). `virtualTryOn` feature-flag'i aç, `AI-SERVIS.md` / `MOBIL-AR-3D-VIRTUAL.md` planına bağla. **AI virtual try-on = rakiplerin mockup generator'ına denk düşen kalem** — niş bağlamda (duvarda gerçek ölçek) bir adım önde.
- **O4:** Artwork-update/revizyon endpoint'i (proof reddinde dosya yenileme)

### Faz 3 — Bayi otomasyonu & marka (ORTA)
- **O2:** Dışa açık partner API + imzalı/HTTPS giden webhook (bayi başına token)
- **O3:** White-label packing slip + markalı tracking sayfası ürünleştirme
- **O5:** Kapasite-bazlı iç üretim routing (TIFF/CNC/kesim kuyruğu)

### Faz 4 — Büyüme & sadakat (DÜŞÜK)
- **D1:** Katmanlı bayi/üyelik + hacim indirimi + öncelikli kuyruk
- **D2:** Numune/sample sipariş akışı
- **D3:** Etsy production-partner ifşa otomasyonu
- **D4:** Şeffaf malzeme/finish fiyat tablosu

---

## 7) Sonuç

Ortak Doku, Printful/Printify/Gooten ile **aynı kategoride değildir ve olmamalıdır**. Üçü genel POD pazaryeri/ağı; Ortak Doku tek üretici için niş B2B özel üretim sistemi. Doğrudan rakip değiller — ama olgun çözümleri var.

**En kritik gerçek:** Ortak Doku'nun çekirdek nişi (m² büyük format TIFF duvar kağıdı + CNC ahşap) **her üç rakipte de yok**. Bu bir tesadüf değil, savunulabilir bir konumlandırma. Backend bunu hak eden teknik olgunluğa zaten ulaşmış: alan-bazlı fiyat motoru, atomik finansal omurga, kendi R2 büyük-dosya altyapısı, üretim kanban/QR, sağlam güvenlik.

**Rakiplerden alınacak en değerli 4 fikir** (hepsi nişe uyarlanmış halde):
1. **Duvar mockup + dijital proof onayı** (H1) — Gooten'da proofing yok; niş için doğrudan farklılaştırıcı, iade düşürücü.
2. **Üretim öncesi onay/tampon penceresi** (H2) — pahalı/iadesiz üretimde hata kaybını önler, düşük efor.
3. **TIFF teknik validasyonu** (H3) — büyük format baskı hatasını baskı öncesi yakalar.
4. **Etsy sipariş otomasyonu + tracking geri-yazma** (H4) — tek kanalda bayi yükünü kaldırır.

**Strateji özeti:** Rakiplerden **mekanizma** kopyala (draft/onay akışı, imzalı webhook, proofing, white-label, quote API), **kapsam** kopyalama (binlerce ürün, global ağ, genel katalog). Niş derinliğini koru; "genel POD'a benzeme" disiplinini sürdür. Farklılaşma m² + TIFF + CNC + tek-üretici tutarlılığındadır — bu alanda rakipler boş.

---

*Kaynaklar: Printful/Printify/Gooten araştırma bulguları (JSON) + Ortak Doku backend envanteri. Fiyat motoru mantığı `/Users/emre/Desktop/printy/backend/src/pricing/pricing.service.ts` üzerinden doğrulandı (m² hesabı, FLAT, rol çarpanı USER=2x/TEAM=1x, %40 indirim).*
