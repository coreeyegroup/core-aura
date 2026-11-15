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
docker compose up -d --build
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:8793/api/health; then
    printf '\nCatalog backend ready\n'
    exit 0
  fi
  sleep 2
done
echo "Backend health check failed. Inspect docker compose logs api." >&2
exit 1
