#!/usr/bin/env bash
set -euo pipefail
site=${CORE_AURA_CADDY_SITE:-/etc/caddy/sites/core-aura.caddy}
if [[ ! -f "$site" ]]; then
  echo "Core-aura site configuration is missing: $site" >&2
  exit 1
fi
backup=$(mktemp "${site}.backup.XXXXXXXX")
cp -p "$site" "$backup"
python3 - "$site" "${1:-}" <<'PY'
import os, pathlib, sys, tempfile
site = pathlib.Path(sys.argv[1])
text = site.read_text()
original = text
android_route = '''
    handle_path /android/* {
        root * /var/www/core-aura/android
        header Access-Control-Allow-Origin "*"
        header Cache-Control "no-store"
        @androidApk path *.apk
        header @androidApk Content-Type application/vnd.android.package-archive
        header @androidApk Content-Disposition attachment
        file_server
    }'''
if 'handle_path /android/*' not in text:
    text = text.replace('core-aura.coreeye.in {', 'core-aura.coreeye.in {' + android_route, 1)
marker = 'core-aura.coreeye.in {'
if text.count(marker) != 1:
    raise SystemExit('Expected one Core-aura site block; configuration was not changed')
if '@coreAuraPackFiles' not in text and '@packfiles' not in text:
    text = text.replace(marker, marker + '\n    @coreAuraPackFiles path /packs/*\n    header @coreAuraPackFiles Access-Control-Allow-Origin "*"', 1)
if sys.argv[2] == '--enable-api':
    for route in ['/api/*', '/packs/uploads/*']:
        if 'handle ' + route not in text:
            text = text.replace(marker, marker + '\n    handle ' + route + ' {\n        reverse_proxy 127.0.0.1:8793\n    }', 1)
elif sys.argv[2]:
    raise SystemExit('Usage: sudo bash ops/update-site.sh [--enable-api]')
if text != original:
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
echo "Core-aura routes and pack headers updated. Backup: $backup"
