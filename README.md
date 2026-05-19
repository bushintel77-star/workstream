# Workstream

Voice-first landscape design and build co-pilot for **Curtis & Co** (Melbourne).

**Naming:** the product is **Workstream** everywhere in UI and docs. Curtis & Co
stays on client-facing quotes and portal pages. Legacy Fly app hostnames
(`construct-api`, `construct-web`) and mobile bundle IDs (`com.curtisandco.construct`)
are unchanged until the next deploy / store submission so production does not break.

Tim walks a site and talks. By the time he's at the car the survey, design,
costing, audit and quote are ready — Stonnington stormwater pack drafted,
MYOB invoice queued, Mick on his way with the trencher.

## Stack

| Surface | Tech | Where |
|---|---|---|
| **Operator API** | Fastify (Node 22), pino, Zod | [apps/api](apps/api/) → `construct-api.fly.dev` |
| **Operator web** | Next.js 15 (App Router), server actions, PWA | [apps/web](apps/web/) → `construct-web.fly.dev` |
| **Operator mobile** | Expo / React Native, expo-router | [apps/mobile](apps/mobile/) → not yet distributed |
| **Schemas** | Zod | [packages/contracts](packages/contracts/) |
| **Store** | In-memory with JSON snapshot flush | [packages/db](packages/db/) |
| **Domain logic** | Costing, geometry, carbon | [packages/domain](packages/domain/) |

Deployed on **Fly.io** (Sydney). Auth optional via Clerk; without it the API
runs as `dev-user`.

## Getting started

```bash
# 1. Prereqs: Node 22, pnpm 9.15.4, Docker (for prod builds)
corepack enable && corepack prepare pnpm@9.15.4 --activate

# 2. Install
pnpm install

# 3. Env (each app has a .env.example)
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

# 4. Build the workspace packages once
pnpm --filter '@workstream/*' build

# 5. Run
pnpm --filter @workstream/api dev          # http://localhost:3001
pnpm --filter @workstream/web dev          # http://localhost:3002
pnpm --filter @workstream/mobile dev       # Expo dev server
```

## Repository layout

```
apps/
  api/           Fastify operator API — Stripe, Anthropic, OpenAI, Mapbox, MYOB, Xero
  web/           Next.js operator dashboard + client portal
  mobile/        Expo operator app (site-walk capture, dictation, kanban)
packages/
  contracts/     Zod schemas shared by API + web + mobile
  db/            In-memory store with JSON snapshot persistence
  domain/        Pure functions — costing scenarios, geometry, embodied carbon
  ui/            (Optional) mobile-side primitives
```

## Pipeline

```
   record    →    survey    →    design    →    costing    →    audit    →    outputs
 (dictation)   (Vicmap)      (Claude)        (rate card)     (Claude)     (HTML quote etc.)
```

Each stage runs as a POST endpoint on the API; the web app shows progress in
the **Project hub** and surfaces the single next-step CTA on mobile.

## Deploying

```bash
# API
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile -a construct-api

# Web
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a construct-web
```

CI runs typecheck + test + Docker build on every PR; deploy is manual today
(see [audit](#outstanding) for the planned automation).

### Persistence

The JSON snapshot at `apps/api/data/store.json` is the source of truth.
**Persistence currently requires re-enabling the volume mount** in
[apps/api/fly.toml](apps/api/fly.toml) and running on a single machine.
Without that, the API restarts wipe state.

## Outstanding

See `OUTSTANDING.md` for the production punch list — auth, monitoring,
mobile distribution, queue, EAS, etc.

## Conventions

- **Conventional Commits** (`feat:`, `fix:`, `chore:`).
- Direct pushes to `main` are fine — CI is green-or-red, no merge queue yet.
- AU-locale everywhere (`en-AU`, AUD, ABN, Stonnington/Yarra heritage).
- No emojis in code or commits.
