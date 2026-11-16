#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v java >/dev/null || ! command -v keytool >/dev/null; then
  if [[ ${EUID:-$(id -u)} != 0 ]]; then
    echo 'Run with sudo; Java 17 runtime and keytool are needed to sign Android releases.' >&2
    exit 1
  fi
  apt-get update -qq
  apt-get install -y openjdk-17-jre-headless
fi
root=${CORE_AURA_ROOT:-/var/www/core-aura}
install -d -m 755 "$root"
exec 9>"$root/.android-publish.lock"
flock 9
python3 ops/publish_android.py
