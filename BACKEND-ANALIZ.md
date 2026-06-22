# Backend Gap Analizi — Mevcut Kod vs. Mockup + ANALIZ.md

> Tarih: 2026-06-22. Kaynak: `mockup.html` (Ortak Doku portalı) + `ANALIZ.md`.
> Amaç: Kurulan NestJS backend'i, mockup'taki **gerçek iş modeline** göre denetlemek.
> Sonuç: İskelet sağlam, ama **roller / fiyatlama / birim / bazı varlıklar** mockup'tan farklı — hizalanmalı.

---

## 0. Genel durum

| Alan | Durum |
|---|---|
| Altyapı (NestJS, Prisma, PG, R2, JWT/RBAC, dosya upload) | ✅ Sağlam, doğru kurulmuş |
| Sipariş durum makinesi (üretim tarafı) | ✅ Var, korunmalı |
| **Roller** | ⚠️ Mockup'tan farklı — değişmeli |
| **Fiyatlama motoru** | ⚠️ Mantık farklı (rol çarpanı + flat ürün + extra + %40) — yeniden yazılmalı |
| **Ölçü birimi** | ⚠️ Kod cm; mockup **inch** — değişmeli |
| **Org-merkezli model** | ⚠️ Mockup **kullanıcı + ekip lideri** hiyerarşisi — sadeleşmeli |
| EtsyStore, BillingInfo, Membership, Transaction, teslimat/extra alanları | ❌ Yok — eklenmeli |

---

## 1. KRİTİK FARKLAR (mismatch — düzeltilmeli)

### 1.1 Roller / üyelik modeli
**Mockup gerçeği:** 4 rol var ve bunlar **üyelik tier'ı**:
- **Kullanıcı (User):** ücretsiz, ürünleri **2× fiyattan** alır; $250 bakiye yükleyince %40 indirim.
- **Ekip Üyesi (Team Member):** **$30/ay aidat**, **1× fiyat**, bir **Ekip Liderine bağlı**.
- **Ekip Lideri (Team Leader):** aidatsız, 1× fiyat, **kendi ekip üyelerini yönetir**.
- **Yönetici (Admin):** sistem yönetimi.

**Mevcut kod (`schema.prisma`):** `Role = OWNER | STAFF | ADMIN | PRODUCTION | TRAINER`
**Sorun:** Tamamen farklı. Mockup'ta firma-içi "staff" yok; **kullanıcı + lider→üye hiyerarşisi** var.
**Öneri:** `Role = USER | TEAM_MEMBER | TEAM_LEADER | ADMIN | PRODUCTION` (üretim ekibi için PRODUCTION kalsın). `User.leaderId` (self-relation) ile üye→lider bağı. `membershipTier` + `priceMultiplier` (1× / 2×).

### 1.2 Fiyatlama motoru
**Mockup gerçeği (inline JS):**
- **Alan:** girdi **inch** → `sqft = w*h/144`, `sqm = sqft*0.092903`.
- **Wallpaper:** m² bazlı → `sqm * 23 * multiplier` (1×=$23/m², 2×=$46/m²). Alt tür: Peel&Stick Smooth / Canvas-Textile / Traditional (hepsi $23/m²).
- **Wall Decal:** **FLAT** $15 (1×) / $30 (2×) — m² yok.
- **Wood:** **FLAT** $35 (1×) / $70 (2×) — m² yok.
- **Extra'lar:** Shipping Box $2.50, Installation Kit $3.00, Sample $2.50 (sample = sabit 20"×15").
- **%40 indirim:** `hasDiscount40` (=$250 bakiye sonrası) ise `(base+extras) * 0.40` düşülür.
- Para birimi **USD**.

**Mevcut kod (`pricing.service.ts`):** Sadece m² kademe (`PricingRule.tierMin/tierMax`) + `pricePerM2/flatPrice`. **cm** kullanıyor. Rol çarpanı yok, kategori-flat mantığı yok, extra yok, %40 indirim yok.
**Öneri:** Motoru mockup mantığına göre yeniden yaz:
- Girdi inch (veya hem inch hem cm sakla).
- `priceMultiplier` (rol/üyelikten gelir).
- Ürün `unit = M2 | FLAT`; M2 → `sqm * pricePerM2 * mult`, FLAT → `flatPrice * mult`.
- Extra kalemleri ayrı (`OrderItemExtra` veya order seviyesinde).
- `%40` indirim, kullanıcının `hasDiscount40` durumuna göre.

### 1.3 Ölçü birimi (inch ↔ cm)
**Mockup:** inch. **Kod:** `OrderItem.widthCm/heightCm` + `(cm/100)^2`.
**Öneri:** `widthInch/heightInch` sakla, m²'yi mockup formülüyle hesapla. (Gerekirse cm'yi türetilmiş tut.)

### 1.4 Org-merkezli vs kullanıcı-merkezli
**Mockup:** Her satıcı bir **kullanıcı**; bakiye, üyelik, fatura, mağaza **kullanıcıda**. "Firma içi çok kullanıcı" yok; onun yerine **lider→üye** hiyerarşisi var.
**Mevcut kod:** `Organization` merkezli, `creditBalance` org'da, `User.organizationId`.
**Öneri:** `Organization`'ı kaldır (veya opsiyonel bırak). Merkez = `User`. `balance`, `membershipTier`, `hasDiscount40`, `leaderId` → User'a taşı. Bakiye/kredi defteri user bazlı olsun.

---

## 2. EKSİK VARLIKLAR (entities — eklenmeli)

| Varlık | Neden gerekli (mockup) | Öncelik |
|---|---|---|
| **EtsyStore** | "Mağazalarım" ekranı; sipariş "Siparişi Veren Mağaza" seçimi zorunlu | Faz 1 |
| **BillingInfo** | "Fatura Bilgileri" — TR/US, Bireysel/Kurumsal, TC/SSN/EIN/Vergi No | Faz 1 |
| **Membership** | tier, aylık aidat ($30), yenileme tarihi, lider bağı | Faz 1 |
| **Transaction** | `balance_load` / `order_payment` / `membership_fee` — ödeme geçmişi | Faz 1 |
| **Order: teslimat alanları** | müşteri ad/soyad, adres, ülke, ZIP, telefon, not, kargo etiketi | Faz 1 |
| **Order: meta alanlar** | category, productType, extras[], etsyOrderNo, storeId, orderDate, paymentMethod | Faz 1 |
| **Asset: tip etiketi** | production / mockup-control / shipping-label (3 farklı dosya) | Faz 1 |
| **Settings/Theme** | admin renk/logo/hero (çoğu front, ama saklanması gerekebilir) | Faz 2 |

---

## 3. MEVCUT & UYUMLU OLANLAR (korunacak)

- ✅ **NestJS modüler yapı**, global JWT + RBAC guard, `@Public()` / `@Roles()` — sağlam.
- ✅ **R2 presigned multipart upload** — mockup max **500MB** üretim dosyası ister; multipart bunu karşılar. (Mockup dosya tipleri PDF/AI/EPS/PNG; TIFF de gelebilir — fark etmez.)
- ✅ **Sipariş durum makinesi** (RECEIVED→IN_PRODUCTION→…→SHIPPED) — mockup dealer tarafını gösteriyor ama **üretim takibi (Aziz tarafı) için bu şart**; korunmalı.
- ✅ **Kredi defteri (CreditLedger)** — bakiye mantığının temeli var; user'a taşınıp %40 kuralı eklenecek.
- ✅ **Katalog (Material/Product/PricingRule)** — yapı tutuyor; PricingRule mantığı revize edilecek.
- ✅ **Prisma migration + seed + docker (5433/6380) + dev/prod env** — altyapı hazır.

---

## 4. REVİZE VERİ MODELİ ÖNERİSİ (özet)

```
User (merkez)
  id, email, passwordHash, fullName, phone
  role (USER|TEAM_MEMBER|TEAM_LEADER|ADMIN|PRODUCTION)
  membershipTier, priceMultiplier (1 | 2)
  balance (USD), hasDiscount40
  leaderId  → User (self-relation: üye→lider)
  isEmailVerified
  → etsyStores[], orders[], billingInfo?, transactions[], creditLedger[]

EtsyStore        id, userId, name, apiKey?, createdAt
BillingInfo      id, userId(unique), country(TR|US), type(IND|CORP),
                 address, tc?, companyTitle?, taxOffice?, taxNo?, ssn?, ein?, state?
Membership       id, userId, tier, monthlyFee, status, renewalDate, leaderId?
Transaction      id, userId, type(BALANCE_LOAD|ORDER_PAYMENT|MEMBERSHIP_FEE),
                 amount, status, orderId?, createdAt

Product          id, name, category(WALLPAPER|WALL_DECAL|WOOD),
                 unit(M2|FLAT), basePricePerM2?, flatPrice?, subTypes(JSON), active
ExtraOption      id, name, price (Shipping Box/Installation Kit/Sample)

Order
  id, orderNumber, userId, etsyStoreId, etsyOrderNo, orderDate,
  category, productType, status, paymentMethod(BALANCE|CARD), paymentStatus,
  subtotal, extrasTotal, discount40, total
  delivery: clientName, clientAddress, country, zip, city, state, phone?, note?
  → items[], extras[], assets[](production/mockup/shippingLabel), statusEvents[]

OrderItem        widthInch, heightInch, sqft, sqm, quantity, unitPrice, lineTotal
```

---

## 5. YAPILACAKLAR (öncelik sırası — Faz 1)

1. **Roller + User-merkezli model** — schema'yı revize et (Role enum, User'a balance/tier/leaderId, Organization'ı kaldır/opsiyonelle).
2. **Fiyatlama motorunu yeniden yaz** — inch→m², rol çarpanı, kategori flat/m², extra'lar, %40 indirim.
3. **Product'a category + unit(M2|FLAT) + flatPrice** ekle; ExtraOption ekle; seed'i mockup fiyatlarıyla güncelle ($23/m², decal $15, wood $35).
4. **EtsyStore + BillingInfo + Transaction + Membership** modülleri.
5. **Order'ı genişlet** — kategori, extra, teslimat, ödeme yöntemi, 3 tip dosya.
6. **Bakiye + %40 + $250 yükleme** mantığını Credit/Transaction'a bağla.
7. Seed: admin `admin@ortakdoku.com`, örnek lider kullanıcılar (mockup seed'iyle uyumlu).
8. (Faz 2) Google Sheets/Drive, Etsy API, OTP e-posta doğrulama, QuickBooks.

---

## 6. Karar gereken noktalar (sana sormam gerekenler)
- **Organization tamamen kalksın mı?** Mockup bireysel satıcı + ekip hiyerarşisi gösteriyor; ileride "çok kullanıcılı firma" gerekecek mi? (Bence şimdilik kaldır, User+leader yeter.)
- **Ölçü birimi:** Sadece inch mi (mockup öyle), yoksa hem inch hem cm gösterelim mi?
- **%40 indirim** sadece bakiye ($250) ile mi, yoksa başka koşullar da var mı?
- **OTP e-posta doğrulama** Faz 1'de mi olsun, Faz 2'ye mi? (Mockup'ta var ama simüle.)
