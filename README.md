# Workstream

Voice-first landscape design and build co-pilot for **Curtis & Co** (Melbourne).

## Names (only two)

| Layer | Name | Use |
|-------|------|-----|
| **Studio** | Curtis & Co | Client quotes, brochures, portal |
| **Product** | **Workstream** | This repo — API, web, mobile |

Retired codenames: **Construct**, **Walkthrough** (site walkthrough is still the verb for voice capture).

## Canonical location

Prefer opening the monorepo from the Curtis & Co workspace:

`C:\Users\Tim\Downloads\CURTIS-CO\workstream`

If you are in `KellyBet-Fresh\WorkSteam`, see [MIGRATED.txt](MIGRATED.txt) and [CONSOLIDATION.md](CONSOLIDATION.md).

## Stack

| Surface | Tech | Production |
|---|---|---|
| **Operator API** | Fastify (Node 22), Zod | `workstream-api.fly.dev` |
| **Operator web** | Next.js 15 App Router | `workstream-web.fly.dev` |
| **Operator mobile** | Expo / expo-router | EAS → `com.curtisandco.workstream` |
| **Schemas** | `@workstream/contracts` | — |
| **Store** | In-memory + JSON snapshot | Fly volume `workstream_data` |

Legacy Fly apps `construct-api` / `construct-web` may still run until you cut over — see [CONSOLIDATION.md](CONSOLIDATION.md).

## Getting started

```bash
corepack enable && corepack prepare pnpm@9.15.4 --activate
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

pnpm --filter '@workstream/*' build
pnpm --filter @workstream/api dev    # :3001
pnpm --filter @workstream/web dev    # :3002
pnpm --filter @workstream/mobile dev
```

Production requires Clerk on API + web + mobile. Local dev works without keys (`dev-user`).

## Deploy

See [DEPLOY.md](DEPLOY.md) and [OUTSTANDING.md](OUTSTANDING.md).

```bash
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile -a workstream-api
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a workstream-web
flyctl scale count 1 -a workstream-api
```

## Pipeline

```
record → transcribe → survey → design → costing → audit → outputs
```

Automated after upload on mobile; operator web uses the same API with Clerk bearer tokens.

## Plans (commercial intent)

**Lite** — one user free: full pipeline with dev fallbacks when API keys are unset.
**Studio** — paid live integrations (AI, Mapbox, Stripe, MYOB/Xero) and extra seats.
**CRM** — headless Zoho via n8n ([architecture](docs/CRM-ARCHITECTURE.md), [setup](docs/CRM-ZOHO.md)). **Email** via Resend. See [docs/PLANS.md](docs/PLANS.md), [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).
