# Deploying Workstream

The repo has **three deploy surfaces**:

| Surface | Where it runs | What you run |
| --- | --- | --- |
| `apps/api` (Fastify) | Railway `api-production-a8ff1` | Push to `main` (auto-deploy) or `railway up` |
| `apps/web` (Next.js) | Railway `web-production-3c194` | Push to `main` (auto-deploy) or `railway up` |
| `apps/mobile` (Expo Router) | Expo / EAS Build | `eas build` / `eas submit` |

**Aerial Design Studio** and operator studio UI live in **`apps/web`**
(`https://web-production-3c194.up.railway.app`). API + mobile are separate targets.

The contracts, db, domain, ui, and client packages have no deploy
target — they're consumed by the apps at build time.

## Prerequisites

```bash
gh --version      # GitHub CLI, authed with repo + workflow scopes
railway version   # Railway CLI
node --version    # ≥ 22
pnpm --version    # ≥ 9.15
```

You also need a Railway account with access to the Workstream project.

## Railway setup

The Railway project already exists. To connect a fresh checkout:

```bash
railway link
```

Set variables through the Railway dashboard or CLI. On the API service
(`api-production-a8ff1`):

```
CORS_ORIGIN=https://web-production-3c194.up.railway.app
PUBLIC_API_URL=https://api-production-a8ff1.up.railway.app
```

Optional — without these the API runs in dev-fallback mode:

```
CLERK_SECRET_KEY=sk_…
MAPBOX_TOKEN=pk.…
ANTHROPIC_API_KEY=sk-ant-…
OPENAI_API_KEY=sk-…
```

Vicmap Property/buildings use keyless DELWP GeoServer WFS — no VICMAP secret.

The API durability volume `api-volume` mounts at `/repo/apps/api/data`.

Set on the web service (`web-production-3c194`): `CLERK_SECRET_KEY`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

## Deploys

Railway auto-deploys on push to `main`. To deploy manually:

```bash
railway up
```

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
EXPO_PUBLIC_API_URL=https://api-production-a8ff1.up.railway.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_…
```

Without `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` the app launches in
dev-mode auth (permanent `dev-user`) — useful for previews, not for
production.

## CI

`.github/workflows/ci.yml` runs on every PR and push to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck` + `pnpm test`
3. Playwright e2e
4. `docker build` for `apps/api/Dockerfile` and `apps/web/Dockerfile`

Railway handles the deploy from `main` automatically.

Local mirror: `pnpm run ci` and `pnpm build:docker`. Full gap audit:
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
