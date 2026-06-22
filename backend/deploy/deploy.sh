#!/usr/bin/env bash
# Ortak Doku (printy) — prod deploy scripti.
# Sunucuda çalışır (GitHub Actions SSH ile tetikler veya elle).
#   bash /home/deploy/printy/backend/deploy/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/home/deploy/printy}"
BRANCH="${DEPLOY_BRANCH:-main}"

echo "▶ Kod güncelleniyor ($BRANCH)…"
cd "$APP_DIR"
git fetch --all --quiet
git reset --hard "origin/$BRANCH"

cd "$APP_DIR/backend"

echo "▶ Bağımlılıklar (npm ci, devDeps dahil — build için gerekli)…"
npm ci --include=dev

echo "▶ Prisma client üretiliyor…"
npm run prisma:generate

echo "▶ Build (nest)…"
npm run build

echo "▶ Migration uygulanıyor (prisma migrate deploy)…"
npm run prisma:deploy

echo "▶ Servis yeniden başlatılıyor…"
sudo systemctl restart printy-backend
sleep 2
sudo systemctl status printy-backend --no-pager | head -6

echo "✓ Deploy tamam: $(git rev-parse --short HEAD)"
