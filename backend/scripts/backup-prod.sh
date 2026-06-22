#!/usr/bin/env bash
# Ortak Doku (printy) — PROD mantıksal yedek (yönetilen Postgres → gzip → R2).
# Yönetilen PG zaten otomatik yedek sunar; bu, kendi ek kopyandır.
# Gereksinim: postgresql-client (pg_dump) + awscli, .env.production dolu.
# Cron örneği (her gün 03:00 UTC):
#   0 3 * * * cd /home/deploy/printy/backend && bash scripts/backup-prod.sh >> /home/deploy/backup.log 2>&1
set -euo pipefail

# .env.production'dan DATABASE_URL + R2 değişkenlerini yükle
ENV_FILE="${ENV_FILE:-.env.production}"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

: "${DATABASE_URL:?DATABASE_URL gerekli (.env.production)}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
mkdir -p "$BACKUP_DIR"
TS=$(date -u +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/printy_prod_${TS}.sql.gz"

echo "Yedek alınıyor → $OUT"
# pg_dump bağlantı dizesini doğrudan kullanır (sslmode=require dahil)
pg_dump "$DATABASE_URL" | gzip > "$OUT"
echo "Tamam: $(du -h "$OUT" | cut -f1)"

# R2'ye yükle (S3 uyumlu). R2_ENDPOINT + R2_BUCKET + AWS_* kimlikleri gerekir.
if [[ -n "${R2_ENDPOINT:-}" && -n "${R2_BUCKET:-}" ]]; then
  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}" \
  AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}" \
  aws s3 cp "$OUT" "s3://$R2_BUCKET/backups/$(basename "$OUT")" \
    --endpoint-url "$R2_ENDPOINT"
  echo "R2'ye yüklendi: s3://$R2_BUCKET/backups/$(basename "$OUT")"
else
  echo "R2 ayarları yok — sadece lokal yedek alındı."
fi

# Lokal retention
find "$BACKUP_DIR" -name 'printy_prod_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
echo "Eski lokal yedekler temizlendi (> ${RETENTION_DAYS} gün)"
