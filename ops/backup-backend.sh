#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
destination=${1:?Usage: bash ops/backup-backend.sh BACKUP_DIRECTORY}
umask 077
mkdir -p "$destination"
stamp=$(date -u +%Y%m%dT%H%M%S%NZ)
backup="$destination/core-aura-$stamp.dump"
audio="$destination/core-aura-$stamp-audio.tar.gz"
# Files are immutable and never deleted by the API. Taking the DB snapshot first
# ensures every referenced file exists when the subsequent audio archive is made.
docker compose exec -T database pg_dump -U core_aura -Fc core_aura > "$backup.partial"
docker compose exec -T database pg_restore --list < "$backup.partial" >/dev/null
docker compose exec -T api python scripts/archive-content.py > "$audio.partial"
python3 ops/verify-content-backup.py "$audio.partial"
mv "$backup.partial" "$backup"
mv "$audio.partial" "$audio"
sha256sum "$backup" "$audio" > "$destination/core-aura-$stamp.sha256"
echo "Verified backup pair: $backup and $audio"
