# Push Bildirim (OneSignal toplu/broadcast) — Tasarım

> Referans: `~/Desktop/bütün-projeler/uzman/podcast_app/backend` (**NestJS — aynı stack**) + `podcast-mobile` (React Native).
> Podcast'taki çalışan kod Ortak Doku'ya neredeyse birebir taşınır. Aşağısı uyarlanmış hali.
> ⚠️ Podcast'ın `.env`'indeki gerçek OneSignal key REUSE EDİLMEZ — Ortak Doku **kendi OneSignal app'ini** açar.

---

## 1. Akış
Admin panel → `POST /push/send` → PushService (log + hedef cihaz token'ları) → OneSignalProvider (REST API) → OneSignal → iOS/Android/Web → mobil SDK alır.

## 2. Modeller (Prisma)

```prisma
model UserDevice {
  id           String   @id @default(cuid())
  userId       String
  deviceToken  String   // OneSignal subscription/player id
  platform     String   // IOS | ANDROID | WEB
  isActive     Boolean  @default(true)
  lastActiveAt DateTime @default(now())
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([deviceToken])
  @@index([userId, isActive])
}

model PushNotificationLog {
  id              String    @id @default(cuid())
  title           String
  body            String
  data            Json?
  targetType      String    // ALL | USER_IDS | SEGMENT
  targetIds       String[]
  totalRecipients Int       @default(0)
  successCount    Int       @default(0)
  failureCount    Int       @default(0)
  status          String    @default("PENDING") // PENDING|SENT|FAILED
  providerMsgId   String?
  errorMessage    String?
  sentAt          DateTime?
  createdByUserId String?
  createdAt       DateTime  @default(now())
  @@index([status, createdAt])
}
```
> Çoklu tenant gelince `tenantId` eklenir (podcast multi-tenant'tı — bizim row-level tenant planıyla uyumlu). Key başta **env**'den; per-tenant gerekirse şifreli `PushConfig` tablosu (podcast'taki gibi).

## 3. OneSignal Provider (REST API)

```ts
// src/push/onesignal.provider.ts
@Injectable()
export class OneSignalProvider {
  private appId = process.env.ONESIGNAL_APP_ID!;
  private apiKey = process.env.ONESIGNAL_API_KEY!; // REST API Key (Ortak Doku'nun kendi app'i)

  async send(opts: {
    title: string; body: string; data?: any;
    playerIds?: string[];     // toplu: belirli cihazlar
    segments?: string[];      // ALL için ['Subscribed Users'] vb.
    imageUrl?: string;
  }) {
    const payload: any = {
      app_id: this.appId,
      headings: { en: opts.title },
      contents: { en: opts.body },
      data: opts.data ?? {},
    };
    if (opts.imageUrl) payload.big_picture = opts.imageUrl;
    if (opts.segments?.length) payload.included_segments = opts.segments;
    else payload.include_player_ids = opts.playerIds ?? [];

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${this.apiKey}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    return { ok: res.ok, id: json.id, recipients: json.recipients ?? 0, error: json.errors };
  }
}
```

## 4. Push Service (toplu gönderim + log)

```ts
async send(authUserId: string, dto: SendPushDto) {
  const log = await this.prisma.pushNotificationLog.create({
    data: { title: dto.title, body: dto.body, data: dto.data,
            targetType: dto.targetType, targetIds: dto.userIds ?? [],
            createdByUserId: authUserId },
  });

  // Hedef token'ları çöz
  let playerIds: string[] = [];
  let segments: string[] | undefined;
  if (dto.targetType === 'ALL') {
    segments = ['Subscribed Users']; // OneSignal broadcast — veya tüm aktif token'lar
  } else if (dto.targetType === 'USER_IDS') {
    const devices = await this.prisma.userDevice.findMany({
      where: { userId: { in: dto.userIds! }, isActive: true }, select: { deviceToken: true },
    });
    playerIds = devices.map((d) => d.deviceToken);
  } else if (dto.targetType === 'SEGMENT') {
    segments = [dto.segment!];
  }

  const r = await this.onesignal.send({ ...dto, playerIds, segments });
  return this.prisma.pushNotificationLog.update({
    where: { id: log.id },
    data: { status: r.ok ? 'SENT' : 'FAILED', providerMsgId: r.id,
            totalRecipients: r.recipients, successCount: r.ok ? r.recipients : 0,
            errorMessage: r.ok ? null : JSON.stringify(r.error), sentAt: new Date() },
  });
}
```

> **Toplu büyük liste:** OneSignal `include_player_ids` ~2000 id/istek sınırı → 2000'lik parçalara böl (chunk) + BullMQ ile kuyruğa al (podcast 2000+ kullanıcıyı böyle yönetiyordu).

## 5. Endpoint'ler
| Method | Path | Yetki | Açıklama |
|---|---|---|---|
| POST | `/api/push/send` | ADMIN | Toplu/broadcast bildirim |
| POST | `/api/push/devices` | token | Cihaz kaydı (upsert by deviceToken) |
| DELETE | `/api/push/devices/:id` | token | Logout'ta kaydı sil |
| GET | `/api/push/logs` | ADMIN | Gönderim geçmişi |

## 6. Cihaz kaydı (service)
```ts
registerDevice(userId, dto) {
  return this.prisma.userDevice.upsert({
    where: { deviceToken: dto.deviceToken },
    update: { userId, platform: dto.platform, isActive: true, lastActiveAt: new Date() },
    create: { userId, deviceToken: dto.deviceToken, platform: dto.platform },
  });
}
```

## 7. Mobil (React Native — `react-native-onesignal`)
```ts
OneSignal.initialize(ONESIGNAL_APP_ID);
OneSignal.Notifications.requestPermission(true);
// login olunca:
OneSignal.login(user.id);
const subId = await OneSignal.User.pushSubscription.getIdAsync();
await api.post('/push/devices', { deviceToken: subId, platform: Platform.OS==='ios'?'IOS':'ANDROID' });
// subscription 'change' event'inde tekrar kaydet
```
> Mobil tarafı **Faz 2+** (Ortak Doku önce web; PWA web-push da OneSignal ile mümkün). Backend şimdiden hazır olabilir.

## 8. Env
```
ONESIGNAL_APP_ID=...        # Ortak Doku'nun kendi OneSignal app id'si
ONESIGNAL_API_KEY=...       # REST API Key — sadece backend env'inde (clienta sızmaz)
```

## 9. Faz
Backend push (toplu + cihaz kaydı + log) → **Sprint 2** (bildirim altyapısı, BACKEND-GENISLETME-PLANI §9). SMTP toplu bildirim ile aynı sprint. Mobil entegrasyon Faz 2+.
