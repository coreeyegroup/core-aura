#!/usr/bin/env bash
set -euo pipefail
site=/etc/caddy/sites/core-aura.caddy
if [[ ! -f "$site" ]]; then
  echo "Core-aura site configuration is missing: $site" >&2
  exit 1
fi
backup=$(mktemp /etc/caddy/sites/core-aura.caddy.backup.XXXXXXXX)
cp -p "$site" "$backup"
python3 - "$site" <<'PY'
import os, pathlib, sys, tempfile
site = pathlib.Path(sys.argv[1])
text = site.read_text()
if 'Access-Control-Allow-Origin' not in text:
    marker = 'core-aura.coreeye.in {'
    if text.count(marker) != 1:
        raise SystemExit('Expected one Core-aura site block; configuration was not changed')
    text = text.replace(marker, marker + '\n    @coreAuraPackFiles path /packs/*\n    header @coreAuraPackFiles Access-Control-Allow-Origin "*"', 1)
    fd, path = tempfile.mkstemp(dir=site.parent, prefix='core-aura-caddy-')
    try:
        with os.fdopen(fd, 'w') as output:
            output.write(text)
        os.chmod(path, 0o644)
        os.replace(path, site)
    finally:
        if os.path.exists(path): os.unlink(path)
PY
if ! caddy validate --config /etc/caddy/Caddyfile; then
  cp -p "$backup" "$site"
  echo "Validation failed; the previous Core-aura site file was restored." >&2
  exit 1
fi
if ! systemctl reload caddy; then
  cp -p "$backup" "$site"
  systemctl reload caddy || true
  echo "Reload failed; the previous Core-aura site file was restored." >&2
  exit 1
fi
echo "Core-aura pack headers updated. Backup: $backup"
