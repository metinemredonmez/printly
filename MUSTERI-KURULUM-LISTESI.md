# Printy — Müşteri Kurulum & Hesap Açma Listesi

> Geliştirmeye başlamadan önce **karşı tarafın (firma) açması / teslim etmesi** gereken hesaplar ve bilgiler.
> Sıra önemli: **önce sunucu & altyapı**, sonra geliştirme hesapları, sonra ödeme, sonra iş bilgileri.

## Altın kural (hepsi için geçerli)
- **Her hesap firmanın adına ve firmanın kredi kartıyla açılır.** Sahibi firma, fatura firmada.
- Bana **admin / collaborator / member** erişimi verilir. Kontrol bende, mülkiyet sizde.
- **Şifreleri WhatsApp'tan düz yazmayın.** Ücretsiz bir parola kasası (Bitwarden / 1Password) açın, davet edin; tüm şifre ve API key'leri oradan paylaşın. (Güvenlik + tek yerden yönetim.)

---

## BÖLÜM A — Sunucu & Altyapı (ÖNCE BUNLAR)

| # | Hesap | Ne için | Kimin adına | Bana verilecek | Tahmini maliyet |
|---|---|---|---|---|---|
| A1 | **Domain (alan adı)** | Sitenin adresi (örn. printy.com) | Firma | Domain panel erişimi | ~12-20 $/yıl |
| A2 | **Cloudflare** | DNS + büyük dosya storage (R2) + CDN + güvenlik | Firma | Hesaba "Admin" davet | DNS bedava, R2 kullandıkça (~15 $/TB/ay) |
| A3 | **Hetzner Cloud** | Uygulama sunucusu (ABD lokasyonu) | Firma | Hesaba "Member" davet | Başta ~40-80 €/ay |

> **Not:** A1-A2-A3 kurulmadan hiçbir şey deploy edilemez. Bu yüzden ilk gün bunlar.
> **Lokasyon:** Müşteriler ABD'de olduğu için Hetzner'de **Ashburn (ABD)** lokasyonu seçilecek.

---

## BÖLÜM B — Geliştirme Hesapları (Claude Code dahil)

| # | Hesap | Ne için | Kimin adına | Bana verilecek | Tahmini maliyet |
|---|---|---|---|---|---|
| B1 | **GitHub** (Organization) | Kod deposu — back/front/mobil tek yerde | Firma | Org'a "Owner/Admin" davet | Bedava (private repo dahil) |
| B2 | **Anthropic / Claude (Claude Code)** | Kodu Claude Code ile yazacağım | Firma | API key veya plan daveti | Max plan ~100-200 $/ay *veya* API kullandıkça |
| B3 | **Vercel** (opsiyonel) | Frontend (Next.js) deploy + önizleme linkleri | Firma | Proje daveti | Başta bedava (Hobby), büyürse ~20 $/ay |

> B2 senin dediğin "Claude Code için hesap açmaları" kısmı. İki seçenek:
> - **Claude Max planı** (sabit aylık, öngörülebilir) — önerilen.
> - **Anthropic API key** (kullandıkça öde) — değişken.
> Hangisi olacağını birlikte netleştiririz; ikisi de firmanın adına.

---

## BÖLÜM C — Ödeme (Faz 1'de kritik)

| # | Hesap | Ne için | Kimin adına | Bana verilecek | Tahmini maliyet |
|---|---|---|---|---|---|
| C1 | **QuickBooks Online** | Fatura + tahsilat + eyalet vergisi + muhasebe | Firma (zaten var) | Şirket ID + erişim | Mevcut |
| C2 | **QuickBooks Developer** | API entegrasyonu (oto fatura/ödeme) | Firma | App + OAuth bilgileri (Client ID/Secret) | Bedava |
| C3 | **Stripe** (alternatif) | QuickBooks ödeme akışı yetmezse yedek | Firma | Hesaba davet + API key | Bedava (işlem başı komisyon) |

> Öncelik **QuickBooks**. Stripe sadece yedek; şimdilik açılması şart değil.

---

## BÖLÜM D — İş Bilgileri / Spec (hesap değil, doküman)

Bunlar olmadan fiyatlama ve ürün ekranlarını kuramam:

- [ ] **D1 — Fiyat / m² hesaplama kuralları:** Referans sitedeki abonelik + metrekare mantığı. Ürün × materyal × m² kademesi × bayiye özel fiyat nasıl işliyor? *(Excel veya örnek fatura ile)*
- [ ] **D2 — Ürün & materyal listesi:** Hangi ürünler, hangi materyaller (24"/26" vb.), birim (m²/adet).
- [ ] **D3 — Abonelik paketleri:** Kaç paket, içerikleri, kredi/bakiye mantığı.
- [ ] **D4 — Sipariş durumları & akış:** Alındı → Üretimde → Onay → Hazır → Kargo (varsa ek adım).
- [ ] **D5 — Roller:** Bayi / Admin / Üretim / Eğitim — kim neyi görebilir/yapabilir.
- [ ] **D6 — Tasarımlar:** Geldiğinde frontend'i ona göre kurarım.
- [ ] **D7 — QuickBooks vergi yapısı:** Hangi eyaletler, mevcut müşteri kayıt düzeni (API eşleştirmesi için).
- [ ] **D8 — Örnek baskı dosyaları:** 2-3 gerçek TIFF (boyut/DPI test etmek için).

---

## BÖLÜM E — Sonraki Fazlar (ŞİMDİ AÇILMASIN, not olarak dursun)

| Faz | Hesap | Ne zaman |
|---|---|---|
| Faz 2 | **Etsy Developer** (Open API v3) | Sipariş çekme — 1-3 ay |
| Faz 2 | Kargo (UPS/FedEx/USPS) | Genelde Etsy'den tracking gelir |
| Faz 3 | **AI API** (Claude/OpenAI görsel kalite kontrol) | 3-6 ay |
| Faz 3 | **GPU servis/sunucu** (upscale: Real-ESRGAN/Topaz) | 3-6 ay |
| Faz 4 | **SAi Flexi / Onyx** RIP erişimi | 6-12 ay |

> Bunları erken açmak para ve karmaşıklık demek. Sırası gelince konuşacağız.

---

## Özet: İlk gün için minimum açılması gerekenler
**A1 Domain · A2 Cloudflare · A3 Hetzner · B1 GitHub · B2 Claude · C1/C2 QuickBooks**
Bir de **D1-D2-D3** (fiyat + ürün + abonelik) spec'leri → Faz 1 başlar.
