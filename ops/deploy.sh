#!/usr/bin/env bash
set -euo pipefail
ref=${1:?Usage: sudo bash ops/deploy.sh COMMIT_OR_TAG}
root=${CORE_AURA_ROOT:-/var/www/core-aura}
git_repo() { git -c safe.directory="$PWD" "$@"; }
commit=$(git_repo rev-parse --verify --end-of-options "$ref^{commit}")
install -d -m 755 "$root/releases"
exec 9>"$root/.deploy.lock"
flock 9
stage=$(mktemp -d "$root/.stage.XXXXXXXX")
trap 'rm -rf -- "$stage"' EXIT
if [[ ! -d "$root/releases/$commit" ]]; then
  if git_repo cat-file -e "$commit:package.json" 2>/dev/null; then
    mkdir "$stage/source"
    git_repo archive "$commit" | tar -x -C "$stage/source"
    (
      cd "$stage/source"
      npm ci --ignore-scripts --no-audit --no-fund
      npm run build
    )
    mv "$stage/source/dist" "$stage/site"
  else
    mkdir "$stage/site"
    git_repo archive "$commit:web" | tar -x -C "$stage/site"
  fi
  for asset in index.html health.json sw.js app.webmanifest icon-192.png icon-512.png; do
    test -s "$stage/site/$asset"
  done
  chmod -R a+rX "$stage/site"
  mv "$stage/site" "$root/releases/$commit"
fi
ln -s "releases/$commit" "$stage/current"
mv -Tf "$stage/current" "$root/current"
echo "Active Core-aura commit: $commit"
