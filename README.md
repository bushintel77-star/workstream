# Workstream

Voice-first landscape design and build co-pilot for **Curtis & Co** (Melbourne).

**Naming:** the product is **Workstream** everywhere in UI and docs. Curtis & Co
stays on client-facing quotes and portal pages. The mobile bundle ID is
`com.curtisandco.workstream`.

Tim walks a site and talks. By the time he's at the car the survey, design,
costing, audit and quote are ready — Stonnington stormwater pack drafted,
MYOB invoice queued, Mick on his way with the trencher.

## Stack

| Surface | Tech | Where |
|---|---|---|
| **Operator API** | Fastify (Node 22), pino, Zod | [apps/api](apps/api/) → `api-production-a8ff1.up.railway.app` |
| **Operator web** | Next.js 15 (App Router), server actions, PWA | [apps/web](apps/web/) → `web-production-3c194.up.railway.app` |
| **Operator mobile** | Expo / React Native, expo-router | [apps/mobile](apps/mobile/) → not yet distributed |
| **Schemas** | Zod | [packages/contracts](packages/contracts/) |
| **Store** | In-memory + SQLite WAL journal | [packages/db](packages/db/) |
| **Domain logic** | Costing, geometry, carbon | [packages/domain](packages/domain/) |

Deployed on **Railway**. Auth optional via Clerk; without it the API
runs as `dev-user`.

## New here? Start with the docs

**[ONBOARDING.md](ONBOARDING.md)** is the single current-state entry doc:
two-studio split (WebGL default / `?svg=1` fallback), platform stages vs
canvas modes, camera machine, and where the sketch-to-CAD parse lives.
The binding product docs are the `docs/GOLD-STANDARD-2026*.md` set;
`OUTSTANDING.md` is the live punch list.

## Getting started

```bash
# 1. Prereqs: Node 22, pnpm 9.15.4, Docker (for prod builds)
corepack enable && corepack prepare pnpm@9.15.4 --activate

# 2. Install
pnpm install

# 3. Env (each app has a .env.example)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
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
  api/           Fastify operator API — Stripe, Anthropic, OpenAI, Vicmap, MYOB, Xero
  web/           Next.js operator dashboard + client portal
  mobile/        Expo operator app (site-walk capture, dictation, kanban)
packages/
  contracts/     Zod schemas shared by API + web + mobile
  db/            In-memory store + SQLite WAL write-through journal
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

**CI:** `pnpm run ci` is the local gate (frozen install, mobile placeholders,
portal edge, token allowlist, reachability/CSS-scale/bundle ratchets,
traceability, typecheck, lint, vitest). CI runs on GitHub Actions
(`.github/workflows/ci.yml`). Railway deploys via the `deploy` job after the
gate and secret scan pass, or via `railway up` CLI. See `RAILWAY.md`.

**Local / script:**

```bash
pnpm run ci                # full local gate (same as CI)
pnpm build:docker          # both images
docker compose up --build  # localhost :3001 / :3002
railway up                 # manual deploy (needs Railway CLI auth)
```

See [PRODUCTION.md](PRODUCTION.md) for production URLs, secrets, and smoke
checks.

### Persistence

Durability is the SQLite WAL write-through journal
(`packages/db/src/sqlite-persist.ts`): every mutation flushes synchronously
before return. First boot imports the legacy `apps/api/data/store.json`
snapshot, then archives it. The Railway volume `api-volume` mounts at
`/repo/apps/api/data` (`CONSTRUCT_SQLITE_PATH=…/store.sqlite3`); keep the API
on one instance while SQLite is single-writer.

## Outstanding

See `OUTSTANDING.md` (the live punch list) and `ONBOARDING.md` (current-state
entry doc). `docs/GAP-ANALYSIS.md` is historical.

## Conventions

- **Conventional Commits** (`feat:`, `fix:`, `chore:`).
- Direct pushes to `main` are fine — CI is green-or-red, no merge queue yet.
- AU-locale everywhere (`en-AU`, AUD, ABN, Stonnington/Yarra heritage).
- No emojis in code or commits.
