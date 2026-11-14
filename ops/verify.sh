#!/usr/bin/env bash
set -euo pipefail
origin=${CORE_AURA_URL:-https://core-aura.coreeye.in}
expected=${1:?Usage: bash ops/verify.sh VERSION}
health=$(curl -fsS --max-time 15 "$origin/health.json")
python3 -c 'import json,sys; h=json.load(sys.stdin); sys.exit(0 if h.get("status")=="ok" and h.get("version")==sys.argv[1] else "Unexpected health or version")' "$expected" <<< "$health"
echo "Verified Core-aura $expected at $origin"
