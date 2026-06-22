# Mobil Virtual Try-On / AR / 3D — Duvar Uygulaması

> **Proje:** Ortak Doku (B2B Print-on-Demand). Backend: NestJS + Postgres + Cloudflare R2 + Redis + BullMQ. AI: ayrı Python/FastAPI mikroservis + Google Gemini (bkz. `AI-SERVIS.md`). Mobil: React Native (planlı). Para birimi: USD, ABD/uluslararası pazar.
> **Hedef:** Kullanıcı telefon kamerasıyla kendi duvarını görür → seçtiği duvar kağıdı / deseni duvara **gerçek zamanlı** giydirir (virtual try-on / AR), **ölçü** alır (→ m² fiyat motoru), **3D oda önizlemesi** görür.
> **Tarih notu:** Bu doküman Haziran 2026 itibarıyla geçerli sürüm/yetenek bilgileriyle yazıldı; model adları ve sürümler hızlı değişiyor, üretim anında teyit edilmeli (özellikle Gemini görsel modeli ve expo-gl/r3f uyumluluğu).

---

## 0. Hızlı Yönetici Özeti (TL;DR)

| Yetenek | Çözüm (2026 önerisi) | Nerede çalışır | Karmaşıklık | Faz |
|---|---|---|---|---|
| **AI foto try-on** (foto yükle → duvara giydir) | Gemini 3 Pro Image ("Nano Banana Pro") + FastAPI + BullMQ | Cloud (AI servis) | Düşük-Orta | **MVP / Faz 1** |
| **AI ölçü tahmini** (foto + referans nesne → inç/cm) | Gemini vision + referans-nesne kalibrasyonu | Cloud (AI servis) | Orta | **Faz 1** |
| **AR canlı önizleme** (duvara real-time desen) | ViroReact (ARKit/ARCore) + plane detection + segmentasyon | On-device | Yüksek | **Faz 2** |
| **AR ölçü** (LiDAR / plane) | iOS: ARKit RoomPlan/plane (native bridge); Android: ARCore Depth | On-device | Yüksek | **Faz 2** |
| **3D oda önizleme** | react-native-filament (öncelik) veya expo-gl + R3F | On-device | Orta-Yüksek | **Faz 3** |

**Stratejik öneri:** **MVP'yi tamamen cloud AI foto-try-on ile başlat.** AR'siz, sadece "foto yükle → birkaç saniyede duvarında gör" deneyimi en yüksek değeri/en düşük riskli şekilde verir; mevcut FastAPI + Gemini + R2 + BullMQ yığınına oturur, ekstra mobil-native risk yok. Canlı AR'yi (Faz 2) yatırım kararını MVP metrikleri belirlesin.

---

## 1. Yetenekler

### (a) AR Canlı Önizleme — duvara desen giydirme (real-time)
Kullanıcı kamerayı duvara tutar, seçtiği desen **canlı görüntü üstünde** duvara perspektif/ışık uyumlu yapışır.

Gereken alt yetenekler:
- **Düzlem tespiti (plane detection):** dikey düzlem (duvar) algılama — ARKit/ARCore yapar.
- **Duvar segmentasyonu / occlusion:** duvar ile önündeki nesneler (mobilya, insan, raf) ayrıştırılır ki desen mobilyanın "üstünden" akmasın. En zor kısım budur.
- **Perspektif/homografi:** desen, duvarın yüzey normaline göre doğru açıyla yansıtılır (tekrarlı/seamless tile).
- **Işık/gölge uyumu:** ortam ışığına göre desenin parlaklığı/tonu ayarlanır (ARKit/ARCore ambient light estimation).
- **Stabilizasyon:** kamera oynayınca desen "kaymaz" (anchor/tracking).

> **Gerçeklik notu:** Telefonda piksel-mükemmel duvar segmentasyonu + occlusion hâlâ zor. iOS LiDAR'lı cihazlarda (Pro modeller) belirgin avantaj var; LiDAR'sız Android'de duvar maskesi ML segmentasyonuyla yaklaşık yapılır.

### (b) AI Görsel Try-On — foto yükle → duvara uygula (cloud)
AR'siz, en pratik yol. Kullanıcı **tek bir duvar fotoğrafı** çeker/yükler → AI servis Gemini görsel modeline gönderir → desen duvara perspektif/ışık uyumlu **giydirilmiş görsel** döner → R2'ye yazılır → kullanıcıya gösterilir.
- Avantaj: cihaz bağımsız (her telefon), en yüksek görsel kalite, mevcut yığına oturur.
- Dezavantaj: canlı değil (statik foto), saniyeler sürer (kuyruk), görsel başına maliyet.

### (c) AR Ölçü — duvar genişlik × yükseklik → m² fiyat motoru
- **iOS (LiDAR'lı):** En doğru. ARKit plane + RoomPlan ile birkaç cm hassasiyetinde gerçek ölçü.
- **iOS (LiDAR'sız) / Android:** ARCore Depth API + plane detection ile yaklaşık; ya da iki nokta dokunarak (tap-to-measure) ölçüm.
- **AI fallback:** LiDAR/AR yoksa → foto + referans nesne (standart priz, kapı, kredi kartı, A4 kağıt) ile **AI ölçü tahmini** (yaklaşık).
- Çıktı: `widthInches`, `heightInches` → backend m² hesaplar → fiyat motoruna besler.

> **Yasal/üretim notu:** AR/AI ölçü **tahmin/öneri**dir; kesin üretim ölçüsü sorumluluğu kullanıcıda. Sipariş öncesi net onay ekranı şart (`AI-SERVIS.md §3.2` ile tutarlı).

### (d) 3D Oda Önizleme
Kullanıcı ölçü + desen verisinden basit 3D oda (4 duvar + zemin) içinde deseni kaplı görür; döndürebilir, farklı desen/ölçü dener. AR olmadan, sentetik 3D sahne. Pazarlama/karşılaştırma değeri yüksek, teknik risk orta.

---

## 2. Teknoloji Karşılaştırması (2026, React Native)

### 2.1 Kamera + Frame İşleme: `react-native-vision-camera`
**Sürüm (Haz 2026):** v5.x (en son ~v5.0.11). V4 artık aktif bakımda değil; **V5 kullanılmalı**.

- **Frame processors (worklets):** her kamera karesini JS worklet'inde senkron işleyebilir; native frame processor plugin'leri ile ML Kit / segmentasyon modeli çalıştırılabilir.
- **V5 yenilikleri:** `useFrameOutput` + `runOnFrame` worklet; sonucu `scheduleOnRN` (react-native-worklets) ile UI thread'e geri postalama. **React Native ExecuTorch** entegrasyonu V5'te segmentasyon maskesi / bbox / OCR overlay'i kamera önizlemesi üstüne real-time çizebiliyor.
- **Artı:** En performanslı RN kamera; ML pipeline'ı için endüstri standardı. **Eksi:** AR (anchor/world tracking) sağlamaz — sadece kamera + frame. AR için ayrıca Viro/ARKit gerekir.

> **Rol:** Try-on'un "canlı segmentasyon overlay" tarzı (AR motoru olmadan, 2D maske ile desen bindirme) hafif versiyonu için ideal. Tam AR (perspektif/anchor) için tek başına yetmez.

### 2.2 AR Motoru: ViroReact (ReactVision)
**Durum (Haz 2026):** **Aktif bakımda.** Morrow Digital Ocak 2025'te projeyi devraldı, 2025 sonunda **ReactVision, Inc.** olarak bağımsızlaştı. `@reactvision/react-viro`, MIT lisans (v2.17.0'dan beri açık kaynak). **RN New Architecture (Fabric)** desteği custom interop katmanıyla eklendi. Expo destekli.

- **Ne yapar:** RN kodunu native draw call'a çevirir → iOS'ta **ARKit**, Android'de **ARCore** tam hızda. Plane detection, anchor, ışık tahmini, 3D nesne/materyal, video/görsel materyal.
- **Artı:** RN ekosisteminde en olgun, tek API ile iki platform; duvara desen giydirme (dikey plane + materyal) için doğrudan uygun; aktif şirket arkasında.
- **Eksi:** Native build (Expo dev client / prebuild) gerekir; öğrenme eğrisi; ince occlusion/segmentasyon hâlâ ek iş (ML maskesi entegrasyonu); RoomPlan gibi en yeni ARKit özellikleri için yine native bridge gerekebilir.
- **ÖNERİ:** **Canlı AR'nin (Faz 2) ana motoru ViroReact olmalı.** Sıfırdan ARKit/ARCore bridge yazmaktan çok daha hızlı.

### 2.3 3D Render: react-native-filament vs expo-gl + three.js/R3F
**`react-native-filament` (margelo):**
- Google Filament tabanlı PBR motoru; iOS'ta **Metal**, Android'de Vulkan/OpenGL; render ayrı thread'de; milyonlarca kullanıcılı prod uygulamalarda kanıtlı, stabil.
- **Artı:** Modern, performanslı, gerçekçi PBR (ışık/materyal — duvar kağıdı dokusu için önemli). **Eksi:** three.js kadar geniş topluluk/örnek yok; glTF model hattı kurmak gerekir.

**`expo-gl` + `three.js` + `@react-three/fiber` (R3F):**
- **DİKKAT — 2026 uyumluluk sorunu:** Expo SDK 53, `expo-gl@15` kullanırken R3F `expo-gl@11`'e bağımlı → **sürüm uyuşmazlığı gerçek cihazda kırılmalara yol açıyor** (web build çalışıyor, gerçek cihaz sorunlu). Ayrıca R3F v9 = react@19, v8 = react@18 eşleşmesine dikkat. expo-gl, OpenGL ES (iOS'ta deprecated) üstünde.
- **Artı:** three.js'in dev ekosistemi/örnekleri; deklaratif R3F. **Eksi:** yukarıdaki uyumluluk riski; iOS'ta deprecated GL yolu.

- **ÖNERİ (3D oda önizleme, Faz 3):** **react-native-filament önceliklendirilmeli** (stabilite + PBR). R3F yalnızca ekip three.js'e çok hâkimse ve uyumluluk matrisi o anki SDK'da çözülmüşse seçilsin — üretim öncesi gerçek cihazda doğrulama şart.

### 2.4 Düzlem/Ölçü: ARKit RoomPlan + ARCore
**Apple RoomPlan (iOS):**
- ARKit + **LiDAR** ile odanın parametrik 3D planı + boyutlar; **birkaç cm hassasiyet**. iOS 17+'da custom `ARSession` (`ARWorldTrackingConfiguration`) ile RoomPlan + ARKit aynı akışta birleştirilebilir.
- **RN için doğrudan paket yok:** **ince bir native modül (Swift) ile ARKit/RoomPlan sarmalanmalı.** Hazır bir RN-RoomPlan köprüsü standart değil → custom bridge planlanmalı.
- **Artı:** Pazardaki en doğru duvar ölçüsü (LiDAR'lı iPhone Pro/iPad Pro). **Eksi:** sadece LiDAR'lı cihaz; native iş; iOS-only.

**ARCore (Android):**
- Plane detection + **Depth API** ile ölçüm (LiDAR yok, ToF/derinlik tahmini). RoomPlan kadar hassas değil; tap-to-measure pratik.

- **ÖNERİ:** AR ölçü = iOS'ta RoomPlan/ARKit native bridge (LiDAR varsa), Android'de ARCore plane+depth; **her ikisinde de yoksa AI referans-nesne ölçüsüne (cloud) düş**. ViroReact zaten plane verisi sağladığı için temel ölçüm Viro üstünden de prototiplenebilir; en yüksek doğruluk için native RoomPlan.

### 2.5 Duvar Segmentasyonu: ML Kit / MobileSAM / ExecuTorch
- **ML Kit Selfie Segmentation:** kişiyi ayırır (occlusion'da "duvar önündeki insan" için faydalı), ~4.5MB, aktif (son güncelleme Mar 2026). **Duvar segmentasyonu için doğrudan değil** (selfie odaklı).
- **MobileSAM / TinySAM / PicoSAM2:** SAM'in mobil/edge varyantları; hafif backbone ile on-device segmentasyon, AR'de gerçek zamanlı nesne maskesi. Duvar gibi büyük düzlem maskesi için promptlu segmentasyon uygun.
- **ExecuTorch (PyTorch on-device):** RN ExecuTorch + VisionCamera V5 ile segmentasyon modelini frame processor'da koşturup maske çizmek mümkün — duvar maskesi için en esnek modern yol.
- **Cloud segmentasyon:** En yüksek kalite gerekiyorsa (foto try-on) segmentasyonu/uygulamayı tamamen Gemini görsel modeline bırak (ayrı maske gerekmez).

- **ÖNERİ:** Canlı AR'de duvar maskesi → **ExecuTorch veya MobileSAM sınıfı model VisionCamera V5 frame processor'da**; occlusion'da insan için ML Kit selfie segmentation eklenebilir. Foto try-on'da segmentasyon **cloud'a (Gemini)** bırakılır.

### 2.6 Özet Tablo

| Katman | Önerilen (2026) | Alternatif | Not |
|---|---|---|---|
| Kamera+frame | react-native-vision-camera v5 | — | AR sağlamaz, ML için ideal |
| AR motoru | ViroReact (ReactVision) | Native ARKit/ARCore bridge | Plane+materyal, iki platform |
| 3D render | react-native-filament | expo-gl + three.js/R3F | R3F'te expo-gl sürüm riski |
| Ölçü (iOS) | RoomPlan/ARKit native bridge | Viro plane | LiDAR ile en hassas |
| Ölçü (Android) | ARCore plane + Depth | tap-to-measure | LiDAR yok |
| Segmentasyon (on-device) | ExecuTorch / MobileSAM | ML Kit selfie (occlusion) | Frame processor'da |
| Try-on (cloud) | Gemini 3 Pro Image | — | Segmentasyon dahil |

---

## 3. AI Tarafı: On-device Segmentasyon vs Cloud (Gemini)

### 3.1 Hangi iş nerede?

| İş | Yer | Sebep |
|---|---|---|
| **Canlı AR overlay / real-time duvar maskesi** | **On-device** | Düşük gecikme (her kare), çevrimdışı, maliyet yok. Cloud her kareye gönderilemez. |
| **Yüksek kaliteli statik try-on (foto yükle)** | **Cloud (Gemini)** | Gerçekçi ışık/perspektif/doku harmanlama; tek görsel, kuyruğa uygun. |
| **AI ölçü tahmini (referans nesne ile)** | **Cloud (Gemini vision)** | Tek seferlik, ağır model; doğruluk > gecikme. |
| **AR ölçü (LiDAR/plane)** | **On-device (ARKit/ARCore)** | Donanım sensörü, anlık, AI gerekmez. |
| **3D oda render** | **On-device** | GPU render, etkileşimli. |

**Kural:** *Her-kare / etkileşimli* işler on-device; *tek-seferlik / yüksek-kalite* işler cloud.

### 3.2 Cloud try-on modeli (Haziran 2026 doğrulaması)
- **Model:** **Gemini 3 Pro Image** ("Nano Banana Pro") — Haziran 2026'da GA oldu.
- **Yetenekler:** native görsel düzenleme (joint reasoning-generation), **lokal düzenleme**, ışık/odak ayarı, kamera dönüşümleri, 2K/4K çıktı, esnek en-boy oranı, SynthID watermark, ~2-5 sn üretim. Duvara desen giydirme bu "localized edit + lighting" yeteneklerine birebir oturur (prompt: "bu duvar yüzeyini şu deseni tekrarlayan duvar kağıdıyla, perspektif/ışık/gölge uyumlu kapla; mobilya/eşyaları olduğu gibi koru").
- **Fiyat (Haz 2026, doğrulanmış):** standart ≤1024×1024 ≈ **$0.039/görsel**; en yaygın 1K-2K tier ≈ **$0.134/görsel**; 4K ≈ **$0.24/görsel**. **Batch/Flex** ile 2K ≈ **$0.067/görsel** (async teslim — kuyrukla zaten uyumlu).
- **Maliyet stratejisi:** Önizlemeleri **2K Batch/Flex** ($0.067) ile üret (zaten BullMQ async); 4K'yı yalnızca "yüksek kalite önizleme" premium aksiyonunda kullan. Kullanıcı başına aylık ücretsiz hak + üstü kredi/bakiye (`AI-SERVIS.md §4`).

> **Üretim notu:** Model isimleri/sürümleri değişken — `AI-SERVIS.md §9` açık sorusuyla uyumlu olarak model adı çağrı anında teyit edilmeli. SynthID watermark'a dikkat (B2B önizlemede genelde sorun değil).

### 3.3 `AI-SERVIS.md` (Python/FastAPI + Gemini) ile entegrasyon
Mevcut mimariye **yeni endpoint eklenmez gibi** oturuyor — `AI-SERVIS.md §5`'teki `POST /api/ai/tryon` ve `POST /api/ai/measure` doğrudan bu özelliklerin backbone'u:

- **Mobil → ana backend (`ai` modülü proxy):** JWT + tenant + kota kontrolü → servis-token ile FastAPI'ye.
- **FastAPI (AI servis):** Gemini SDK ile görsel düzenleme **doğrudan** (`AI-SERVIS.md §7`: görsel iş = doğrudan Gemini SDK, LangGraph değil). İş **BullMQ-eşdeğeri kuyruğa** alınır (uzun sürebilir; HTTP bloklanmaz — §3 notu).
- **Çıktı:** önizleme görseli **R2'ye** yazılır (§3.1, §6); kullanıcıya imzalı URL.
- **Ölçü:** Gemini vision → JSON şema (`{widthInches, heightInches, confidence, referenceObject}`) → backend doğrular (§8 guardrail: yapılandırılmış çıktı + doğrulama).
- **Bildirim:** iş bitince mevcut **`notifications` kuyruğu + OneSignal push** (referans `PUSH-ONESIGNAL.md`) ile "önizlemen hazır".

---

## 4. Backend Gereksinimleri (NestJS — ana backend)

### 4.1 Ölçü → m² fiyat entegrasyonu
- Yeni/genişletilmiş endpoint: `POST /api/measurements` veya try-on akışına gömülü.
- Girdi: `{ source: 'ar_lidar' | 'ar_plane' | 'ai_estimate' | 'manual', widthInches, heightInches, confidence?, referenceObject? }`.
- Backend: inç → m² (Wallpaper m² bazlı, inç ölçü kuralıyla tutarlı) → mevcut **fiyat motoruna** besle → fiyat döner.
- **Kaynak işaretleme:** ölçü kaynağı (`ai_estimate` vs `ar_lidar`) kayıtta tutulmalı; AI/AR tahmini ise **onay flag'i** + "tahmindir" uyarısı sipariş kaydında saklanır (yasal iz).

### 4.2 Önizleme görseli saklama (R2)
- Bucket/prefix: `tryon-previews/{tenantId}/{userId}/{uuid}.jpg`.
- **Lifecycle:** önizlemeler geçici → R2 lifecycle ile X gün sonra sil (`AI-SERVIS.md §4`: saklama süresi ayarı).
- Erişim: imzalı URL (kısa ömür). Üretim dosyasıyla **karıştırılmaz** (önizleme ≠ baskı dosyası — §3 notu).
- DB tablosu: `tryon_previews (id, tenant_id, user_id, design_id, wall_image_key, result_image_key, width_in, height_in, measure_source, status, cost_usd, created_at, expires_at)`.

### 4.3 AI servis endpoint'leri (ana backend `ai` modülü → FastAPI proxy)
- `POST /api/ai/tryon` — `{ wallImage(R2 key/upload), designId, options }` → kuyruk job → `{ jobId }`; bitince push + `result_image_key`.
- `POST /api/ai/measure` — `{ wallImage, referenceObject? }` → `{ widthInches, heightInches, confidence }`.
- `GET /api/ai/tryon/:jobId` — durum/sonuç (polling fallback; SSE/push tercih).
- Hepsi: tenant izolasyon, kota/maliyet limiti (`AI-SERVIS.md §4`), audit log (§8).
- **Servis-servis auth:** paylaşılan secret / imzalı token (§5).

### 4.4 Ayarlar (mevcut `AiSettings` genişletmesi)
- `tryonEnabled`, `measureEnabled` (per-tenant override).
- Kullanıcı başına aylık ücretsiz hak; üstü kredi/bakiye.
- Çözünürlük/kalite profili (2K Batch default, 4K premium).
- Maliyet tavanı + aşımda davranış.

---

## 5. Yapılacaklar Listesi (Faz Faz)

### Faz 1 — MVP: AI Foto Try-On + AI Ölçü (cloud) — *düşük-orta karmaşıklık, en yüksek değer*

**Backend (NestJS):**
- [ ] `tryon_previews` tablosu + migration.
- [ ] R2 `tryon-previews/` prefix + lifecycle (auto-expire).
- [ ] `ai` modülünde `POST /api/ai/tryon`, `POST /api/ai/measure`, `GET /api/ai/tryon/:jobId`.
- [ ] Kuyruk job tipi `tryon-generate` (mevcut Redis/BullMQ; uzun iş → bloklamaz).
- [ ] Ölçü → m² → fiyat motoru entegrasyonu (`measure_source` kayıt).
- [ ] `AiSettings`: tryon/measure aç-kapa, kota, maliyet limiti (per-tenant).
- [ ] İş bitince `notifications` kuyruğu → OneSignal push.
- [ ] Audit log + maliyet kaydı (`cost_usd`).

**AI servis (Python/FastAPI):**
- [ ] `/internal/tryon` endpoint + Gemini 3 Pro Image (Nano Banana Pro) çağrısı (doğrudan SDK).
- [ ] Prompt şablonu: "duvarı şu desenle perspektif/ışık/gölge uyumlu kapla, eşyaları koru" + seamless tile.
- [ ] `/internal/measure`: Gemini vision + referans-nesne kalibrasyonu → JSON şema çıktı.
- [ ] R2'ye sonuç yazma + imzalı URL.
- [ ] 2K Batch/Flex maliyet profili default; 4K premium opsiyon.
- [ ] Servis-token doğrulama; tenant/kota guardrail; çıktı JSON doğrulama (§8).

**Mobil (React Native):**
- [ ] Foto çek/galeriden yükle akışı (vision-camera v5 veya image picker).
- [ ] Desen/tasarım seçimi → try-on isteği → "hazırlanıyor" (kuyruk) → sonuç görsel.
- [ ] Referans nesne ile ölçü akışı + onay ekranı ("tahmindir, onayla/düzelt").
- [ ] Sonuç → ölçü → fiyat → sepet/sipariş akışına bağlama.
- [ ] Push ile "önizlemen hazır" derin link.

> **Maliyet/karmaşıklık:** Görsel başı ~$0.067 (2K Batch). Native AR yok → düşük risk. **Mevcut yığına %90 oturur.**

### Faz 2 — AR Canlı Önizleme + AR Ölçü — *yüksek karmaşıklık*

**Mobil:**
- [ ] ViroReact (ReactVision) entegrasyonu; Expo dev client/prebuild (native build).
- [ ] Dikey plane (duvar) tespiti + desen materyali (seamless texture) bindirme.
- [ ] Işık tahmini (ambient) ile desen ton/parlaklık uyumu.
- [ ] Occlusion/segmentasyon: VisionCamera v5 + ExecuTorch/MobileSAM duvar maskesi; insan için ML Kit selfie segmentation.
- [ ] AR ölçü: iOS RoomPlan/ARKit **native bridge** (Swift, LiDAR varsa); Android ARCore plane+Depth; tap-to-measure fallback.
- [ ] Cihaz yetenek tespiti (LiDAR var/yok, ARCore destek) → uygun moda yönlendirme; desteklenmiyorsa Faz 1'e (foto) düş.

**Backend:**
- [ ] AR ölçü kaynağını (`ar_lidar`/`ar_plane`) kabul + güven skoru kaydı.
- [ ] (Opsiyonel) AR ekran görüntüsü R2'ye kaydetme.

> **Maliyet/karmaşıklık:** Yüksek — native build, cihaz fragmentasyonu (LiDAR'lı/sız, eski Android), segmentasyon/occlusion tuning. Cloud maliyeti yok (on-device). **Yatırım kararı MVP metriklerine bağlanmalı.**

### Faz 3 — 3D Oda Önizleme — *orta-yüksek karmaşıklık*

**Mobil:**
- [ ] react-native-filament ile basit oda sahnesi (4 duvar + zemin), PBR materyal.
- [ ] Ölçü verisinden duvar boyutları → deseni kaplama (tiling).
- [ ] Etkileşim: döndür/yakınlaş, desen/ölçü değiştir, anlık fiyat.
- [ ] (Alternatif) expo-gl + R3F — yalnızca o anki SDK'da expo-gl sürüm uyumu doğrulanırsa.

**Backend:**
- [ ] Desen doku asset'lerini (seamless, çözünürlük varyantları) R2'den servis etme.

> **Maliyet/karmaşıklık:** Orta-yüksek; cloud maliyeti yok. glTF/materyal hattı kurulumu ana iş.

---

## 6. Açık Sorular

1. **Gemini görsel modeli adı/sürümü:** "Nano Banana Pro / Gemini 3 Pro Image" üretim anında teyit (`AI-SERVIS.md §9` ile aynı). SynthID watermark B2B önizlemede kabul edilebilir mi?
2. **Ücretlendirme:** Try-on/ölçü ücretsiz mi, kredi/bakiyeden mi? (Faz 1 maliyeti ~$0.067/görsel — aylık ücretsiz hak kaç?)
3. **AR yatırımı:** MVP (foto try-on) metrikleri Faz 2 (canlı AR) maliyetini karşılıyor mu? AR sadece iOS LiDAR'lı cihazlara mı (yüksek-değer B2B müşteri) öncelikli?
4. **Ölçü sorumluluğu:** AI/AR ölçü tahmin → yanlış baskı durumunda yasal metin/onay akışı (B2B sözleşme) net mi?
5. **Cihaz hedefi:** Minimum desteklenen cihazlar? (ARCore eski Android'de zayıf; LiDAR sadece iPhone Pro.) Faz 2 kapsamı buna göre daralır.
6. **3D motoru:** react-native-filament (önerilen) mı, R3F (ekip three.js'e hakimse) mi? expo-gl sürüm uyumu o anki Expo SDK'da çözülmüş mü?
7. **Segmentasyon yolu:** Canlı AR'de duvar maskesi ExecuTorch mı MobileSAM mı? Model boyutu/uygulama boyutu bütçesi?
8. **Seamless desen varlıkları:** Mevcut Wallpaper desenleri AR/3D için tile-edilebilir (seamless) ve doğru gerçek-dünya ölçeğinde (DPI/m²) hazır mı?

---

### Kaynaklar
- [react-native-vision-camera — npm](https://www.npmjs.com/package/react-native-vision-camera) · [Frame Processors — VisionCamera Docs](https://react-native-vision-camera.com/docs/guides/frame-processors) · [VisionCamera + ExecuTorch entegrasyonu](https://docs.swmansion.com/react-native-executorch/docs/next/hooks/computer-vision/visioncamera-integration)
- [ViroReact — ReactVision](https://reactvision.xyz/viro-react/) · [ReactVision/viro — GitHub](https://github.com/ReactVision/viro) · [@reactvision/react-viro — npm](https://www.npmjs.com/package/@reactvision/react-viro)
- [Apple RoomPlan — Developer](https://developer.apple.com/augmented-reality/roomplan/) · [RoomPlan Docs](https://developer.apple.com/documentation/roomplan/) · [Tracking and visualizing planes — ARKit](https://developer.apple.com/documentation/arkit/tracking-and-visualizing-planes)
- [react-native-filament — npm](https://www.npmjs.com/package/react-native-filament) · [margelo/react-native-filament — GitHub](https://github.com/margelo/react-native-filament) · [expo/expo-three — GitHub](https://github.com/expo/expo-three)
- [Nano Banana Pro (Gemini 3 Pro Image) Developer Guide & API 2026 — DEV](https://dev.to/akaranjkar08/nano-banana-pro-gemini-3-pro-image-developer-guide-api-2026-104c) · [Gemini 3 Pro Image — Google DeepMind](https://deepmind.google/models/gemini-image/pro/) · [Gemini API: image generation — ai.google.dev](https://ai.google.dev/gemini-api/docs/image-generation)
- [MobileSAM — Ultralytics Docs](https://docs.ultralytics.com/models/mobile-sam) · [ML Kit Selfie Segmentation — Google](https://developers.google.com/ml-kit/vision/selfie-segmentation/android)
