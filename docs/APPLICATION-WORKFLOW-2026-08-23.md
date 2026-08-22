# Application workflow — start to finish

Recorded 2026-08-23 from a live production probe plus a code-path walkthrough.
This is the **operational** map: how code moves from your machine to Railway,
and how an operator moves from the landing page to a quoted site.

**Operator UX (what users see and click):**
[`OPERATOR-UX-WORKFLOW-2026-08-23.md`](OPERATOR-UX-WORKFLOW-2026-08-23.md)

Binding canvas docs (`docs/GOLD-STANDARD-2026*.md`) still win on product
architecture; this file wins on **run/deploy/journey**.

---

## 1. Current production state (verified)

| Check | Result |
|---|---|
| Web `/` | 200 — public landing (`LandingCanvas`, Vicmap hero) |
| Web `/home` | 200 — operator dashboard (projects register) |
| Web `/sign-in` | 200 — redirects to `/home` when Clerk is off |
| API `/readyz` | 200 — `status: ok`, 827 records, volume writable |
| API `/healthz` | 200 |
| Web deploy | `d6a99e68-9fe3-4d3e-9f27-0f32987a93c7` SUCCESS (CLI `railway up`) |
| API deploy | `f660a53e-5f01-42c4-b4ca-5f16df05f0dc` SUCCESS |
| Git `main` | GitLab `origin`; CI-gated |
| GitLab CI | Blocking gate + secret scan + 3 Playwright shards before Railway deploy |

Live URLs:

- Web: https://web-production-3c194.up.railway.app
- API: https://api-production-a8ff1.up.railway.app

---

## 2. System map

```
┌─────────────────────────────────────────────────────────────────┐
│  Developer machine (Cursor / VS Code)                           │
│  pnpm dev  ·  pnpm run ci (local)  ·  railway up (deploy)       │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ git push                       │ railway up (upload)
                ▼                                ▼
┌───────────────────────────┐    ┌──────────────────────────────┐
│  GitLab (origin)          │    │  Railway production          │
│  Gate + e2e + deploy      │    │  web :3002  ·  api :3001     │
└───────────────────────────┘    │  api-volume → SQLite WAL     │
                                 └──────────────────────────────┘
                                                ▲
                                                │ server actions + fetch
┌───────────────────────────────────────────────┴─────────────────┐
│  Next.js 15 web (apps/web)                                      │
│  Server components → lib/api.ts → Fastify API                   │
│  WebGL studio at /projects/[id]?mode=…                          │
└─────────────────────────────────────────────────────────────────┘
```

**Monorepo packages:** `packages/contracts` (Zod boundary) → `packages/domain`
(math) → `packages/db` (memory store + SQLite journal) → `apps/api` /
`apps/web`. Mobile (`apps/mobile`) is a **forked** Expo app, not responsive
web.

---

## 3. Developer workflow

### 3.1 First-time setup

1. Node 22, pnpm 9.15.4 (see root `package.json`).
2. `pnpm install`
3. Copy env templates (not committed):
   - `apps/api/.env.example` → `apps/api/.env`
   - `apps/web/.env.example` → `apps/web/.env`
4. `pnpm --filter '@workstream/*' build` once (Turbo `dev` also builds deps).
5. Without Clerk keys both surfaces use **`dev-user`** (`AUTH_REQUIRED=false`).

### 3.2 Local run

| Command | What starts | URL |
|---|---|---|
| `pnpm dev` | API + web via Turbo | API :3001, web :3002 |
| `pnpm --filter @workstream/api dev` | Fastify + store | http://localhost:3001 |
| `pnpm --filter @workstream/web dev` | Next dev (Turbopack) | http://localhost:3002 |

API boot sequence (`apps/api/src/server.ts`):

1. `loadEnv()` — production fail-closed unless `AUTH_REQUIRED=false`
2. `assertAuthConfigured()` — Clerk required only when `isAuthRequired()`
3. Fastify plugins: store → auth → routes (40+ route modules)
4. Listen on `PORT` (3001)

Web boot: Next App Router. Edge proxy (`apps/web/src/proxy.ts`) only runs Clerk
middleware when both `sk_` + `pk_` keys are present.

### 3.3 Quality gate (local + CI)

```bash
pnpm run ci    # full gate: ratchets + typecheck + lint + vitest + web bundle build
pnpm typecheck
pnpm test
pnpm lint
```

Pre-commit (husky) runs a **subset** on staged files — not the full gate. A
green hook ≠ green `pnpm run ci`.

**Gotcha:** after editing `packages/domain`, rebuild before API tests:
`pnpm --filter @workstream/domain build` (or run `pnpm typecheck` first).

### 3.4 Deploy to production

**Primary path:** push `main`. GitLab runs `pnpm run ci`, the secret scan, and
all three Playwright shards. Only after all blocking jobs pass does
`deploy-railway` deploy API first, then web, and probe `/readyz` plus `/home`.

Manual fallback from repo root:

```bash
railway up --project e2c12b66-af3a-4a51-a285-874c7a6de7d4 --service web --environment production --detach
railway up --project e2c12b66-af3a-4a51-a285-874c7a6de7d4 --service api --environment production --detach
```

Verify:

```bash
curl https://api-production-a8ff1.up.railway.app/readyz
curl -I https://web-production-3c194.up.railway.app/home
```

CI trigger:

```bash
git push origin main
```

See `RAILWAY.md` for service variables and health paths.

---

## 4. Git workflow (current)

| Remote | URL | Role |
|---|---|---|
| `origin` | gitlab.com/77999-group1/77999-project | **Source of truth** |
| `github` | github.com/Boringuy7799/workstream | Archive / legacy |

GitLab CI gates production deployment. Pushing `main` runs the repository gate,
secret scan, and Playwright shards before Railway deployment.

Historical note: GitLab replaced GitHub Actions in Aug 2026 when GitHub billing
froze CI (`docs/MIGRATE-GITHUB-TO-GITLAB.md`). CI was later turned off after
pipeline minutes + auth-hardening deploy failures.

---

## 5. Auth workflow

### Production today

Railway variables: `AUTH_REQUIRED=false`, no Clerk keys.

| Layer | Behaviour |
|---|---|
| Web `requireSignedIn()` | Returns `{ userId: "dev-user" }` — no login screen |
| Web `/sign-in`, `/sign-up` | Redirect to `/home` |
| API `requireAuth` | Binds every request to workspace `dev-user` |
| `/readyz` check `clerk: true` | Passes because `!isAuthRequired()` — **not** because Clerk is configured |

### Intended production (human ops)

Set Clerk keys on **both** web and API, then set `AUTH_REQUIRED=true` (or
unset it). Runbook: `docs/HUMAN-OPS-RUNBOOK.md` §1.

### Code rule (`isAuthRequired`)

- `AUTH_REQUIRED=false` → bootstrap / demo (explicit override)
- unset in production → fail-closed (Clerk required)
- `AUTH_REQUIRED=true` → Clerk required everywhere

---

## 6. Operator journey (product — start to finish)

### 6.1 Public entry

| Step | Route | What happens |
|---|---|---|
| 1 | `/` | Landing hero — Esri aerial, Stonnington demo coords, address combobox |
| 2 | `/home` link | Operator dashboard (requires signed-in identity — `dev-user` in prod) |

Landing does **not** auto-redirect to `/home`. AGENTS.md still says “`/` →
`/home`”; that is **stale** — landing shipped at `/`.

### 6.2 Dashboard — create a site

| Step | UI | Backend |
|---|---|---|
| 1 | `/home` | `listProjects()` → API `GET /projects` scoped to workspace owner |
| 2 | Address composer | `geocodeSearchAction` → API geocode (Vicmap GNAF keyless) |
| 3 | “Locate property” | `createProjectWithSurveyAction` → `POST /projects` + survey pipeline |
| 4 | Project card | Links to `/projects/[id]?mode=survey` (or suggested mode) |

Home page catches API errors inline (`loadError` banner) — unlike auth
failures, list failures do not throw the error boundary.

### 6.3 Studio — eight canvas modes

Single mount: `/projects/[id]` → `WebGLStudioPreview` → `WebGLStudio`.

Server prefetch (`projects/[id]/page.tsx`):

- `getDesignCanvas` — **fail closed** (network error aborts page)
- `getSurvey`, title, outputs — best effort
- `resolveCanvasMode` — clamps locked deep-links before first paint

Progressive unlock (`lib/canvas-mode.ts`):

```
survey (always)
  → sketch, cad, elevation, garden (after aerial/title)
    → quote, present (after CAD progress)
      → share (after costed quote)
```

URL: `/projects/[id]?mode=survey|sketch|cad|elevation|quote|present|share|garden`

Legacy routes (`/projects/[id]/survey`, `/design/studio`, …) redirect into
canvas modes via `redirectToCanvas`.

### 6.4 Survey → sketch → CAD

| Stage | Mode | Key actions |
|---|---|---|
| Site truth | `survey` | Vicmap hydrate, overlays, checklist, aerial |
| Ink | `sketch` | Strokes on WebGL board, assets, photo-trace elevation |
| Design | `cad` | Placements, features, live BOM, ghost review, Tidy/convert |
| Facade | `elevation` | Photo-trace sheets, boundary snap |
| 3D | `garden` | Eye-level view |
| Money | `quote` | Fit sheet, costing |
| Client | `present` / `share` | Deck + portal deposit |

Mutations flow: browser → **server actions** (`apps/web/src/app/actions.ts`) →
`lib/api.ts` → Fastify routes → `@workstream/db` store → SQLite flush.

### 6.5 Settings & integrations

`/settings` — integration summary, billing/license (owner-only on API).
Secrets are **owner-scoped** in SQLite, not mirrored to `process.env` in
production.

### 6.6 Client portal (no operator auth)

`/portal/deposit/[token]` — Stripe checkout redirect when configured.

---

## 7. Data persistence workflow

1. **Runtime:** in-memory arrays keyed by `owner_id` (`packages/db`).
2. **Durability:** SQLite WAL write-through (`packages/db/src/sqlite-persist.ts`).
3. **Railway volume:** `api-volume` → `/repo/apps/api/data`
   - `CONSTRUCT_PERSIST_PATH=…/store.json` (first-boot import only)
   - `CONSTRUCT_SQLITE_PATH=…/store.sqlite3`
4. **Production refuses boot** if the data directory is not writable.

Pipeline jobs (survey, CAD, costing) run **inline** unless `REDIS_URL` is set
(BullMQ worker not provisioned on Railway today).

---

## 8. Mobile (parallel product)

`apps/mobile` — Expo Router, separate from responsive web.

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` required when auth is on
- `EXPO_PUBLIC_WEB_PREVIEW=true` → static web preview shell
- Not deployed via the same Railway web/api pair

---

## 9. Issues found during this audit

### P0 — already hit in production (Aug 2026)

| Issue | Symptom | Mitigation |
|---|---|---|
| Auth hardening ignored `AUTH_REQUIRED=false` | API crash-loop, `/home` error boundary | Fixed in `9222626`; live via CLI deploy |
| GitLab CI auto-deploy | Broken code shipped on green gate | CI disabled; manual `railway up` only |

### P1 — operational confusion

| Issue | Detail |
|---|---|
| **Stale docs** | AGENTS.md still describes GitLab CI gate + `/` → `/home` redirect |
| **`/readyz` clerk check** | Reports `clerk: true` when auth is waived — misleading for ops |
| **`buildSha: unknown`** | CLI `railway up` deploys do not stamp git SHA (Dockerfile arg not passed) |
| **No real sign-in** | Production is shared `dev-user` — not multi-tenant safe |
| **Pre-commit weight** | Hook runs `pnpm -w typecheck` + vitest related — can take 30–40s |

### P2 — known gaps (documented elsewhere)

| Issue | Detail |
|---|---|
| Clerk not provisioned | Human ops: `docs/HUMAN-OPS-RUNBOOK.md` |
| Redis worker off | Pipeline inline; `REDIS_URL` unset |
| Sentry DSN unset | Warns at API boot |
| AI keys partial | Dev fallbacks in prod (warned at boot) |
| Rate limit | API 300 req/min/IP — heavy SSR reload can 429 project layout |
| e2e | Playwright suite exists; not part of deploy path |
| GitHub remote | Legacy archive; not origin |

### P3 — minor / cosmetic

| Issue | Detail |
|---|---|
| Sign-in route 200 | `/sign-in` loads then redirects — no dedicated login UX in bootstrap mode |
| Landing vs dashboard | Two entry points (`/` public, `/home` operator) — intentional but easy to confuse |
| SKIPPED Railway deploy | Duplicate trigger can appear when CI/watchers fire — harmless if SUCCESS deploy exists |

---

## 10. Quick reference

```bash
# Dev
pnpm install && pnpm dev

# Gate (before you care)
pnpm run ci

# Backup
git push origin main

# Ship
railway up --project e2c12b66-af3a-4a51-a285-874c7a6de7d4 --service api --environment production --detach
railway up --project e2c12b66-af3a-4a51-a285-874c7a6de7d4 --service web --environment production --detach

# Live probes
curl https://api-production-a8ff1.up.railway.app/readyz
curl -I https://web-production-3c194.up.railway.app/home
```

---

## 11. Related docs

| Doc | Use when |
|---|---|
| `ONBOARDING.md` | Canvas architecture, modes, camera machine |
| `RAILWAY.md` | Service variables, Docker paths |
| `PRODUCTION.md` | Live URLs, auth checklist |
| `docs/HUMAN-OPS-RUNBOOK.md` | Clerk, Redis, Litestream (human hands) |
| `OUTSTANDING.md` | Ranked punch list |
