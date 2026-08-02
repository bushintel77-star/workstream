# Production punch list

Living doc of work between today's state and gold-standard
end-to-end production. Owned alongside the codebase; tick items as PRs land.

- [WORKSTREAM-STATUS.md](docs/WORKSTREAM-STATUS.md) — consolidated done + roadmap
- [GAP-ANALYSIS.md](docs/GAP-ANALYSIS.md) — detailed audit

## P0 — Blocks first paying customer

- [x] **Persistence on Fly** — `[mounts]` block live in
      [apps/api/fly.toml](apps/api/fly.toml) against `construct_data_v2`.
- [x] **SQLite write-through journal** — `packages/db/src/sqlite-persist.ts`
      (Node 22 `node:sqlite`, WAL). In-memory store retained for jobs/tests;
      JSON snapshot retired from the hot path (first-boot import +
      `exportSnapshot` escape hatch). Railway:
      `CONSTRUCT_SQLITE_PATH=/repo/apps/api/data/store.sqlite3` on `api-volume`.
- [ ] **Single API machine** — human must run
      `flyctl scale count 1 -a construct-api` after deploy to keep the
      JSON snapshot store single-writer. (Railway: keep one API replica while
      the store is single-writer SQLite.)
- [x] **Auth on (code)** — Clerk middleware + `<ClerkProvider>` + server-side
      `requireSignedIn()` gate on the dashboard. Opt-in via `CLERK_SECRET_KEY`;
      dev mode unchanged. Still needs Clerk Fly secrets set on `construct-web`
      (`CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- [x] **CORS_ORIGIN** Fly secret on construct-api → `https://construct-web.fly.dev`
- [x] **NEXT_PUBLIC_API_URL** baked into web Docker build + CI `--build-arg`.
- [x] **Build automation** — `pnpm run ci`, `pnpm build:docker`,
      `docker-compose.yml`, `scripts/deploy-fly.*`, CI smoke tests,
      `workflow_dispatch` deploy. Local CI now includes mobile placeholder,
      portal Edge, typecheck, lint, and Vitest gates (`0369689`).
- [x] **Secret scanning** — gitleaks GitHub Action at
      [.github/workflows/gitleaks.yml](.github/workflows/gitleaks.yml).
- [x] **Stripe key validation on save** — `GET /v1/balance` round-trip wired in
      [apps/api/src/routes/settings.ts](apps/api/src/routes/settings.ts) via
      `validateStripeKey()`; rejects bad keys with Stripe's own error message.
- [x] **Sentry scaffold (code)** — API [`sentry.ts`](apps/api/src/lib/sentry.ts) +
      web [`instrumentation.ts`](apps/web/src/instrumentation.ts). **Human:** set
      `SENTRY_DSN` on both Fly apps + `pnpm add @sentry/nextjs` on web when enabling.

## P1 — Quality + scale

- [ ] **Mobile distribution** — `eas build:configure`, TestFlight / APK.
      `app.json` no longer contains the EAS init placeholder and CI guards against
      reintroducing it. **Human:** run EAS init and provide Apple/Google credentials.
- [x] **BullMQ + Redis (code path)** — worker in [`queue.ts`](apps/api/src/lib/queue.ts),
      `[processes] worker` in `fly.toml`, pipeline enqueues when `REDIS_URL` set.
      **Human:** provision Upstash/Fly Redis + `fly scale count worker=1`.
- [x] **Litestream -> R2/B2 (SQLite-ready documented config)** — [`docs/litestream.example.yml`](docs/litestream.example.yml)
      + [`docs/LITESTREAM-SETUP.md`](docs/LITESTREAM-SETUP.md).
      **Human:** bucket credentials + Fly sidecar after the SQLite migration.
- [x] **CI deploy job** — split `deploy-api` + `deploy-web`; `FLY_API_WEB` wired.
- [x] **Dependabot** — enabled for pnpm + GitHub Actions.
- [ ] **Branch protection on `main`** — requires **GitHub Pro** on private repo (403
      from API). Enable manually: Settings → Branches → require CI green.
- [x] **Playwright e2e** — `design-studio.spec.ts` (load + save), `operator-happy-path.spec.ts`;
      CI job `playwright e2e` on PR + main.
- [x] **Contract tests (extended smoke)** — Zod boundary tests +
      [`contract.test.ts`](apps/api/src/routes/contract.test.ts) covers core
      project flows plus geocode, catalog, suppliers, site context, weather,
      carbon preconditions, readiness, validation, auth-configuration guard,
      protected file portal scope/tombstones, studio AI, orchestration, and
      Stripe webhook smoke coverage.
- [x] **Unit tests on pipeline jobs** — survey, cost, design, audit, pipeline
      (`*-job.test.ts`, `pipeline-job.test.ts`).
- [x] **Visual regression (quote markdown)** — snapshot in `output-generators.test.ts`.
- [x] **Tier-1 costing parity** — standard scenario locks to `$58,410.35` via
      `ALW-TIER1-ALIGN` in [`cost-job.ts`](apps/api/src/lib/cost-job.ts).

## P2 — Scale + cost

- [x] **Per-request owner secrets** — `owner-secrets.ts` AsyncLocalStorage; no
      `process.env` mutation in auth path.
- [x] **Multi-tenant authorization** — route-level `getOwnedProject` gates on all
      project-scoped GET/POST/PATCH/DELETE handlers.
- [x] **Protected file delivery** — auth or portal token on `/uploads`, `/outputs`,
      `/photos`, `/aerial`, `/filings` ([protected-files.ts](apps/api/src/routes/protected-files.ts));
      portal file access is quote-view scoped and tombstoned projects are blocked.
- [x] **Worker snapshot reload** — `reloadSnapshot()` before BullMQ jobs.
- [x] **ESLint (initial)** — root [`eslint.config.mjs`](eslint.config.mjs); CI `pnpm lint`
      on api/web/domain/contracts. Mobile/ui excluded until RN rules land.
- [x] **Local CI guardrails** — root `pnpm run ci` now runs install,
      mobile placeholder detection, portal Edge runtime/import guard, typecheck, lint,
      and Vitest.
- [x] **OpenTelemetry tracing** API → Anthropic / OpenAI / Mapbox; route spans
      use active context, token usage is attached to provider spans, aerial
      fetches are traced, and worker shutdown flushes telemetry.
- [x] **Real-user monitoring (web scaffold)** — [`instrumentation.ts`](apps/web/src/instrumentation.ts);
      needs DSN + `@sentry/nextjs` package.
- [x] **Audio compression** — mobile walkthrough uses `LOW_QUALITY` recording preset.
- [x] **Edge runtime** for `/portal/*` pages.
- [x] **Portal hero image** — `hero_url` from survey aerial on quote portal payload.
- [x] **Portal checkout production URLs** — `PORTAL_BASE_URL` is set in
      [`apps/api/fly.toml`](apps/api/fly.toml), production defaults to
      `construct-web`, and quote/deposit amounts render with cents.
- [x] **Activity audit trail** — `GET /projects/:id/activity` and `GET /settings/activity`;
      logs project delete/restore, filing delete, crew, catalog, integration, SKU link.
- [x] **Soft delete + audit trail** — tombstone + undo on projects; audit log on destructive actions.
- [x] **Project soft delete + restore** — `deleted_at` tombstone; `POST /projects/:id/restore`.
- [x] **Dashboard delete undo** — toast restores via restore endpoint.
- [x] **Dashboard project register hardening** — status chips, project cards,
      search, multi-status filters, sort controls, costing totals, designed
      empty/error/no-results states, and bottom-left undo toast.
- [x] **Dashboard filters + shell** — shared AppNav, status filters, date/name sort,
      designed empty state, API retry affordance, and global dev-auth banner.
- [x] **Pipeline idempotency** — `Idempotency-Key` on full pipeline POST; Redis when
      `REDIS_URL` set, in-memory fallback.
- [x] **Task route hardening** — `PATCH /projects/:projectId/tasks/:taskId/status`
      with owned-project + task-in-project checks.

## P3 — Nice to have

- [ ] Storybook for web primitives.
- [x] **Local docker-compose** — [docker-compose.yml](docker-compose.yml).
- [ ] Bundle-size budget in CI.
- [ ] PostgreSQL migration once the data model stabilises.
- [ ] Multi-region Fly deploy for HA.
- [ ] **`moduleResolution: node` (node10) removal in TypeScript 7.** Source is
      [`tsconfig.node.json`](tsconfig.node.json) line 5, inherited by `apps/api`
      and `packages/{contracts,db,cad,domain}`. Harmless today — TS 5.9.3 exits 0
      (verified uncached, not turbo cache), so `pnpm typecheck` / `pnpm run ci`
      are green; editors on a newer TS surface it as an error.
      **Do not apply the editor's suggested fix:** `"ignoreDeprecations": "6.0"`
      fails on the installed compiler with `error TS5103: Invalid value` — it
      converts an editor warning into a build break in five packages. (`"5.0"`
      is accepted but silences a different deprecation cycle, so it fixes
      nothing.) Real fix is migrating those five to `node16` resolution, which
      makes TS honour package `exports` maps — needs its own change plus a full
      typecheck + test + build run. `tsconfig.base.json` (web, mobile, ui,
      client) is already on `bundler` and unaffected.
- [ ] **Artboard strip eats elevation callout clicks.** In `?mode=elevation` the
      bottom-centre `artboard-strip` (`ArtboardStrip`, `CameraChrome` dock,
      `bottom: --ws-stack-4`) floats over the *middle of the drawing* — measured
      at `x 531–783, y 426–458` on a 1280x720 board — and swallows pointer
      events on any `elevation-label` callout under it. The callout is a real
      control (click = select + locate in plan), so a profile whose leader lands
      mid-board cannot be selected by its label. Clicking the silhouette still
      works, which is why `e2e/elevation-silhouettes.spec.ts` drives selection
      through `[data-elev-family]` instead. Pre-existing (predates the Tier 4
      silhouette work — the label anchor only moved ~16 px). Fix is a chrome
      placement decision: either reserve a dock shelf in the elevation stage or
      move the strip out of the drawing band in elevation mode; do not "fix" it
      by making callouts non-interactive.

## Aerial Design Studio (separate track)

See [`AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md`](AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md),
[`RECON.md`](RECON.md), [`PROPOSAL.md`](PROPOSAL.md) (AI Phase 6 deferred).

- [x] Phase 1 recon (`RECON.md`)
- [x] Phase 2 brand re-skin (Aegis tokens)
- [x] Phase 3 layout (toolbar save, aerial hero, 320px rail)
- [x] Phase 4 asset library (code on tiles, search by code, planning pin)
- [x] Phase 5 modeless canvas (select/move/rotate/scale, scale bar, context label)
- [x] Phase 7 honesty UI (caption, save hand-off, clear confirms, keyboard legend);
      active handoff studio save retry, caption, and aerial failure states
      hardened in `0369689`.
- [x] Phase 8 docs + E2E (`CHANGES.md`, extended Playwright)
- [x] Gold upgrade — measure, mass plant, irrigation zones, live schedule, undo/redo, toolbar UX (`857b7af`)
- [x] Designer handover pack — [`docs/DESIGNER-HANDOVER.md`](docs/DESIGNER-HANDOVER.md)
- [ ] Phase 6 AI assist (deferred)
- [ ] Brochure output (deferred in spec)

## Human-only checklist (not code)

| Action | Command / where |
|--------|-----------------|
| Clerk on Fly | Runbook Section 1: API `CLERK_SECRET_KEY`, web `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `AUTH_REQUIRED=true` |
| API base/CORS | Runbook Section 1: `PUBLIC_API_URL=https://construct-api.fly.dev`, `CORS_ORIGIN=https://construct-web.fly.dev` |
| Sentry DSN | Runbook Section 3: `flyctl secrets set SENTRY_DSN=...` on both apps |
| Redis worker | Runbook Section 2: `REDIS_URL` + `flyctl scale count worker=1 -a construct-api` |
| Stripe / portal / OTEL | Runbook Section 6: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WORKSTREAM_PORTAL_SECRET`, `OTEL_EXPORTER_OTLP_ENDPOINT` |
| EAS project | Runbook Section 5: `cd apps/mobile && npx eas-cli init` plus store credentials |
| Litestream | Runbook Section 7 after SQLite migration |
| Branch protection | Runbook Section 8, GitHub repo Settings (Pro plan) |
| Fly tokens | `FLY_API_TOKEN` + `FLY_API_WEB` — **done** |

## Sandbox-blocked actions (need the user)

- `flyctl scale count 1 -a construct-api` (if not already)
- `flyctl secrets set ...` commands from the runbook, then redeploy where noted
- Valid Apple / Google credentials for EAS submit
