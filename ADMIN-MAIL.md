# Admin İçeriden Mail (Internal Mailbox) — Tasarım

> Admin panel içinden e-posta **okuma + gönderme** (harici mail istemcisine gitmeden).
> Referans: `~/Desktop/uzman-fly-app` (Java/Spring'de yapılmıştı) — burada **NestJS + Prisma**'ya uyarlanıyor.
> Mevcut `nodemailer` (SMTP) zaten var; buna **IMAP (gelen kutusu)** + çoklu hesap + şablon eklenir.

---

## 1. Ne yapar?
- Admin, panelden **gelen kutusunu** görür, **mail gönderir/yanıtlar**.
- **Çoklu hesap:** `orders@ortakdoku.com`, `info@ortakdoku.com` gibi birden çok mail hesabı tanımlanır; her hesabın kendi SMTP/IMAP + şifreli parolası + imzası var.
- **Context'e bağlama:** bir mail bir **Sipariş** veya **Bayi (User)** ile ilişkilendirilir → sipariş detayından o siparişin mail yazışması görülür, oradan yanıtlanır.
- **Şablonlar:** sık kullanılan mailler (sipariş onayı, kargo bilgisi) hazır şablondan.
- **Thread:** `messageId`/`threadId`/`inReplyTo` ile yazışma zinciri.

> uzman-fly'daki domain'e özel parça (SaudiaMailParser — havayolu maili ayrıştırma) bize **gerekmez**; onun yerine ileride **Etsy bildirim maili ayrıştırma** benzer mantıkla eklenebilir (Faz 2+).

---

## 2. Veri modeli (Prisma)

```prisma
model MailAccount {
  id               String   @id @default(cuid())
  email            String   @unique
  passwordEncrypted String?  // AES-256-GCM ile şifreli (App Password)
  // SMTP (giden)
  smtpHost         String   @default("smtp.gmail.com")
  smtpPort         Int      @default(587)
  smtpStarttls     Boolean  @default(true)
  smtpSsl          Boolean  @default(false)
  // IMAP (gelen)
  imapHost         String   @default("imap.gmail.com")
  imapPort         Int      @default(993)
  imapSsl          Boolean  @default(true)
  imapFolder       String   @default("INBOX")
  // Kimlik
  fromName         String?
  signatureHtml    String?
  isDefault        Boolean  @default(false)
  isActive         Boolean  @default(true)
  lastTestedAt     DateTime?
  lastTestStatus   String?
  lastFetchAt      DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  messages         EmailMessage[]
}

model EmailMessage {
  id           String   @id @default(cuid())
  direction    MailDirection            // INBOUND | OUTBOUND
  status       MailStatus  @default(PENDING) // PENDING|SENT|FAILED|READ|UNREAD
  fromAddress  String
  toAddresses  String                    // virgül ayrılmış
  ccAddresses  String?
  bccAddresses String?
  replyTo      String?
  subject      String?
  bodyText     String?
  bodyHtml     String?
  messageId    String?
  threadId     String?
  inReplyTo    String?
  contextType  MailContext?              // ORDER | USER | TRANSACTION | GENERAL
  contextId    String?
  sentByUserId String?
  accountId    String?
  account      MailAccount? @relation(fields: [accountId], references: [id])
  sentAt       DateTime?
  receivedAt   DateTime?
  readAt       DateTime?
  errorMessage String?
  attachments  Json?                     // [{name,size,r2Key,mime}]
  createdAt    DateTime @default(now())

  @@index([direction, status])
  @@index([contextType, contextId])
  @@index([threadId])
}

model MailTemplate {
  id            String   @id @default(cuid())
  name          String
  subject       String
  body          String
  contextType   MailContext?
  description   String?
  isShared      Boolean  @default(false)
  createdByUserId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum MailDirection { INBOUND OUTBOUND }
enum MailStatus { PENDING SENT FAILED READ UNREAD }
enum MailContext { ORDER USER TRANSACTION GENERAL }
```

---

## 3. Endpoint'ler (NestJS, ADMIN rolü)

**Mailbox** (`/api/admin/mail`)
| Method | Path | Açıklama |
|---|---|---|
| POST | `/send` | Mail gönder (to/cc/bcc/subject/body/templateKey/accountId/context) |
| GET | `/inbox` | Gelen kutusu (sayfalı, hesap filtresi) |
| GET | `/sent` | Giden kutusu |
| GET | `/by-context?type=ORDER&id=...` | Bir siparişe/bayiye ait yazışma |
| GET | `/:id` | Tek mail |
| PATCH | `/:id/read` | Okundu işaretle |
| GET | `/stats/unread-count` | Okunmamış sayısı |
| DELETE | `/:id` | Sil |
| POST | `/refresh` | IMAP'tan yeni mailleri çek |

**Hesaplar** (`/api/admin/mail-accounts`): GET, GET/:id, POST, PUT/:id, DELETE/:id, POST/:id/set-default, POST/:id/test
**Şablonlar** (`/api/admin/mail-templates`): CRUD

---

## 4. Teknoloji (NestJS karşılıkları)

| İhtiyaç | uzman-fly (Java) | Ortak Doku (NestJS) |
|---|---|---|
| Gönderme (SMTP) | JavaMail | **nodemailer** (zaten var) |
| Gelen (IMAP) | JavaMail IMAP | **imapflow** + **mailparser** |
| Parola şifreleme | AES-GCM | **crypto** AES-256-GCM (anahtar env'den: `MAIL_ENC_KEY`) |
| Periyodik çekme | scheduler | **BullMQ** (Redis) cron job → her hesap için IMAP fetch |
| Ek dosyalar | jsonb | **R2**'ye yükle, metadata `attachments` JSON |
| Şablon değişkenleri | template | `{{orderNumber}}`, `{{clientName}}` vb. interpolasyon |

---

## 5. Güvenlik
- **ADMIN-only** (ileride STAFF/PRODUCTION'a alt yetki verilebilir — granüler permission ile).
- Parolalar **at-rest AES-256-GCM şifreli** (asla düz metin, API yanıtında dönmez).
- IMAP/SMTP **App Password** (Gmail) — 2FA'lı hesaplarda.
- Audit log (kim hangi maili gönderdi).
- Gelen mail HTML'i **sanitize** (XSS) edilerek gösterilir.

---

## 6. Faz / öncelik
- Admin operasyonu için değerli → **Faz 1.5 / Sprint 3** civarı (Settings + cache altyapısından sonra, multi-tenant ile birlikte değerlendir).
- Minimum sürüm: tek hesap + SMTP gönder + IMAP inbox + context'e bağlama. Çoklu hesap/şablon ikinci adım.

## 7. Açık sorular
- Kaç mail hesabı (Gmail Workspace mi, kendi SMTP mi)?
- Gelen kutusu **gerçek IMAP çekme** mi yoksa sadece **giden + sistem bildirimleri** mi yeterli (daha hafif)?
- Mail context'i sadece ORDER/USER mı, başka bağlam var mı?
