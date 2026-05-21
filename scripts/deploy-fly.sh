#!/usr/bin/env bash
# Deploy api + web to Fly (same as CI deploy job).
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="${NEXT_PUBLIC_API_URL:-https://construct-api.fly.dev}"

echo "==> construct-api"
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile \
  -a construct-api --remote-only

echo "==> construct-web (NEXT_PUBLIC_API_URL=$API_URL)"
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile \
  -a construct-web --remote-only \
  --build-arg "NEXT_PUBLIC_API_URL=$API_URL"

echo "==> smoke"
curl -sf "https://construct-api.fly.dev/healthz" | head -c 200
echo ""
curl -sf -o /dev/null -w "construct-web HTTP %{http_code}\n" "https://construct-web.fly.dev/"
