# Sunucu / Prod Kurulum Runbook — Ortak Doku (printy)

> Onaylanan mimari (2026-06-22):
> **Backend:** systemd service (native Node 20) · **DB+Redis:** yönetilen (managed) servis ·
> **Reverse proxy:** nginx + certbot · **Deploy:** GitHub Actions (otomatik).
>
> Bu doküman prod sunucu işlemlerinin **uçtan uca runbook**'udur. Sıradaki dosyalarla birlikte gelir:
> `backend/deploy/printy-backend.service`, `backend/deploy/nginx/ortakdoku.conf`,
> `backend/deploy/deploy.sh`, `backend/scripts/backup-prod.sh`, `.github/workflows/deploy.yml`.

---

## 0. Topoloji

```
                  Cloudflare DNS + R2 (dosya storage)
                            │
       ┌────────────────────┼─────────────────────┐
 api.ortakdoku.com   app.ortakdoku.com     *.ortakdoku.com (tenant)
       │                    │                      │
 ┌─────▼────────────────────────────────────────────────┐
 │  Hetzner Cloud — Ubuntu 24.04 LTS (US)                 │
 │   nginx (80/443) + certbot TLS                         │
 │      ├─ api.*  → 127.0.0.1:3001  (NestJS, systemd)     │
 │      └─ app.* / *.*  → 127.0.0.1:3000 (Next.js, sonra) │
 └───────────────────────────────────────────────────────┘
          │ (TLS, dışarıdaki yönetilen servisler)
   ┌──────▼─────────┐        ┌──────────────────┐
   │ Managed Postgres│        │  Managed Redis   │
   │ (Neon/RDS/...)  │        │ (Upstash/Redis Cloud)
   └─────────────────┘        └──────────────────┘

Büyük TIFF dosyaları sunucuya UĞRAMAZ → tarayıcı doğrudan R2'ye presigned upload.
```

**Önemli:** Prod sunucusunda **Postgres/Redis Docker'ı YOK** (yönetilen servis seçildi). `backend/docker-compose.yml` yalnızca **dev** içindir. Prod kutusunda sadece **nginx + Node (systemd)** çalışır.

---

## 1. Sunucu sağlama (Hetzner Cloud)

1. **Sunucu oluştur:** Ubuntu 24.04 LTS, başlangıç **CPX31** (4 vCPU / 8 GB / 160 GB NVMe). Lokasyon: ABD (Ashburn/Hillsboro). Büyük dosyalar R2'ye gittiği için RAM darboğaz değil; yük artarsa dikey büyüt.
2. **Hetzner Cloud Firewall** (panelden) — gelen trafikte yalnız:
   - `22/tcp` SSH → **sadece kendi IP'inden** (yönetim)
   - `80/tcp`, `443/tcp` → herkese (web)
   - Diğer her şey **kapalı**. (DB/Redis yönetilen olduğu için içeri port açmaya gerek yok.)
3. **DNS (Cloudflare):**
   - `A  api  → SUNUCU_IP`
   - `A  app  → SUNUCU_IP`  (frontend — sonra)
   - `A  *    → SUNUCU_IP`  (tenant subdomain'leri — wildcard)
   - Proxy (turuncu bulut) başta **kapalı (DNS only)** tut → certbot doğrulaması kolay olsun; sertifika oturunca açabilirsin.

---

## 2. Sunucu sıkılaştırma (ilk SSH)

`root` ile bağlanıp deploy kullanıcısı + temel sıkılaştırma:

```bash
# root olarak
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
# yerel makinenden public key'i ekle:
echo "ssh-ed25519 AAAA... senin-public-key" >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# SSH sertleştir: /etc/ssh/sshd_config içinde
#   PasswordAuthentication no
#   PermitRootLogin no
systemctl restart ssh

# Temel güvenlik
apt update && apt -y upgrade
apt -y install ufw fail2ban unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades     # otomatik güvenlik yamaları
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# Swap (8GB RAM için 2GB swap güvenlik yastığı)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Bundan sonra **`deploy` kullanıcısı** ile çalış (`ssh deploy@SUNUCU_IP`).

---

## 3. Çalışma ortamı (Node 20 + araçlar)

```bash
# deploy olarak (sudo ile)
# Node 20 (NodeSource) → /usr/bin/node
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs git nginx postgresql-client awscli
node -v   # v20.x
```

- `postgresql-client` → mantıksal yedek (`pg_dump`) için.
- `awscli` → yedeği R2'ye yüklemek için (R2 = S3 uyumlu).

---

## 4. Yönetilen DB + Redis

### 4.1 Postgres (yönetilen)
- Sağlayıcı: **Neon** / **AWS RDS** / **DigitalOcean Managed PG** (Postgres 16). ABD bölgesi seç (sunucuya yakın → düşük gecikme).
- Bağlantıyı al, `.env.production` içine **SSL zorunlu**:
  ```
  DATABASE_URL=postgresql://USER:PASS@HOST:5432/printy?schema=public&sslmode=require
  ```
- Migration'lar buraya `prisma migrate deploy` ile uygulanır (aşağıda deploy).

### 4.2 Redis (yönetilen) — BullMQ + cache
- Sağlayıcı: **Upstash** veya **Redis Cloud**. **TLS zorunlu** → `rediss://`:
  ```
  REDIS_URL=rediss://default:PASS@HOST:PORT
  ```
- ⚠️ **BullMQ şartı:** eviction politikası **`noeviction`** olmalı (Upstash/Redis Cloud panelinden ayarla). Aksi halde kuyruk job'ları silinebilir.
- Kod tarafı hazır: `app.module.ts` BullMQ bağlantısı `rediss://` → TLS + parola + `maxRetriesPerRequest:null` otomatik uygular. Cache (`cache-manager-redis-yet`) tam URL'i kullandığı için TLS/parolayı kendi çözer.

---

## 5. Kodu sunucuya alma + .env.production

```bash
# deploy olarak
cd /home/deploy
git clone https://github.com/metinemredonmez/printly.git printy
cd printy/backend

# Prod env'i gerçek değerlerle doldur (git'e GİTMEZ)
cp .env.example .env.production
nano .env.production
#   - DATABASE_URL   (yönetilen PG, sslmode=require)
#   - REDIS_URL      (yönetilen Redis, rediss://)
#   - JWT_SECRET     → openssl rand -hex 32
#   - ENCRYPTION_KEY → openssl rand -hex 32   (64 hex; PII/2FA şifreleme)
#   - R2_*           (prod bucket: ortakdoku-files)
#   - SMTP_*         (SendGrid/Mailgun/Postmark)
#   - ONESIGNAL_*    (Ortak Doku kendi app'i)
#   - CORS_ORIGINS=https://app.ortakdoku.com
```

İlk build + migration + seed (yalnız ilk kurulumda seed):
```bash
npm ci --include=dev
npm run prisma:generate
npm run build
npm run prisma:deploy        # = dotenv -e .env.production -- prisma migrate deploy
# (opsiyonel, ilk kurulum) admin/katalog seed'i prod'a:
# dotenv -e .env.production -- ts-node prisma/seed.ts
```

---

## 6. systemd service

`backend/deploy/printy-backend.service` dosyasını sisteme kur:

```bash
sudo cp /home/deploy/printy/backend/deploy/printy-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now printy-backend
sudo systemctl status printy-backend        # active (running) olmalı
journalctl -u printy-backend -f             # canlı log
```

Deploy'un servisi parolasız yeniden başlatabilmesi için **sudoers** kuralı:
```bash
echo 'deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart printy-backend, /bin/systemctl status printy-backend' | sudo tee /etc/sudoers.d/printy-deploy
sudo chmod 440 /etc/sudoers.d/printy-deploy
```

> Servis `NODE_ENV=production` ile çalışır → ConfigModule `.env.production`'ı `WorkingDirectory` (backend) içinden okur. Ayrı `EnvironmentFile` gerekmez.

---

## 7. nginx + certbot (TLS)

```bash
sudo cp /home/deploy/printy/backend/deploy/nginx/ortakdoku.conf /etc/nginx/sites-available/ortakdoku.conf
sudo ln -sf /etc/nginx/sites-available/ortakdoku.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Tekil domain sertifikaları (api + app) — nginx eklentisi otomatik yeniler
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d api.ortakdoku.com -d app.ortakdoku.com

# Wildcard (tenant subdomain *.ortakdoku.com) → DNS-01 (Cloudflare gerekir)
sudo apt -y install python3-certbot-dns-cloudflare
# /etc/letsencrypt/cloudflare.ini içine Cloudflare API token (Zone:DNS:Edit), chmod 600
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d '*.ortakdoku.com' -d ortakdoku.com
# Otomatik yenileme zaten certbot.timer ile aktif; test:
sudo certbot renew --dry-run
```

> Wildcard sertifika alındıktan sonra nginx conf'taki `*.ortakdoku.com` server bloğunun `ssl_certificate` yolunu `/etc/letsencrypt/live/ortakdoku.com/` olarak ayarla ve `nginx -t && systemctl reload nginx`.

---

## 8. Otomatik deploy (GitHub Actions)

`.github/workflows/deploy.yml` → `main`'e push'ta (backend değişikliği) sunucuya SSH'leyip `deploy.sh` çalıştırır.

**GitHub repo → Settings → Secrets and variables → Actions** altına ekle:
| Secret | Değer |
|---|---|
| `SSH_HOST` | Sunucu IP |
| `SSH_USER` | `deploy` |
| `SSH_KEY`  | deploy kullanıcısının **private** SSH anahtarı (yeni bir deploy-key üret) |
| `SSH_PORT` | `22` (opsiyonel) |

> ⚠️ Repo **PUBLIC**. GitHub Actions secret'ları public repo'da da gizlidir ve **fork'tan gelen PR'lara açılmaz**; workflow yalnız `metinemredonmez/printly`'nin kendi `main` push'unda çalışır (`if: github.repository == ...` koruması var). Yine de deploy anahtarını **bu sunucuya özel, dar yetkili** üret (root değil, `deploy`).

Akış: push → Actions → `ssh deploy@host` → `deploy.sh` (git pull → npm ci → build → migrate deploy → `systemctl restart`).

---

## 9. Yedekleme

- **Yönetilen PG** zaten otomatik yedek/PITR sunar (sağlayıcı panelinden retention'ı kontrol et).
- **Ek mantıksal yedek** (kendi kopyan, R2'ye): `backend/scripts/backup-prod.sh` — `pg_dump` (DATABASE_URL) → gzip → R2. Cron:
  ```bash
  crontab -e
  # her gün 03:00 (UTC) prod yedek
  0 3 * * * cd /home/deploy/printy/backend && bash scripts/backup-prod.sh >> /home/deploy/backup.log 2>&1
  ```
- **R2 dosyaları** zaten dayanıklı (Cloudflare); ayrıca bucket'ta versioning/lifecycle aç.

---

## 10. İzleme & sağlık

- Sağlık ucu: `GET https://api.ortakdoku.com/health` (mevcut `HealthController`). UptimeRobot/BetterStack ile dakikalık ping.
- Loglar: `journalctl -u printy-backend` (systemd → journald, otomatik rotation).
- Rate-limit + global exception filter zaten aktif (prod'da stack gizli).
- (Opsiyonel) Sentry DSN → hata izleme.
- Kuyruk izleme: Bull Board `/admin/queues` (görev #22 — admin-only).

---

## 11. AI servisi (sonra — ayrı)

Ayrı **Python/FastAPI** servisi olacak (chatbox + virtual try-on/ölçü, Gemini). Ayrı systemd unit + `ai.ortakdoku.com` nginx bloğu + kendi env'i (Gemini key **sadece** orada). Şimdilik park (`AI-SERVIS.md`).

---

## Hızlı komut özeti
| İş | Komut |
|---|---|
| Servis durumu | `sudo systemctl status printy-backend` |
| Canlı log | `journalctl -u printy-backend -f` |
| Elle deploy | `bash /home/deploy/printy/backend/deploy/deploy.sh` |
| Migration (prod) | `npm run prisma:deploy` |
| Yedek (elle) | `bash scripts/backup-prod.sh` |
| nginx reload | `sudo nginx -t && sudo systemctl reload nginx` |
| Sertifika yenileme testi | `sudo certbot renew --dry-run` |
