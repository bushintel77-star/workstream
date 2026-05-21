# Deploying Workstream

Two Fly apps (Sydney), one Expo mobile app. Studio brand on quotes remains **Curtis & Co**; product infra uses **Workstream** names.

| App | Fly name (production today) | URL |
|-----|---------------------------|-----|
| API | `construct-api` | https://construct-api.fly.dev |
| Web | `construct-web` | https://construct-web.fly.dev |

Target names after cutover: `workstream-api` / `workstream-web` — see [CONSOLIDATION.md](CONSOLIDATION.md) and [PRODUCTION.md](PRODUCTION.md).

**Staging without Clerk:** both `fly.toml` files set `AUTH_REQUIRED=false`; web middleware bypasses Clerk until publishable + secret keys are present.

## Prerequisites

```bash
flyctl version
pnpm 9.15.4
node 22
```

## First-time API

```bash
flyctl launch --no-deploy --copy-config --config apps/api/fly.toml \
  --name workstream-api --region syd

flyctl volumes create workstream_data --region syd --size 1 -a workstream-api

flyctl secrets set \
  CORS_ORIGIN="https://workstream-web.fly.dev" \
  PUBLIC_API_URL="https://workstream-api.fly.dev" \
  WORKSTREAM_PORTAL_SECRET="$(openssl rand -hex 32)" \
  PORTAL_BASE_URL="https://workstream-web.fly.dev" \
  CLERK_SECRET_KEY="sk_live_…" \
  MAPBOX_TOKEN="pk.…" \
  OPENAI_API_KEY="sk-…" \
  ANTHROPIC_API_KEY="sk-ant-…" \
  VICMAP_ENABLED="true" \
  -a workstream-api

flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile -a workstream-api
flyctl scale count 1 -a workstream-api
```

## First-time Web

```bash
flyctl launch --no-deploy --copy-config --config apps/web/fly.toml \
  --name workstream-web --region syd

flyctl secrets set \
  CLERK_SECRET_KEY="sk_live_…" \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_…" \
  API_URL="https://workstream-api.fly.dev" \
  NEXT_PUBLIC_API_URL="https://workstream-api.fly.dev" \
  PORTAL_BASE_URL="https://workstream-web.fly.dev" \
  -a workstream-web

flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a workstream-web
```

## Mobile (EAS)

```bash
cd apps/mobile
eas build --platform ios --profile production
```

EAS env (production profile):

```
EXPO_PUBLIC_API_URL=https://workstream-api.fly.dev
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
EXPO_PUBLIC_AUTH_REQUIRED=true
```

Bundle ID: `com.curtisandco.workstream`

## CI

Push to `main` runs typecheck, tests, Docker builds, and deploys both Fly apps when `FLY_API_TOKEN` is set in GitHub secrets.

## Migrating from Construct Fly apps

1. `flyctl secrets list -a construct-api` → copy values to `workstream-api`.
2. Copy volume data or re-seed; attach new volume `workstream_data` on first deploy.
3. Point mobile/web env at `workstream-api.fly.dev`.
4. Retire `construct-*` apps when traffic is zero.
