# QR/Barkod Okutma — Backend + Mobil Yapılacaklar

> **Proje:** Ortak Doku B2B Print-on-Demand
> **Stack:** NestJS + Postgres (Prisma) + Cloudflare R2 + Redis + BullMQ • Mobil: React Native
> **Senaryo:** Üretim ekibi, kargo/üretim etiketindeki **Code128 barkodu (`orderNumber`)** mobil cihazla okutup siparişin durumunu istasyon bazlı ilerletir (baskı → kesim → paketleme → kargo).
> **Mevcut altyapı (teyit edildi):** State machine `TRANSITIONS` (`orders.service.ts`), `OrderStatusEvent` modeli, `AuditService`, `@nestjs/throttler ^6.5.0`, OneSignal push, `RequirePermission`/`PermissionsGuard`, `order:updateStatus` izni (PRODUCTION rolünde mevcut).

---

## 0. Mevcut Duruma Bağlama (kod referansları)

Bu doküman sıfırdan değil, **var olan kodun üzerine** kuruludur. İlgili dosyalar:

| Konu | Dosya |
|---|---|
| State machine + `updateStatus()` | `/Users/emre/Desktop/printy/backend/src/orders/orders.service.ts` |
| Sipariş controller | `/Users/emre/Desktop/printy/backend/src/orders/orders.controller.ts` |
| İzin matrisi (`order:updateStatus`) | `/Users/emre/Desktop/printy/backend/src/common/permissions.ts` |
| İzin guard / decorator | `/Users/emre/Desktop/printy/backend/src/common/guards/permissions.guard.ts`, `.../decorators/require-permission.decorator.ts` |
| Audit | `/Users/emre/Desktop/printy/backend/src/audit/audit.module.ts` |
| Etiket + Code128 üretimi | `/Users/emre/Desktop/printy/backend/src/labels/labels.module.ts` |
| Push (cihaz kaydı + gönderim) | `/Users/emre/Desktop/printy/backend/src/notifications/notifications.module.ts` |
| Şifreleme (imzalı QR için kullanılabilir) | `/Users/emre/Desktop/printy/backend/src/common/crypto.util.ts` |
| Schema (`Order.orderNumber`, `OrderStatusEvent`, `UserDevice`, `AuditLog`) | `/Users/emre/Desktop/printy/backend/prisma/schema.prisma` |

**Kritik mimari karar:** Mevcut `TRANSITIONS` makinesi tek bir `READY` durumuna sahip; "baskı/kesim/paketleme" gibi istasyonlar **alt-aşamadır**, ana `OrderStatus`'a birebir karşılık gelmez. İki seçenek var (aşağıda Bölüm 1.3'te detaylandırıldı). **Önerilen: state machine'i bozmadan, istasyon ilerlemesini ayrı bir alanda/tabloda tutmak.**

---

## 1. Akış

### 1.1 Uçtan uca akış

```
[ADMIN/PRODUCTION]                [ÜRETİM SAHASI / Mobil]              [Backend]
      │                                   │                              │
      ├─ Etiket bas (PDF) ────────────────┤                              │
      │   GET /labels/order/:id           │                              │
      │   (Code128 = orderNumber)         │                              │
      │                                   │                              │
      │                          1. İstasyonu seç (BASKI)                │
      │                          2. Barkodu okut (orderNumber)           │
      │                          3. POST /scan ──────────────────────────►
      │                                   │              ┌───────────────┤
      │                                   │              │ a) idempotency kontrol
      │                                   │              │ b) orderNumber → Order çöz
      │                                   │              │ c) station → hedef durum eşle
      │                                   │              │ d) TRANSITIONS izin kontrol
      │                                   │              │ e) Order.update + OrderStatusEvent
      │                                   │              │ f) AuditService.log
      │                                   │              │ g) push/mail (BullMQ)
      │                                   │              └───────────────┤
      │                          4. ◄── 200 {order, newStatus} ──────────┤
      │                          5. Ses + titreşim (başarı feedback)      │
```

### 1.2 İstasyonlar (saha gerçeği)

| İstasyon | Anlamı | Ürün notu |
|---|---|---|
| `PRINT` (Baskı) | Wallpaper/Decal baskıya alındı | Wood (CNC) için baskı yok → atlanır |
| `CUT` (Kesim) | Kesim/CNC tamamlandı | Wood için ana adım |
| `PACK` (Paketleme) | Paketlendi, kargoya hazır | |
| `SHIP` (Kargo) | Kargoya verildi | Takip no opsiyonel |
| `QC`/`APPROVAL` (Onay) | Müşteri onayı bekleyen ürünler için | Sadece onay gereken kalemler |

### 1.3 İstasyon → Hedef Durum eşlemesi (KARAR NOKTASI)

Mevcut `OrderStatus`: `RECEIVED → IN_PRODUCTION → AWAITING_APPROVAL → READY → SHIPPED` (+ `CANCELLED`).

**Önerilen model (hibrit):** Ana `OrderStatus` makinesi **korunur**; istasyonlar `productionStage` alanına yazılır.

```
İstasyon (action)   →  productionStage   +  OrderStatus geçişi (varsa)
─────────────────────────────────────────────────────────────────────
PRINT  (Baskı)      →  PRINTING          +  RECEIVED → IN_PRODUCTION
CUT    (Kesim)      →  CUTTING           +  (zaten IN_PRODUCTION, status değişmez)
PACK   (Paketleme)  →  PACKED            +  IN_PRODUCTION/AWAITING_APPROVAL → READY
SHIP   (Kargo)      →  SHIPPED           +  READY → SHIPPED
APPROVAL (Onay iste)→  AWAITING_APPROVAL +  IN_PRODUCTION → AWAITING_APPROVAL
```

> **Neden hibrit?** `READY` öncesi her istasyonu ayrı `OrderStatus` yapmak, `TRANSITIONS` matrisini, Kanban board'u (`boardPosition`) ve müşteriye giden bildirimleri kırar. Saha granülerliği `productionStage` ile sağlanır; müşteriye yalnız anlamlı ana durum yansır (`IN_PRODUCTION`, `READY`, `SHIPPED`).

**Şema eklemesi (yeni migration):**
```prisma
enum ProductionStage {
  QUEUED
  PRINTING
  CUTTING
  PACKED
  SHIPPED
}

// Order modeline:
productionStage   ProductionStage @default(QUEUED)
```

---

## 2. Backend YAPILACAKLAR (somut)

### 2.1 Scan endpoint tasarımı

Yeni modül: `src/scan/scan.module.ts` (`OrdersService` + `AuditService` enjekte eder).

**Endpoint:** `POST /scan`

**Request DTO:**
```ts
// src/scan/dto.ts
import { IsString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ScanDto {
  @IsString() code!: string;              // okunan barkod/QR ham değeri (orderNumber veya imzalı token)
  @IsIn(['PRINT', 'CUT', 'PACK', 'SHIP', 'APPROVAL'])
  station!: 'PRINT' | 'CUT' | 'PACK' | 'SHIP' | 'APPROVAL';

  @IsString()  clientScanId!: string;     // idempotency anahtarı (cihazda üretilen UUID)
  @IsOptional() @IsString() trackingNo?: string;   // SHIP istasyonu için opsiyonel
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() stationDeviceId?: string; // hangi tablet/telefon
}
```

**Response:**
```ts
{
  ok: true,
  orderId: string,
  orderNumber: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  productionStage: ProductionStage,
  alreadyApplied: boolean,   // idempotent tekrar ise true
  scannedAt: string
}
```

**Service iskeleti (`scan.service.ts`):**
```ts
async scan(authUser: AuthUser, dto: ScanDto) {
  // 1) Code çöz: imzalı token mı, düz orderNumber mı?
  const orderNumber = this.resolveCode(dto.code); // Bölüm 2.5

  // 2) Idempotency: aynı clientScanId daha önce işlendiyse kayıtlı sonucu döndür
  const prior = await this.prisma.scanEvent.findUnique({
    where: { clientScanId: dto.clientScanId },
  });
  if (prior) return { ...this.toResponse(prior), alreadyApplied: true };

  // 3) orderNumber → Order
  const order = await this.prisma.order.findUnique({ where: { orderNumber } });
  if (!order) throw new NotFoundException('Sipariş bulunamadı (barkod geçersiz)');

  // 4) station → hedef durum + stage eşle
  const target = STATION_MAP[dto.station]; // { stage, statusOrNull }

  // 5) İzinli geçiş kontrolü (mevcut TRANSITIONS) — atomik transaction
  return this.prisma.$transaction(async (tx) => {
    // varsa OrderStatus geçişi: TRANSITIONS doğrulaması
    if (target.status && target.status !== order.status) {
      const allowed = TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(target.status))
        throw new BadRequestException(
          `Bu istasyon (${dto.station}) bu siparişte uygulanamaz: ${order.status} → ${target.status}`,
        );
    }
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        productionStage: target.stage,
        ...(target.status ? { status: target.status } : {}),
        ...(target.status && target.status !== order.status
          ? { statusEvents: { create: {
              fromStatus: order.status, toStatus: target.status,
              note: `[${dto.station}] ${dto.note ?? ''}`.trim(),
              byUserId: authUser.userId,
            } } }
          : {}),
        ...(dto.trackingNo ? { trackingNo: dto.trackingNo } : {}),
      },
    });
    // scanEvent kalıcı kaydı (idempotency + audit izi)
    const ev = await tx.scanEvent.create({ data: {
      clientScanId: dto.clientScanId, orderId: order.id, station: dto.station,
      fromStatus: order.status, toStatus: target.status ?? order.status,
      stage: target.stage, byUserId: authUser.userId,
      stationDeviceId: dto.stationDeviceId,
    }});
    return { ev, updated };
  }).then(async ({ ev, updated }) => {
    // 6) audit + bildirim (transaction DIŞINDA, best-effort)
    await this.audit.log({
      actorUserId: authUser.userId, actorRole: authUser.role,
      action: 'ORDER_SCAN', entityType: 'Order', entityId: order.id,
      meta: { station: dto.station, from: order.status, to: updated.status, stage: updated.productionStage },
    });
    if (updated.status !== order.status) {
      // müşteriye/bayiye push + mail BullMQ kuyruğuna (mevcut 'notifications' queue)
      await this.queue.add('order-status-push', { orderId: order.id, status: updated.status });
    }
    return this.toResponse(ev, false);
  });
}
```

**Controller:**
```ts
@RequirePermission('order:updateStatus')   // PRODUCTION + ADMIN
@Throttle({ default: { limit: 60, ttl: 60_000 } }) // saniyede ~1, dakikada 60 okutma
@Post()
scan(@CurrentUser() user: AuthUser, @Body() dto: ScanDto) {
  return this.scan.scan(user, dto);
}
```

### 2.2 Idempotency (zorunlu)

Saha gerçeği: aynı barkod yanlışlıkla 2-3 kez okutulur, ağ timeout sonrası mobil retry yapar.

- **`clientScanId`** (cihazda üretilen UUID) **unique** kolon → `ScanEvent` tablosunda.
- Aynı `clientScanId` geldiğinde **yeni geçiş yapma**, kayıtlı sonucu `alreadyApplied: true` ile döndür.
- Ayrıca **mantıksal idempotency:** sipariş zaten hedef stage'deyse (örn. zaten `SHIPPED`), 200 + `alreadyApplied: true` döndür, hata fırlatma (saha personeli hata mesajı görmesin).

**Yeni model:**
```prisma
model ScanEvent {
  id              String        @id @default(cuid())
  clientScanId    String        @unique      // idempotency
  orderId         String
  order           Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  station         String
  stage           ProductionStage
  fromStatus      OrderStatus?
  toStatus        OrderStatus
  byUserId        String?
  stationDeviceId String?
  createdAt       DateTime      @default(now())

  @@index([orderId, createdAt])
}
```

### 2.3 Yetki (authorization)

- Mevcut `order:updateStatus` izni **yeniden kullanılır** — PRODUCTION rolünde zaten var (`permissions.ts`).
- `@RequirePermission('order:updateStatus')` decorator + `PermissionsGuard` ile korunur.
- **İsteğe bağlı sıkılaştırma:** İstasyon bazlı ince izin (`scan:print`, `scan:ship` vb.) eklenebilir; ancak MVP için tek izin yeterli. Kargo (`SHIP`) hassas olduğundan ileride `order:ship` ayrı izni düşünülebilir.
- JWT zaten `JwtAuthGuard` ile global; scan endpoint kimliksiz çağrılamaz.

### 2.4 Çoklu istasyon

- `station` alanı zorunlu → her tablet/telefon **tek bir istasyona** kilitlenir (mobilde ayar olarak saklanır, her istekte gönderilir).
- `stationDeviceId` ile hangi cihazın okuttuğu audit'e yazılır.
- Aynı sipariş farklı istasyonlardan sırayla geçer; `productionStage` ileri-yönlü ilerler. Geri gitme (örn. `PACKED → PRINTING`) **engellenir** (Bölüm 2.6).

### 2.5 QR formatı: `orderNumber` mı, imzalı token mı?

**Mevcut durum:** Etiketteki Code128 = ham `orderNumber` (cuid, örn. `clpx7a...`).

| Yaklaşım | Artı | Eksi |
|---|---|---|
| **A) Ham `orderNumber`** (mevcut Code128) | Basit; mevcut etiket çalışır; üretici PDF görür/okur | Tahmin edilebilir değil ama enumerasyona kısmen açık; "sahte etiket" basılabilir |
| **B) İmzalı QR token** (HMAC) | Sahte etiket basılamaz; süre/scope sınırlanabilir | Etikete QR eklemek gerek; offline doğrulama anahtar paylaşımı ister |

**Öneri (pragmatik):**
1. **Code128 (`orderNumber`) kalır** — backend'de yetki + state machine zaten sahte okutmayı sınırlar (geçersiz orderNumber → 404; izinsiz geçiş → 400).
2. **Code128'e EK olarak imzalı QR** basılır (opsiyonel ama önerilen). QR payload:
   ```
   { orderNumber}.{exp}.{HMAC_SHA256(orderNumber|exp, SCAN_SECRET)}
   ```
   - HMAC üretimi `crypto.util.ts` mantığına benzer; ayrı `SCAN_SECRET` env değişkeni.
   - Backend `resolveCode()`: değer QR formatındaysa imzayı + `exp`'i doğrula, değilse düz `orderNumber` kabul et (geriye uyumlu).
3. **`labels.module.ts` güncellemesi:** mevcut Code128 üretimine ek olarak `bcid: 'qrcode'` ile imzalı QR ekle (etikette yan yana).

### 2.6 Hata / ambiguity yönetimi

| Senaryo | Davranış |
|---|---|
| `orderNumber` bulunamadı | `404` — "Barkod geçersiz / sipariş yok" |
| İzinsiz state geçişi (örn. `SHIPPED` siparişe tekrar `PRINT`) | `400` net mesaj |
| Geri yönlü stage (örn. `PACKED → CUTTING`) | `400` "Sipariş bu istasyonu geçmiş" (veya idempotent 200, politika kararı) |
| Aynı `clientScanId` tekrar | `200` + `alreadyApplied: true` |
| `CANCELLED` sipariş okutuldu | `400` "İptal edilmiş sipariş" |
| Wood ürün `PRINT` istasyonunda | İş kuralı: ya atla (`200`, stage değişmez) ya da `400`; **önerilen:** `STATION_MAP` içinde ürün-tipi farkındalığı |
| Bozuk/yarım barkod | Mobil tarafta okutma onayı + manuel `orderNumber` girişi fallback |

---

## 3. Mobil YAPILACAKLAR (React Native)

### 3.1 Tarayıcı kütüphane karşılaştırması (2026)

| Kriter | **react-native-vision-camera (v5.0.11)** ✅ önerilen | **expo-camera** |
|---|---|---|
| Performans | Frame processor GPU thread'de, 2–5ms/frame, 30–60 FPS | Yeterli ama daha az esnek |
| Barkod desteği | ML Kit, 16 format (Code128, QR, PDF417, EAN…) | Code128/QR var; GS1 DataBar yok |
| Code128 | Destekli (Android portrait'te bilinen okuma hatası → landscape veya QR ile telafi) | Destekli |
| Görüntüden tarama | Var (kaydedilmiş foto) | **Yok** (sadece canlı) |
| Otomatik odak / pinch-zoom | Var | Kısıtlı |
| Kurulum | `react-native-vision-camera` + `react-native-nitro-modules` + `react-native-vision-camera-barcode-scanner` | Tek paket, Expo ile entegre |
| Bare RN | İdeal | Expo/EAS ile en iyi |

**Karar:** Proje saha-yoğun (hızlı çoklu okutma, ışık değişkenliği, dayanıklılık) olduğundan **react-native-vision-camera** seçilir. Code128'in Android portrait sorununa karşı **etikete imzalı QR de bastığımız için** QR'a düşüş (fallback) mümkün.

> Expo workflow kullanılacaksa: `expo-camera` ile başlanıp, performans/format ihtiyacı doğunca vision-camera'ya geçilir (EAS dev build gerekir).

### 3.2 Kamera izni

- iOS: `Info.plist` → `NSCameraUsageDescription`.
- Android: `AndroidManifest.xml` → `android.permission.CAMERA`.
- Runtime: `Camera.requestCameraPermission()` (vision-camera) → reddedilirse ayarlara yönlendir.

### 3.3 Tarama ekranı UX

- Tam ekran kamera + ortada hedef çerçeve (overlay).
- Üstte **seçili istasyon** rozeti (örn. "BASKI istasyonu") — yanlış istasyonda okutmayı önler.
- Alt barda son okutulan siparişler listesi (orderNumber + durum + ✓).
- Okutma anında çerçeve yeşil/kırmızı flash + sonuç toast'ı.

### 3.4 Offline kuyruk + sync (kritik)

Saha Wi-Fi'si güvenilmez. Mimari:

1. Her okutma önce **lokal kuyruğa** yazılır (AsyncStorage / MMKV / WatermelonDB) — `clientScanId` (UUID) cihazda üretilir.
2. Kullanıcıya **anında lokal başarı feedback** (optimistic) verilir.
3. Arka plan **sync worker**: ağ gelince kuyruğu sırayla `POST /scan`'e gönderir.
4. Backend idempotent olduğundan (Bölüm 2.2) çift gönderim güvenli.
5. `200` alınınca kuyruktan sil; `4xx` (kalıcı hata, örn. 404) → "başarısız" olarak işaretle + kullanıcıya bildir; `5xx`/timeout → retry (exponential backoff).
6. Sync durumu UI'da görünür (örn. "3 okutma gönderiliyor").

### 3.5 Hızlı çoklu okutma

- Okutma sonrası **0.8–1.5sn debounce** (aynı barkodu üst üste işlememe).
- `useCodeScanner` callback'inde son okunan `code`'u takip et; aynıysa yoksay.
- Başarı feedback'i kısa tut → operatör hemen sıradaki etikete geçsin.

### 3.6 Ses / titreşim feedback

- Başarı: kısa "beep" + `Haptics.notificationAsync(Success)` / `Vibration.vibrate(50)`.
- Hata: farklı/uzun beep + hata titreşimi → gürültülü ortamda ayırt edilir.
- Sessiz mod ayarı (gece vardiyası).

### 3.7 Login / rol

- JWT login (mevcut `/auth` akışı).
- Token güvenli saklama (`react-native-keychain` / `expo-secure-store`).
- Sadece PRODUCTION/ADMIN scan ekranına erişir (mobil rol kontrolü + backend `RequirePermission` çift katman).
- İlk açılışta **istasyon seçimi** (cihaz başına sabitlenir, değiştirilebilir).
- OneSignal cihaz kaydı: `POST /notifications/devices` (mevcut endpoint) ile push token kaydı.

---

## 4. Güvenlik

| Tehdit | Önlem |
|---|---|
| **Sahte okutma** (yetkisiz kişi durum ilerletir) | JWT + `RequirePermission('order:updateStatus')`; rol PRODUCTION/ADMIN |
| **Sahte etiket** (rakip/dış kişi barkod basar) | İmzalı QR (HMAC + `exp`); ham `orderNumber` tek başına geçiş yaptırsa bile yetki + state machine sınırlar |
| **Enumeration** (`orderNumber` tahmini) | `orderNumber` cuid (tahmin zor); imzalı QR ile tam kapatılır |
| **Replay** (eski okutma tekrarı) | `clientScanId` unique + mantıksal idempotency; QR'da `exp` |
| **Brute-force / DoS** | `@nestjs/throttler` ile `@Throttle` (dakikada ~60); IP + userId bazlı |
| **Yanlış istasyon** | `station` zorunlu + `STATION_MAP` + `TRANSITIONS` doğrulaması; geri-yön engeli |
| **Veri sızıntısı (PII etiket)** | Etiket erişimi `@Roles(ADMIN, PRODUCTION)` (mevcut `labels` controller) |
| **Audit eksikliği** | Her scan → `ScanEvent` (kalıcı) + `AuditService.log('ORDER_SCAN')` |

**Önerilen yeni env:** `SCAN_SECRET` (HMAC için, `ENCRYPTION_KEY`'den ayrı).

---

## 5. Adım Adım Yapılacaklar Listesi

### FAZ 0 — Şema & Temel (1-2 gün)
- [ ] **(Backend)** `ProductionStage` enum + `Order.productionStage` alanı ekle, migration.
- [ ] **(Backend)** `ScanEvent` modeli + `clientScanId @unique` + index, migration.
- [ ] **(Backend)** `Order.trackingNo` alanı (yoksa) ekle.

### FAZ 1 — Scan Backend (2-3 gün)
- [ ] **(Backend)** `src/scan/` modülü: `scan.module.ts`, `scan.service.ts`, `scan.controller.ts`, `dto.ts`.
- [ ] **(Backend)** `STATION_MAP` (istasyon → stage + opsiyonel status) tanımla.
- [ ] **(Backend)** `POST /scan` — `@RequirePermission('order:updateStatus')` + `@Throttle`.
- [ ] **(Backend)** `resolveCode()`: ham `orderNumber` + imzalı QR ayrımı (geriye uyumlu).
- [ ] **(Backend)** Idempotency (`clientScanId` + mantıksal "zaten o durumda").
- [ ] **(Backend)** Atomik `$transaction`: `Order.update` + `OrderStatusEvent` + `ScanEvent`.
- [ ] **(Backend)** Hata/ambiguity matrisi (404/400/200-already).
- [ ] **(Backend)** `AuditService.log('ORDER_SCAN')` + durum değişince BullMQ `notifications` kuyruğuna push/mail job.
- [ ] **(Backend)** Ürün-tipi kuralı (Wood → PRINT atla) `STATION_MAP`'e.
- [ ] **(Backend)** Unit test: izinli/izinsiz geçiş, idempotent tekrar, geçersiz kod.

### FAZ 2 — İmzalı QR & Etiket (1 gün, FAZ 1 ile paralel)
- [ ] **(Backend)** `SCAN_SECRET` env + HMAC üret/doğrula yardımcısı.
- [ ] **(Backend)** `labels.module.ts`: mevcut Code128'e ek imzalı QR (`bcid: 'qrcode'`) bas.
- [ ] **(Backend)** QR `exp` doğrulaması `resolveCode()` içinde.

### FAZ 3 — Mobil İskelet (3-4 gün)
- [ ] **(Mobil)** RN projesi + `react-native-vision-camera` v5 + `react-native-nitro-modules` + barcode-scanner paketleri.
- [ ] **(Mobil)** Kamera izni akışı (iOS Info.plist + Android manifest + runtime).
- [ ] **(Mobil)** Login ekranı (JWT) + token `keychain`/`secure-store`.
- [ ] **(Mobil)** İlk açılış istasyon seçimi (cihazda sabit).
- [ ] **(Mobil)** Tarama ekranı: kamera + overlay + istasyon rozeti + son okutmalar.

### FAZ 4 — Mobil Offline & UX (3-4 gün)
- [ ] **(Mobil)** Lokal kuyruk (MMKV/WatermelonDB) + cihazda `clientScanId` UUID.
- [ ] **(Mobil)** Optimistic feedback + arka plan sync worker (backoff retry).
- [ ] **(Mobil)** `POST /scan` entegrasyonu + sonuç eşleme (already/hata).
- [ ] **(Mobil)** Debounce (çift okutma engeli) + hızlı çoklu okutma.
- [ ] **(Mobil)** Ses + titreşim (başarı/hata farklı).
- [ ] **(Mobil)** Code128 okunamazsa QR fallback + manuel `orderNumber` girişi.
- [ ] **(Mobil)** OneSignal cihaz kaydı (`POST /notifications/devices`).
- [ ] **(Mobil)** Sync durumu UI göstergesi.

### FAZ 5 — Sertleştirme & Yayın (2 gün)
- [ ] **(Backend)** Rate-limit eşiklerini saha yüküne göre ayarla.
- [ ] **(Backend)** Audit/`ScanEvent` raporu (istasyon başına throughput) — `reports` modülüne.
- [ ] **(Mobil)** Düşük ışık/hasarlı etiket saha testi (vision-camera autofocus/torch).
- [ ] **(Her ikisi)** Uçtan uca senaryo: etiket bas → 4 istasyon → SHIPPED → müşteri push.
- [ ] **(Mobil)** EAS/store build + saha pilotu (tek istasyon → kademeli yaygınlaştırma).

---

## Kaynaklar
- [react-native-vision-camera — npm (v5.0.11, 2026)](https://www.npmjs.com/package/react-native-vision-camera)
- [The Barcode Scanner | VisionCamera Docs](https://react-native-vision-camera.com/docs/guides/code-scanning)
- [QR and Barcode Scanning in React Native with VisionCamera V5 — Margelo](https://blog.margelo.com/react-native-qr-barcode-scanner-visioncamera-v5)
- [Comparing React Native barcode scanner libraries — Scanbot](https://scanbot.io/blog/react-native-vision-camera-vs-expo-camera/)
- [Vision Camera vs Expo Camera vs Image (2026) — PkgPulse](https://www.pkgpulse.com/guides/react-native-vision-camera-vs-expo-camera-vs-expo-image-2026)
- [Code 128 portrait okuma sorunu — vision-camera Issue #3156](https://github.com/mrousavy/react-native-vision-camera/issues/3156)
- [Camera — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/camera/)
