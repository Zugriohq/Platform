#!/usr/bin/env bash
# Logical backup of the private-alpha database to ZUGRIO_BACKUP_DIR (default /srv/zugrio/backups).
# Keeps the newest 14 dumps. R2 off-site copy is a placeholder until a bucket is approved.
set -euo pipefail
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a

backup_dir="${ZUGRIO_BACKUP_DIR:-/srv/zugrio/backups}"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$backup_dir/zugrio-${stamp}.dump"

docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-zugrio}" -d "${POSTGRES_DB:-zugrio}" --format=custom --no-owner \
  > "$target.partial"
mv "$target.partial" "$target"
chmod 600 "$target"
echo "backup written: $target"

ls -1t "$backup_dir"/zugrio-*.dump | tail -n +15 | xargs -r rm --

# R2 placeholder (not active): once an R2 bucket and scoped API token are approved, e.g.
#   rclone copy "$target" "r2:${ZUGRIO_R2_BACKUP_BUCKET}/postgres/"
