# AI Servisi — Tasarım (Ortak Doku)

> **Ayrı, backend-harici bir servis.** Ana NestJS backend ile servis-servis (internal API + token) konuşur.
> Sağlayıcı: **Google Gemini** (kullanıcının Ultra aboneliği + API key'i var; gerekirse ek kota alınır).
> Bu doküman: mimari, AI chatbox, AI özel ölçü / virtual try-on, ayarlar (admin'den kontrol), env.

---

## 1. Neden ayrı servis?

| Sebep | Açıklama |
|---|---|
| **İzolasyon** | AI/görsel iş yükü (uzun süren istekler, büyük görseller) ana API'yi bloklamaz. |
| **Bağımsız ölçek** | AI servisi ayrı sunucuda/ölçekte çalışır; çökse bile sipariş/ödeme ayakta kalır. |
| **Maliyet & güvenlik** | Gemini API key tek yerde (AI servisinde) tutulur; ana backend ve frontend görmez. |
| **Esneklik** | İleride model/sağlayıcı değişse (Gemini→başka) ana backend'e dokunmadan değişir. |

**Teknoloji önerisi:** AI servisi **Node.js (NestJS veya Fastify)** ya da **Python (FastAPI)**. Görsel/AI ekosistemi için **Python (FastAPI)** daha rahat (pillow, vb.), ama tek dil tutmak istersen Node da olur. Karar açık (aşağıda).

```
┌────────────┐    REST + servis-token    ┌─────────────────┐    API key    ┌──────────┐
│ NestJS API │ ────────────────────────► │   AI Servisi     │ ───────────► │  Gemini  │
│ (ana)      │ ◄──── sonuç / stream ──────│ (ayrı backend)   │              │  API     │
└────────────┘                            └─────────────────┘              └──────────┘
        │ ai modülü (proxy)                        │ ayarlar DB'den okunur (ana backend Settings)
        ▼                                          ▼
   Postgres (ai_settings, ai_conversations)   R2 (try-on çıktı görselleri)
```

Ana backend'te ince bir **`ai` modülü** (proxy): kullanıcı isteğini doğrular (JWT + tenant + kota), servis-token ile AI servisine iletir, sonucu döner. Gerçek AI işi ayrı serviste.

---

## 2. AI Chatbox

Müşteriye (bayiye) yardımcı asistan. Kullanıcının kendi verisi bağlamında çalışır (tenant-izole).

**Ne yapar:**
- **Sipariş asistanı:** "Siparişim ne durumda?", "X siparişinin kargo no?", "Son siparişimi tekrarla" → kullanıcının kendi siparişleri bağlamında yanıt.
- **Ürün & fiyat danışmanı:** "40×60 inch wallpaper kaç para?", "Wood ile Decal farkı ne?" → katalog + fiyat motoru bağlamı.
- **Dosya/ölçü yardımı:** "Hangi formatta dosya yükleyeyim?", "DPI yetersiz mi?" → kurallar + (varsa) yüklenen dosyanın kontrol sonucu.
- **SSS / onboarding:** üyelik, %40 indirim, $30 aidat, Etsy mağaza bağlama nasıl yapılır.
- **(opsiyonel) Aksiyon:** "tool calling" ile sınırlı aksiyonlar (sipariş durumu çekme, fiyat teklifi alma) — yazma aksiyonları onay ister.

**Teknik:**
- **Streaming** yanıt (SSE) — yazarken akış.
- **Konuşma geçmişi** kalıcı (`ai_conversations`, `ai_messages`) — tenant + kullanıcı bazlı.
- **Bağlam (context):** kullanıcının siparişleri/bakiyesi/profili **AI servisine güvenli özet** olarak verilir (ham PII değil, maskeli).
- **Prompt injection koruması:** kullanıcı mesajı sistem promptundan ayrı; araç çıktıları sınırlı.

---

## 3. AI ile Özel Ölçü / Virtual Try-On (Gemini)

> "Bir ara yaptığımız virtual try-on" mantığı: müşteri duvar fotoğrafını yükler → AI duvara wallpaper'ı **giydirir** (önizleme) ve/veya **ölçü tahmini** yapar.

**İki yetenek:**

### 3.1 Virtual Try-On (duvara giydirme önizleme)
1. Müşteri **duvar fotoğrafı** + seçtiği **desen/tasarım** yükler.
2. AI servisi Gemini görsel modeline (görsel düzenleme/birleştirme — ör. *Gemini image / "Nano Banana" sınıfı model*) gönderir: "bu duvara bu deseni perspektif/ışık uyumlu uygula".
3. Çıktı önizleme görseli **R2'ye** yazılır, kullanıcıya gösterilir.
4. Bu **satın alma öncesi önizleme** — üretim dosyası değil (kalite/ölçü ayrı).

### 3.2 AI Özel Ölçü Tahmini
1. Müşteri duvar fotoğrafı (+ varsa referans nesne: kapı/priz/cetvel) yükler.
2. Gemini vision ile **yaklaşık ölçü tahmini** (genişlik×yükseklik) → kullanıcıya "tahmini ~Xinch × Yinch, onaylıyor musun?" der.
3. Kullanıcı onaylar/düzeltir → sipariş ölçüsüne **öneri** olarak geçer (kesin ölçü sorumluluğu kullanıcıda — yasal/üretim notu).

**Önemli notlar:**
- Gemini görsel modeli **önizleme/tahmin** için; **baskı üretim dosyası DEĞİL** (baskı için gerçek yüksek çöz. dosya + sharp/DPI kontrolü).
- Ölçü tahmini "öneri"dir; yanlış baskı sorumluluğu için net uyarı + kullanıcı onayı şart.
- Görsel işler **kuyruğa** (BullMQ) alınır — uzun sürebilir, HTTP'yi bloklamaz; bitince bildirim.
- Maliyet: Gemini görsel çağrıları token/görsel başına ücretli → **kota & maliyet limiti** (aşağıda ayarlar).

---

## 4. Ayarlar (admin'den kontrol) — "ne olabilir"

AI özellikleri **ana backend'te bir `Settings`/`AiSettings` modeli** ile yönetilir, AI servisi bunları okur. Olası ayarlar:

**Genel / sağlayıcı**
- AI servisi **açık/kapalı** (master switch)
- **Sağlayıcı** seçimi (Gemini / ileride alternatif) + **model** adı
- **API key** (env'de, admin görmez; sadece "tanımlı mı" durumu)
- **Maliyet limiti** (aylık $ tavanı) + limit aşılınca davranış (kapat/uyar)
- **Rate-limit** (kullanıcı başına günlük istek)

**Chatbox**
- Chatbox **açık/kapalı**
- **Karşılama mesajı** + **sistem promptu** (admin düzenler)
- **Dil** (TR/EN/oto)
- Hangi **tenant/rol** için açık (ör. sadece Ekip Üyesi+)
- Aksiyon (tool) izinleri: salt-okuma mı, sınırlı yazma mı

**Virtual try-on / ölçü**
- Try-on **açık/kapalı**, ölçü tahmini **açık/kapalı**
- Kullanıcı başına **aylık ücretsiz hak** (sonra kredi/bakiyeden düş?)
- Çıktı görsel **saklama süresi** (R2 lifecycle)
- Kalite/çözünürlük profili

**Görsel kalite kontrol (opsiyonel)**
- AI flag açık/kapalı; eşik değerler (DPI uyarı altı vb.)

> Tüm bu ayarlar **per-tenant override** edilebilir (bir tenant'a try-on açık, diğerine kapalı gibi) — multi-tenant ile uyumlu.

---

## 5. Ana backend ↔ AI servisi entegrasyonu

- Ana backend'te **`ai` modülü**: `POST /api/ai/chat` (stream), `POST /api/ai/tryon`, `POST /api/ai/measure`, `GET /api/ai/conversations`.
- Bu endpoint'ler: JWT + tenant + kota kontrolü yapar, sonra **servis-token** ile AI servisinin internal API'sine proxy'ler.
- **Servis-servis auth:** paylaşılan secret / mTLS / imzalı token (env'de).
- AI servisi **Gemini key'ini** ana backend'e/clienta asla sızdırmaz.
- Sonuçlar (chat geçmişi, try-on görsel referansı) Postgres + R2'de.

---

## 6. Env / dağıtım (dev & prod ayrı sunucu)

- **Dev:** AI servisi lokalde (ör. `localhost:4001`), ana backend `.env.development` içinde `AI_SERVICE_URL=http://localhost:4001`, `AI_SERVICE_TOKEN=...`, Gemini key dev kota.
- **Prod:** AI servisi **ayrı sunucuda** (gerekirse GPU'lu); ana backend `.env.production` içinde `AI_SERVICE_URL=https://ai.ortakdoku.com`, prod servis-token, prod Gemini key.
- Gemini **API key yalnızca AI servisinin env'inde** (ana backend'te değil).

---

## 7. Orkestrasyon & teknoloji (LangGraph / LangChain / Supabase / Edge)

> Soru: "AI servisinde LangGraph, LangChain, Supabase, Node Edge gibi şeyler de girer mi?"

| Teknoloji | Bu projede? | Açıklama |
|---|---|---|
| **LangGraph** | ✅ **Chatbox agent için öneri** | Durum makineli (stateful) agent grafiği: tool node'ları (sipariş durumu çek, fiyat teklifi al), human-in-the-loop onay, konuşma hafızası, **guardrail node'ları**. Çok adımlı asistan için en uygun; Python'da olgun. |
| **LangChain** | ⚪ Opsiyonel | RAG zinciri, araç/sağlayıcı soyutlamaları, çoklu model. LangGraph zaten bu ekosistemde. Basit chatbox için şart değil; RAG/çoklu entegrasyon gelince faydalı. |
| **Doğrudan Gemini SDK** | ✅ Görsel için | Virtual try-on / ölçü (görsel üretim) **doğrudan Gemini SDK** ile yapılır — LangGraph görsel-üretim için gerekmez. Tek-tur sorularda da en basit yol. |
| **Supabase** | ❌ Gerekmez | Ana backend zaten kendi Postgres'ine sahip; AI servisi durumunu ana backend API'si veya kendi tablosunda tutar. Supabase ancak hızlı managed Postgres + realtime istenirse opsiyon — mevcut Hetzner+Postgres yığınına 4. vendor eklemeye gerek yok. |
| **Node Edge / Edge Functions** | ❌ AI için uygun değil | AI ağır işler (görsel üretim, uzun LLM çağrıları, kuyruk) edge'in süre/bellek limitlerine sığmaz. AI servisi **normal uzun-ömürlü FastAPI** sunucusu olmalı. Edge yalnızca frontend'de hafif API route'ları için (kapsam dışı). |

**Önerilen mimari:** Chatbox = **LangGraph agent** (tool + guardrail + hafıza), görsel (try-on/ölçü) = **doğrudan Gemini SDK + BullMQ/kuyruk**. İkisi aynı **Python/FastAPI** serviste, modüler. RAG gerekince LangChain eklenir.

---

## 8. Halüsinasyon Önleme (Guardrails) — kritik

B2B'de yanlış bilgi (yanlış sipariş durumu, uydurma fiyat) pahalıya patlar. Önlemler:

- **Olgular tool ile çekilir, model üretmez:** sipariş durumu / fiyat / bakiye / kargo no → **tool çağrısıyla** gerçek backend'den. Model bunları asla "tahmin" etmez. (örn. "siparişim nerede?" → `getOrder` tool → gerçek veri.)
- **Grounding / RAG:** yanıtlar yalnızca verilen bağlamdan (kullanıcının siparişleri, katalog, SSS). Bağlam dışı soruya **"bilmiyorum / ilgili değil"** der, uydurmaz.
- **Yapılandırılmış çıktı + doğrulama:** kararlar (DPI uyarısı, ölçü tahmini) **JSON şema** ile döner, backend doğrular; serbest metinle aksiyon alınmaz.
- **AI karar değil "flag":** kalite/ölçü için AI **öneri/uyarı** üretir, **insan onayı şart**.
- **Ölçü tahmini asla kesin değil:** kullanıcı onaylar/düzeltir; sorumluluk kullanıcıda (net uyarı).
- **Düşük sıcaklık + sıkı sistem promptu:** "yalnızca verilen veriden cevap ver; emin değilsen söyle; uydurma".
- **Kaynak gösterme:** yanıtın dayandığı sipariş/kayıt referansını ekle.
- **İkinci geçiş / self-check (LangGraph guardrail node):** kritik yanıtlarda doğrulama adımı.
- **Prompt injection koruması:** kullanıcı mesajı ≠ sistem talimatı; tool çıktıları sınırlı; **yazma aksiyonları onaylı**.
- **Maliyet/limit + denetim logu:** her yanıt loglanır; maliyet tavanı (bkz. ayarlar §4).

---

## 9. Açık sorular
- AI servisi dili: **Python (FastAPI)** mı, **Node (NestJS)** mı? (Görsel için Python rahat; tek dil için Node.)
- Try-on/ölçü **ücretlendirme:** ücretsiz mi, kredi/bakiyeden mi düşülsün?
- Gemini görsel modeli adı/sürümü kullanım anında teyit edilecek (model isimleri değişebilir).
- Chatbox aksiyonları: sadece okuma mı, yoksa "sipariş oluştur" gibi yazma da mı?
