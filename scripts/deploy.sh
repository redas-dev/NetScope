#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
commit="${1:-}"
if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Usage: bash scripts/deploy.sh <full Git commit SHA>' >&2
  exit 1
fi
if [[ ! -f .env.production ]]; then
  echo 'Create .env.production first; see docs/deployment.md.' >&2
  exit 1
fi
mkdir -p .local backups
chmod 700 backups
exec 9>.local/deploy.lock
flock -n 9 || { echo 'Another deployment is already running.' >&2; exit 1; }

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo 'Tracked server files have local edits. Commit or resolve them before deploying.' >&2
  exit 1
fi
git fetch origin main
git cat-file -e "${commit}^{commit}"
git merge-base --is-ancestor "$commit" FETCH_HEAD || {
  echo 'Requested commit is not on origin/main.' >&2; exit 1;
}
if [[ "$(git rev-parse FETCH_HEAD)" != "$commit" ]]; then
  echo 'A newer commit is already on main; its successful workflow will deploy it.'
  exit 0
fi
previous="$(git rev-parse HEAD)"
git checkout --detach "$commit"
export APP_VERSION="$commit"
compose=(docker compose --env-file .env.production -f compose.production.yaml)
"${compose[@]}" config --quiet

# Build before replacing the running API. No image pruning: older images help recovery.
"${compose[@]}" build api
"${compose[@]}" up -d --wait --wait-timeout 90 db

# Back up before the API starts and applies migrations. Keep backups outside Git.
umask 077
backup="backups/$(date -u +%Y%m%dT%H%M%SZ)-${commit:0:12}.dump"
"${compose[@]}" exec -T db pg_dump -U netscope -d netscope -Fc > "$backup"
# Remove the former proxy container when upgrading from the Caddy composition.
# Host Nginx keeps running while the API container is replaced.
"${compose[@]}" up -d --no-build --remove-orphans api

for attempt in {1..60}; do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:5220/health >/dev/null; then
    printf '%s\n' "$commit" > .local/deployed-commit
    echo "Deployment healthy: $commit (previous checkout: $previous)"
    echo "Pre-migration database backup: $backup"
    exit 0
  fi
  sleep 2
done
echo "Deployment did not become healthy. Inspect docker compose logs. Previous checkout: $previous; backup: $backup" >&2
"${compose[@]}" logs --tail=80 api >&2
# A database migration may have run; rolling back the image blindly is unsafe.
exit 1
