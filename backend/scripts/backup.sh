#!/usr/bin/env bash
# Postgres yedek (docker'daki printy-postgres üzerinden). Cron'a uygundur.
# Kullanım: bash scripts/backup.sh   (veya npm run db:backup)
# Cron örneği (her gün 03:00): 0 3 * * * cd /path/backend && bash scripts/backup.sh
# Geri yükleme: gunzip -c backups/printy_XXXX.sql.gz | docker exec -i printy-postgres psql -U printy -d printy
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
CONTAINER="${PG_CONTAINER:-printy-postgres}"
DB="${POSTGRES_DB:-printy}"
DB_USER="${POSTGRES_USER:-printy}"

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/printy_${TS}.sql.gz"

echo "Yedek alınıyor → $OUT"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB" | gzip > "$OUT"
echo "Tamam: $(du -h "$OUT" | cut -f1)"

# Retention: RETENTION_DAYS günden eski yedekleri sil
find "$BACKUP_DIR" -name 'printy_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
echo "Eski yedekler temizlendi (> ${RETENTION_DAYS} gün)"

# (Prod) İsteğe bağlı: yedeği R2'ye yükle (aws cli ile)
# aws s3 cp "$OUT" "s3://$R2_BUCKET/backups/" --endpoint-url "$R2_ENDPOINT"
