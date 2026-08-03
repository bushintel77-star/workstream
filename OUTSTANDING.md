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
      on api/domain/contracts. Mobile/ui excluded until RN rules land, and
      **web is not covered** — see the P3 item below.
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
- [x] **Artboard strip eats elevation callout clicks.** Root cause was a double
      portal, not a placement choice: `ebf1872` moved `ArtboardStrip` inside the
      top-edge `FrameDrawer` ("lives in the frame, never on the canvas") but left
      the strip's own `CameraChrome place="dock"` wrapper in place, so its DOM
      portaled straight back out of the drawer to `camera-chrome-root` and its
      stale `bottom: var(--ws-stack-4)` parked it mid-drawing. The drawer had
      been rendering empty the whole time. Fixed by dropping the inner portal and
      laying the strip out in flow inside the drawer panel. Kept probe:
      `e2e/elevation-callout-hit.spec.ts` (hit-tests every callout, so any future
      dock landing on the drawing band fails too).
- [ ] **`GardenViewpointStrip` and `VariationFilmstrip` have the same double
      portal.** Both were migrated into FrameDrawers by `ebf1872` and both still
      wrap themselves in `CameraChrome place="dock"`, so they also escape their
      drawer and float on the drawing (`bottom: calc(--ws-safe-bottom + 10px)`
      and `left/bottom: calc(--ws-safe-* + 8px)`). Left as-is deliberately:
      `e2e/tilt-lens.spec.ts` and `e2e/canvas-design-craft.spec.ts` assert those
      strips are *visible on the canvas* after an explicit summon, so collapsing
      them into hover drawers is a product decision, not a bug fix. Decide
      whether the drawers or the summoned floaters are the intended UX, then make
      the code and the probes agree.
- [x] **WCAG 2.2 AA text contrast on the canvas** — kept gate
      [`e2e/canvas-contrast-aa.spec.ts`](apps/web/e2e/canvas-contrast-aa.spec.ts)
      walks survey/sketch/cad/elevation/quote and flattens each text node's
      translucent ancestor chain before measuring. It found **23 failures across
      22 rules**; all are fixed and the gate is at zero. Root causes worth
      remembering: `--text-muted` (`--gray-l-400` #9aa0ac) was 2.63:1 on white
      wherever it labelled chrome; the Tier-1 ledger rendered dark app-shell ink
      (`--ink-primary` #E8E9EC) on the Quote's white pane at **1.21:1**; and
      card-wide severity tints on the coaching cards spent the whole contrast
      budget (3.64:1 on blush) — those are now hairline + 24x2 accent bars, per
      the house rule that accents are top bars, not fills.
- [ ] **`dashboard-filter-sort.spec.ts` is stale.** Two of its five tests fail on
      a clean tree: they look for `[class*="projectGrid"]` / `emptyState` and a
      search input, all of which `ebf1872` removed when `/home` became the
      editorial index. Rewrite against the current hairline-row markup or delete
      the assertions — they have been red since that redesign.
- [ ] **Quote line table header crowds at wide viewports.** `.row`
      `grid-template-columns: 1fr 36px 72px 84px 108px minmax(120px, 180px)` runs
      `TOTAL` and `ACTIONS` together with no gutter, and a long unit note
      ("~1.73 t spoil · 8 t/load") bleeds into the actions column. Content-sized
      columns, so it needs a measured pass rather than a token swap.
- [x] **`apps/web` is now linted, at `--max-warnings 0`.** Root `pnpm lint`
      covers `apps/api/src apps/web/src packages/domain/src
      packages/contracts/src`. The predicted "large first-run backlog" did not
      materialise: the base config found 61 problems across 467 files, of which
      21 were `Definition for rule was not found` from `eslint-disable` comments
      referencing plugins that were never installed. Real backlog was 40
      mechanical findings.
      `eslint-plugin-react-hooks` 7.1.1 and `@next/eslint-plugin-next` 16.2.12
      are installed and scoped to `apps/web` via `files:`. Only
      `rules-of-hooks` (already at zero — no hook-ordering bugs anywhere) and
      `exhaustive-deps` are enabled; see the React Compiler item below.
      `no-img-element` and `no-page-custom-font` are off in config with reasons.

- [ ] **React Compiler rule set — scoped follow-up.** `react-hooks` v7's
      `configs.flat["recommended-latest"]` also enables the compiler correctness
      rules, which report **71 errors** in the canvas components:
      `set-state-in-effect` (42), `refs` (29), `preserve-manual-memoization` (7),
      `immutability` (4), `purity` (1). These are often deliberate canvas sync
      patterns, so each is a judgement call, and the files are locked by
      `canvas-chrome-*` specs. Deliberately deferred so the gate could go on.
      Do not widen the hooks config without scoping this first.

- [ ] **Google Fonts `<link>` → `next/font`.** `@next/next/no-page-custom-font`
      fires on `app/layout.tsx`. The rule's `pages/_document.js` premise does not
      apply under App Router, but its advice does. Migrating Fraunces / Sora /
      IBM Plex loading is a real change to studio typography — rule is off in
      config, not suppressed inline.

- [ ] **`HandoffDesignStudio` keyboard-shortcut effect can go stale.** The
      global `keydown` effect (~:1763) cannot list `planOn` or `setFitSheetOn` in
      its dependency array because both are declared *below* it — naming them is
      a temporal dead zone reference (TS2448). The closure is correct at call
      time; only the dep array cannot see them, so the hook carries a documented
      `exhaustive-deps` suppression. Fixing it properly means reordering
      declarations in a 5,700-line component.

## Shipped inert — features complete except for one connection

Found the moment `apps/web` was first linted (2026-08), then two more by the
reachability gate below. Each is a finished implementation missing its final
wiring; every one passed typecheck and unit tests and shipped doing nothing.
Deliberately marked `_`-prefixed or allowlisted rather than deleted.

- [x] **`boundaryHandPath`** — hand-drawn pen computed a wobbled title boundary
      and never rendered it, so in `hand_drawn` mode the dwelling wobbled while
      the lot ring drew mechanically straight. **Fixed** (`10fac0c`).
- [x] **`edgeLabels` / `showEdgeLabels`** — ground-grid metre labels computed and
      never rendered; all three call sites passed `false`. Superseded by the
      sibling ruler overlay, so **deleted** (`0c997a8`).
- [ ] **`setSort` (`DashboardProjects`) — live defect, not inert code.** The sort
      comparator runs (name / cost / activity) but no control calls `setSort`, so
      sorting is permanently locked to "activity". This is why
      `dashboard-filter-sort.spec.ts` is red. Resolve together with that spec.
- [ ] **`PointerMarkSettings` is never mounted.** A finished 91-line component
      with its own stylesheet, `data-testid="pointer-mark-settings"`, full
      `role="listbox"` / `aria-selected` a11y and passing unit tests. Nothing
      imports it, so `_setPointerMarkPreview` (its `onPreview`) and the dropped
      `savePointerMarkId` import (its `onMarkId`) have no caller and the drawing
      cursor can never be changed. Restoring the mount is a Cmd+K decision per
      `STUDIO-STYLING-AND-UX.md` §6 item 9 — the ribbon is a fixed budget.
- [ ] **`_trade`** — `solveLiveTradeEstimate` is solved on every estimate change
      and never displayed. The calculation is real and owned by
      `@workstream/domain`; the display is missing.
- [x] **`HOVER_DELAY_MS` (`RailDrawer`)** — the hover effect called
      `setOpen(true)` immediately, so the 250 ms guard its own comment describes
      never applied and the drawer opened the instant the pointer crossed it.
      **Fixed** (`3fdea04`), along with two more bugs the wiring exposed: the
      drawer could not be closed by clicking while hovered, and the documented
      hover auto-retract never ran. Kept probe `e2e/rail-drawer-hover.spec.ts`,
      verified to fail against the pre-fix component.
- [x] **`active` (`SketchDock`)** — passed by `SketchBoard`, never read, so the
      dock held full presence while the pen was unarmed. **Fixed** (`9d37607`):
      recedes to 0.62 opacity with reduced lift, `pointer-events` kept so
      clicking re-arms, full presence back on hover and `focus-within`.
- [ ] **`StudioCoachMarks` is never mounted — logged, deliberately not wired.**
      A complete three-step onboarding tour (trace the lot / add planting / fit
      sheet + quote) with its own stylesheet and `cc_coach_done` localStorage
      first-run gating. Nothing imports it, so first-run onboarding has never
      appeared. **Decision: leave it unmounted.** `AiCapabilityCue` now covers
      the same teaching ground contextually rather than as an upfront tour, and
      two teaching surfaces would stack — which is exactly what
      `STUDIO-STYLING-AND-UX.md` §6 item 11 forbids. Delete it or fold its
      copy into the cue when someone owns that call; do not mount both.
- [ ] **`CanvasMeasureSummary` is never mounted.** "Small, stage-aware
      measurement card; click for the full live ledger." Its pure helper
      `buildCanvasMeasureSummary` *is* imported and has four passing tests, so
      the logic is covered while the card never renders — a clean illustration
      of why green unit tests were not evidence of a shipped feature.

- [x] **`scripts/check-feature-reachability.mjs` — built and wired into
      `pnpm ci`.** Walks the canvas feature folders, collects PascalCase
      component exports, and fails when one has no import, JSX tag, call or
      barrel re-export anywhere else. 121 components scanned, 3 allowlisted
      (each entry carries a reason and an item above). The allowlist is a
      ratchet: the gate also fails on a **stale** entry, so wiring a component
      up forces its exception to be removed.

      Two notes on its limits, kept honest rather than hidden. It found
      `StudioCoachMarks` and `CanvasMeasureSummary` that ESLint could not see,
      but it would only have caught one of the original six — the other five
      left an unused binding, which the lint gate now catches. And it cannot see
      a component that *is* imported yet rendered behind a condition that is
      never true; that needs a runtime probe.

      Its first version counted a code comment naming `PointerMarkSettings` as
      proof the component was mounted, which silenced the exact finding it was
      written for. Reachability is therefore matched on real syntax (import /
      JSX / call / re-export), not word presence.

- [x] **`scripts/check-css-scales.mjs` — built and wired into `pnpm ci`.**
      Freezes the off-scale CSS backlog per file and lets it only shrink:
      **85 files, 326 declarations** across raw `z-index` (bypassing the 15-step
      `--ws-z-*` scale), raw `border-radius` px, and raw `opacity` decimals.
      A ban would mean an unreviewable diff across every canvas surface and a
      gate that lands red gets reverted, so this is a ratchet — it fails when a
      file goes up, and equally when the baseline is *stale* after an
      improvement, which forces the recorded number down and locks the gain in.
      `node scripts/check-css-scales.mjs --update` after a deliberate reduction.

      Opacity is counted rather than token-checked because there is no opacity
      scale to check against yet (00-DISCOVERY §4.1 — the ink-tier scale is
      still unbuilt). Freezing the count stops it growing while that lands.

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
