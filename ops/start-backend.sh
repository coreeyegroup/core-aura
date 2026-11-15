#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
  umask 077
  {
    printf 'CORE_AURA_DATABASE_PASSWORD=%s\n' "$(openssl rand -hex 24)"
    printf 'CORE_AURA_ADMIN_TOKEN=%s\n' "$(openssl rand -hex 32)"
  } > .env
fi
chmod 600 .env
docker compose build api
# Only the key-generation container can write this protected host file.
docker compose run --rm --no-deps --user 0 -v "$PWD/.env:/run/core-aura-env" api python scripts/generate-vapid.py /run/core-aura-env
docker compose up -d
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:8793/api/health &&
     curl -fsS --max-time 3 http://127.0.0.1:8793/api/manifest-reminders/config | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("ready") else 1)'; then
    printf '\nCatalog and reminder backend ready\n'
    exit 0
  fi
  sleep 2
done
echo "Backend health check failed. Inspect docker compose logs api." >&2
exit 1
