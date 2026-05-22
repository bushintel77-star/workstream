# Deploying Workstream

The repo deploys as two services:

| Surface | Where it runs | What you run |
| --- | --- | --- |
| `apps/api` (Fastify) | Fly.io, Sydney region | `flyctl deploy` |
| `apps/mobile` (Expo Router) | Expo / EAS Build | `eas build` / `eas submit` |

The contracts, db, domain, ui, and client packages have no deploy
target — they're consumed by the two apps at build time.

## Prerequisites

```bash
gh --version      # GitHub CLI, authed with repo + workflow scopes
flyctl version    # ≥ 0.4 for `--copy-config`
node --version    # ≥ 22
pnpm --version    # ≥ 9.15
```

You also need a Fly.io account on the `tgarbis@yahoo.com.au` org (or
update `app =` in `apps/api/fly.toml`).

## First-time API provision

```bash
# 1. Create the Fly app (no VMs yet)
flyctl launch \
  --no-deploy \
  --copy-config \
  --config apps/api/fly.toml \
  --name construct-api \
  --region syd

# 2. Create the persistent volume for data/store.json and data/outputs/
flyctl volumes create construct_data \
  --region syd \
  --size 1 \
  --config apps/api/fly.toml

# 3. Set the required + optional secrets
flyctl secrets set \
  CORS_ORIGIN="https://construct-web.fly.dev" \
  PUBLIC_API_URL="https://construct-api.fly.dev" \
  --config apps/api/fly.toml

# Optional — without these the API runs in dev-fallback mode
flyctl secrets set \
  CLERK_SECRET_KEY="sk_…" \
  MAPBOX_TOKEN="pk.…" \
  ANTHROPIC_API_KEY="sk-ant-…" \
  OPENAI_API_KEY="sk-…" \
  VICMAP_ENABLED="true" \
  --config apps/api/fly.toml

# 4. First deploy
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
```

Subsequent deploys:

```bash
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile -a construct-api

flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a construct-web \
  --build-arg NEXT_PUBLIC_API_URL=https://construct-api.fly.dev
```

Set on **construct-web** (runtime): `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

## Mobile (Expo)

```bash
cd apps/mobile

# Expo iOS/Android development build
pnpm dev

# Production build via EAS
eas build --platform ios --profile production
eas build --platform android --profile production

# Optional submit to stores
eas submit -p ios
eas submit -p android
```

Set the EAS env vars to point at the deployed API:

```
EXPO_PUBLIC_API_URL=https://construct-api.fly.dev
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_…
```

Without `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` the app launches in
dev-mode auth (permanent `dev-user`) — useful for previews, not for
production.

## CI

`.github/workflows/ci.yml` runs on every PR and push to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck` + `pnpm test`
3. `docker build` for `apps/api/Dockerfile` and `apps/web/Dockerfile` (web
   passes `NEXT_PUBLIC_API_URL=https://construct-api.fly.dev`)
4. On `main` push: `flyctl deploy` both apps + smoke `curl` health checks

**CI web deploy `unauthorized`:** The GitHub secret (`FLY_API_TOKEN` or
`BROKKER`) must be a Fly token with deploy access to **both**
`construct-api` and `construct-web` on the same org. Tokens scoped to API
only pass the API step and fail on web. Until the secret is updated, deploy
web from a machine with `flyctl auth login`:

```bash
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile \
  -a construct-web --remote-only \
  --build-arg NEXT_PUBLIC_API_URL=https://construct-api.fly.dev
```

Local mirror: `pnpm ci` and `pnpm build:docker`. Full gap audit:
[docs/GAP-ANALYSIS.md](docs/GAP-ANALYSIS.md).

## Local dev

```bash
pnpm install
pnpm typecheck      # all packages

# API only
cd apps/api && pnpm dev   # http://localhost:3001, dev-fallback mode

# Mobile only
cd apps/mobile && pnpm dev
```

Without env vars set, the API uses dev fallbacks (mock survey,
heuristic dictation, canned transcript) and the mobile app uses
dev-mode auth.
