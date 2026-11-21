#!/usr/bin/env bash
set -euo pipefail
origin=${CORE_AURA_URL:-https://core-aura.coreeye.in}
expected=${1:?Usage: bash ops/verify.sh VERSION [--android]}
if [[ $# -gt 2 || ( $# -eq 2 && $2 != --android ) ]]; then
  echo "Usage: bash ops/verify.sh VERSION [--android]" >&2
  exit 2
fi
health=$(curl -fsS --max-time 15 "$origin/health.json")
python3 -c 'import json,sys; h=json.load(sys.stdin); sys.exit(0 if h.get("status")=="ok" and h.get("version")==sys.argv[1] else "Unexpected health or version")' "$expected" <<< "$health"
page=$(curl -fsS --max-time 15 "$origin/")
entry=$(python3 -c 'import re,sys; match=re.search(r"<script\b[^>]*\bsrc=\"(/assets/[A-Za-z0-9_.-]+\.js)\"", sys.stdin.read()); print(match[1] if match else ""); sys.exit(0 if match else "App entry script is missing")' <<< "$page")
curl -fsS --max-time 20 "$origin$entry" -o /dev/null
echo "Verified Core-aura $expected and app entry at $origin"
if [[ ${2:-} == --android ]]; then
  manifest=$(curl -fsS --max-time 15 "$origin/android/latest.json")
  url=$(python3 -c '
import json,re,sys
origin, expected = sys.argv[1:]
m = json.load(sys.stdin)
sha = m.get("sha256")
version = m.get("versionName") or "unpublished"
if version != expected:
    sys.exit(f"Android channel is {version}; expected {expected}")
if (m.get("schemaVersion") != 1 or m.get("applicationId") != "in.coreeye.coreaura"
    or not isinstance(sha,str) or not re.fullmatch(r"[0-9a-f]{64}", sha)
    or m.get("url") != f"{origin}/android/releases/{sha}/core-aura-{version}.apk"):
    sys.exit("Android channel contains invalid APK metadata")
print(m["url"])
' "$origin" "$expected" <<< "$manifest")
  headers=$(curl -fsSI --max-time 20 "$url")
  python3 -c '
import json,sys
m = json.loads(sys.argv[1])
headers = {}
for line in sys.stdin:
    if ":" in line:
        key, value = line.split(":", 1)
        headers[key.lower()] = value.strip()
if (headers.get("content-type","").split(";")[0] != "application/vnd.android.package-archive"
    or headers.get("content-length") != str(m.get("size"))):
    sys.exit("Android download response does not match the declared APK type and size")
' "$manifest" <<< "$headers"
  checksum=$(curl -fsS --max-time 180 "$url" | sha256sum)
  declared=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["sha256"])' <<< "$manifest")
  if [[ ${checksum%% *} != "$declared" ]]; then
    echo "Android APK checksum does not match the release channel." >&2
    exit 1
  fi
  echo "Verified Android $expected channel and APK SHA-256"
fi
