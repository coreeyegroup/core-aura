#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
destination=${1:?Usage: bash ops/backup-backend.sh BACKUP_DIRECTORY}
mkdir -p "$destination"
umask 077
backup="$destination/core-aura-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T database pg_dump -U core_aura -Fc core_aura > "$backup"
docker compose exec -T database pg_restore --list < "$backup" >/dev/null
echo "Verified database archive: $backup"
