# Kanban Board — Sipariş / Üretim Takibi

> Üretim ekibinin (Aziz tarafı) siparişleri sürükle-bırak ile yönettiği pano.
> Referans: `~/Desktop/bütün-projeler/freelancer/pure` (NestJS+Prisma — **aynı stack**; status pipeline + reorder pattern oradan).
> Tasarım kararı: **kolonlar = sipariş durumları**, **kart = sipariş**, **sürükleme = durum değişimi** (mevcut durum makinesini kullanır).

---

## 1. Yaklaşım

Mevcut `Order.status` (RECEIVED → IN_PRODUCTION → AWAITING_APPROVAL → READY → SHIPPED) **zaten bir pipeline**. Kanban bunu görselleştirir:

```
RECEIVED        IN_PRODUCTION     AWAITING_APPROVAL    READY          SHIPPED
┌──────────┐    ┌──────────┐      ┌──────────┐         ┌──────────┐   ┌──────────┐
│ #1042 🟦 │    │ #1039 🟧 │      │ #1041 🟨 │         │ #1038 🟩 │   │ #1035 ✅ │
│ Wallpaper│    │ Wood     │      │ Decal    │         │ Wallpaper│   │ Wallpaper│
│ 6 m²     │    │ 1 ad     │      │ 1 ad     │         │ 12 m²    │   │ 3 m²     │
│ Bayi: X  │    │ Bayi: Y  │      │ Bayi: Z  │         │ Bayi: X  │   │ Bayi: W  │
└──────────┘    └──────────┘      └──────────┘         └──────────┘   └──────────┘
```

- **Kartı başka kolona sürükle** → o siparişin durumu değişir (mevcut `TRANSITIONS` doğrulaması + `OrderStatusEvent` log'u otomatik).
- **Kolon içinde sürükle** → öncelik sırası (`boardPosition`) değişir (acil işi yukarı al).
- Geçersiz geçiş (örn. SHIPPED → RECEIVED) sürüklemede reddedilir (durum makinesi).

> Avantaj: yeni "kart/kolon" modeli gerekmez — mevcut `Order` + `OrderStatus` + `OrderStatusEvent` yeniden kullanılır. Sadece sıralama için tek alan eklenir.

---

## 2. Veri modeli (minimum ekleme)

```prisma
model Order {
  // ... mevcut alanlar
  boardPosition Int @default(0)   // kolon (status) içindeki sıra
  @@index([status, boardPosition])
}
```

> İleride üretim adımları sipariş durumundan ayrışırsa (örn. "baskıda / kesimde / paketlemede" alt-akış) ayrı bir `ProductionStage` + `KanbanCard` modeli eklenebilir. Faz 1 için `Order.status` kolonları yeterli.

---

## 3. Endpoint'ler (ADMIN / PRODUCTION)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/board` | Siparişleri duruma göre grupla (her kolon, `boardPosition`'a göre sıralı). Filtre: tarih, bayi, kategori. |
| PATCH | `/api/board/orders/:id/move` | Kartı taşı: `{ toStatus, position }` → durum geçişi (doğrulamalı) + pozisyon + OrderStatusEvent |
| PATCH | `/api/board/reorder` | Kolon içi toplu sıralama: `{ status, items: [{ id, position }] }` (Pure pattern) |

**`/board` yanıtı (örnek):**
```json
{
  "columns": [
    { "status": "RECEIVED", "count": 4, "cards": [ { "id":"...", "orderNumber":"#1042", "category":"WALLPAPER", "totalSqm":6, "total":138, "dealer":"X", "ageHours":3 } ] },
    { "status": "IN_PRODUCTION", "count": 2, "cards": [ ... ] }
  ]
}
```

---

## 4. Reorder/move mantığı (Pure'dan uyarlanan)

```ts
// move: kartı başka kolona/pozisyona taşı
async moveCard(authUser, orderId, toStatus, position) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order.status !== toStatus) {
    // durum değişimi → mevcut state machine doğrulaması + event
    if (!TRANSITIONS[order.status].includes(toStatus))
      throw new BadRequestException('Geçersiz geçiş');
  }
  return prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: toStatus,
        boardPosition: position,
        statusEvents: order.status !== toStatus
          ? { create: { fromStatus: order.status, toStatus, byUserId: authUser.userId } }
          : undefined,
      },
    });
  });
}

// reorder: kolon içi toplu sıra (Pure pattern — items {id, position})
async reorder(status, items) {
  await prisma.$transaction(
    items.map((it) =>
      prisma.order.update({ where: { id: it.id }, data: { boardPosition: it.position } }),
    ),
  );
}
```

---

## 5. Frontend (sonra — frontend turunda)

- **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) — modern, hafif (Pure'da kütüphane yüklü değildi; biz dnd-kit ekleyeceğiz).
- Kolonlar = durumlar, kartlar sürüklenebilir; `onDragEnd` → optimistic UI güncelle → `PATCH /board/orders/:id/move`.
- Kart: sipariş no, kategori, m²/adet, tutar, bayi, yaş (kaç saattir bu durumda), dosya rozeti; tıkla → sipariş detay.
- Canlı güncelleme: WebSocket (harita ile aynı altyapı) → başka bir kullanıcı taşıyınca pano güncellenir.

---

## 6. Faz / öncelik
- Üretim ekibi için yüksek değer → **Sprint 1-2** (sipariş durum makinesi zaten var, üstüne hafif ekleme).
- Minimum: `GET /board` + `move` + `reorder` (backend) → sonra frontend dnd-kit.

## 7. Açık sorular
- Kolonlar **sipariş durumları** mı yeterli, yoksa üretim alt-adımları (baskı/kesim/paketleme) ayrı kanban mı olsun?
- Kart üzerinde hangi bilgiler kritik (atanan kişi/makine, termin tarihi)?
- Bayi de kendi siparişlerini kanban'da görsün mü (salt-okunur), yoksa sadece admin/üretim mi?
