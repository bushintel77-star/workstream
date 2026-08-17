# Production punch list

Living doc of work between today's state and gold-standard
end-to-end production. Owned alongside the codebase; tick items as PRs land.

- [WORKSTREAM-STATUS.md](docs/WORKSTREAM-STATUS.md) — consolidated done + roadmap
- [GAP-ANALYSIS.md](docs/GAP-ANALYSIS.md) — detailed audit

## P0 — Blocks first paying customer

- [x] **Persistence on Railway** — volume `api-volume` mounts at
      `/repo/apps/api/data`. Configured in the Railway dashboard.
- [x] **SQLite write-through journal** — `packages/db/src/sqlite-persist.ts`
      (Node 22 `node:sqlite`, WAL). In-memory store retained for jobs/tests;
      JSON snapshot retired from the hot path (first-boot import +
      `exportSnapshot` escape hatch). Railway:
      `CONSTRUCT_SQLITE_PATH=/repo/apps/api/data/store.sqlite3` on `api-volume`.
- [ ] **Single API instance** — keep one API replica on Railway while
      the JSON snapshot store is single-writer SQLite.
- [x] **Auth on (code)** — Clerk middleware + `<ClerkProvider>` + server-side
      `requireSignedIn()` gate on the dashboard. Opt-in via `CLERK_SECRET_KEY`;
      dev mode unchanged. Still needs Clerk secrets set on the web service
      (`CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- [x] **CORS_ORIGIN** on the API service → `https://web-production-3c194.up.railway.app`
- [x] **NEXT_PUBLIC_API_URL** baked into web Docker build + CI `--build-arg`.
- [x] **Build automation** — `pnpm run ci`, `pnpm build:docker`,
      `docker-compose.yml`, CI smoke tests,
      `workflow_dispatch` deploy. Local CI now includes mobile placeholder,
      portal Edge, typecheck, lint, and Vitest gates (`0369689`).
- [x] **Secret scanning** — gitleaks GitHub Action at
      [.github/workflows/gitleaks.yml](.github/workflows/gitleaks.yml).
- [x] **Stripe key validation on save** — `GET /v1/balance` round-trip wired in
      [apps/api/src/routes/settings.ts](apps/api/src/routes/settings.ts) via
      `validateStripeKey()`; rejects bad keys with Stripe's own error message.
- [x] **Sentry scaffold (code)** — API [`sentry.ts`](apps/api/src/lib/sentry.ts) +
      web [`instrumentation.ts`](apps/web/src/instrumentation.ts). **Human:** set
      `SENTRY_DSN` on both Railway services + `pnpm add @sentry/nextjs` on web when enabling.

## P1 — Quality + scale

- [ ] **Mobile distribution** — EAS build profiles and CI readiness checks are
      configured in `apps/mobile/eas.json`; preview produces an APK and production
      produces an iOS build + Android app bundle with auto-increment. **Human:**
      run EAS init and provide Apple/Google credentials before TestFlight / store
      submission.
- [x] **BullMQ + Redis (code path)** — worker in [`queue.ts`](apps/api/src/lib/queue.ts),
      pipeline enqueues when `REDIS_URL` set.
      **Human:** provision Upstash/Redis + enable the worker process.
- [x] **Litestream -> R2/B2 (SQLite-ready documented config)** — [`docs/litestream.example.yml`](docs/litestream.example.yml)
      + [`docs/LITESTREAM-SETUP.md`](docs/LITESTREAM-SETUP.md).
      **Human:** bucket credentials + sidecar after the SQLite migration.
- [x] **CI deploy job** — Railway auto-deploy on push to `main` is wired.
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
      and Vitest. Lint is `--max-warnings 0`; went red on main (pre-existing
      `set-state-in-effect` + unused-var warnings) and cleared in `48ee40e`
      (HomePlanner React-19 derived-state refactor + dead-code cleanup) —
      `pnpm run ci` exits 0 again.
- [x] **OpenTelemetry tracing** API → Anthropic / OpenAI / Mapbox; route spans
      use active context, token usage is attached to provider spans, aerial
      fetches are traced, and worker shutdown flushes telemetry.
- [x] **Real-user monitoring (web scaffold)** — [`instrumentation.ts`](apps/web/src/instrumentation.ts);
      needs DSN + `@sentry/nextjs` package.
- [x] **Audio compression** — mobile walkthrough uses `LOW_QUALITY` recording preset.
- [x] **Edge runtime** for `/portal/*` pages.
- [x] **Portal hero image** — `hero_url` from survey aerial on quote portal payload.
- [x] **Portal checkout production URLs** — `PORTAL_BASE_URL` defaults to
      the Railway web host, and quote/deposit amounts render with cents.
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

- [x] **TactileGround mesh + scale chip use hardcoded 1:100 board scale.**
      `TactileGround` now accepts a live `scaleM` (the fitted `boardWidthM`) and
      uses it for the mesh density + chip copy, matching `GroundRulerOverlay`
      and the dimension engine. The chip drops the "1:100" print denominator
      when `scaleM` is fitted (free plan); the Fit sheet still passes
      `sheetScaleDenom` for print-plot scale. Covered by the
      `measurement-integrity.test.ts` probe ("TactileGround mesh + chip read the
      fitted scale" describe block).
- [ ] Storybook for web primitives.
- [x] **Local docker-compose** — [docker-compose.yml](docker-compose.yml).
- [x] Bundle-size budget in CI — `scripts/check-bundle-size.mjs` measures the
      built web chunk tree against `scripts/bundle-size-budget.json`; `pnpm run ci`
      builds the web app and fails above the total or JavaScript budget.
- [ ] ~~PostgreSQL migration once the data model stabilises.~~ Superseded:
      SQLite WAL write-through journal (`packages/db/src/sqlite-persist.ts`) is
      now the durable target. CLAUDE.md: "Postgres. Stay on the JSON snapshot
      path until SQLite migration lands" — that migration has landed.
- [ ] Multi-region Railway deploy for HA.
- [x] **`moduleResolution: node` (node10) removal in TypeScript 7.** Source is
      [`tsconfig.node.json`](tsconfig.node.json) line 5, inherited by `apps/api`
      and `packages/{contracts,db,cad,domain}`. `tsconfig.node.json` already
      declares `moduleResolution: "node16"` and `pnpm typecheck` / `pnpm run ci`
      are green.
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
- [x] **`GardenViewpointStrip` and `VariationFilmstrip` double portal — fixed.**
      Both were migrated into FrameDrawers by `ebf1872` and both still wrapped
      themselves in `CameraChrome place="dock"`, so they escaped their drawer and
      floated on the drawing with a stale absolute offset. **Product decision:
      the drawers are the intended UX**, so the inner portals are dropped and
      both strips lay out in flow inside their drawer panel, exactly as
      `ArtboardStrip` was fixed in `7a3b7ed`. Their stylesheets no longer carry
      placement or surface — the drawer owns both.

      Probes updated to agree rather than routed around: `tilt-lens.spec.ts` now
      asserts the viewpoint strip is inside `frame-drawer-artboards` and reveals
      the drawer by **focus** before clicking a chip (the drawer opens on focus
      as well as hover, so this also covers §6 item 16), and
      `canvas-design-craft.spec.ts` asserts the filmstrip is inside
      `frame-drawer-variations` and that its parked box never overlaps the
      drawing.

- [x] **`meeting-pack.spec.ts` was stale — fixed.** Print lives in the View
      menu under client view (not a parked `headerTools` chip). Spec now opens
      the menu panel before asserting `meeting-pack-print`, and filters the
      command palette before Save scheme so the click cannot burn the full
      actionability timeout.
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
- [x] **`dashboard-filter-sort.spec.ts` was stale — rewritten.** It looked for
      `[class*="projectGrid"]` / `emptyState` and controls that `ebf1872` removed
      when `/home` became the editorial index. Now a single test against the
      live hairline-row markup: search empty/match, **sort order**, and Dialog
      delete + Undo. The sort leg filters to the run's own three seeds first,
      because the store holds unrelated projects and a bare
      `[class*="cardName"]` ordering assertion would be non-deterministic.
      Verified to fail when the expected order is reversed.
- [ ] ~~Quote line table header crowds at wide viewports.~~ Superseded: the
      `.row` grid at `quoteBuilder.module.css:278` is now
      `1fr 32px 56px 72px 88px 28px` — the column values this item described no
      longer exist. Re-open with fresh measurements if crowding recurs.
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

- [x] **React Compiler rule set — scoped follow-up.** The five React Compiler
      rules are now enforced at zero across non-canvas web surfaces. The canvas
      surface has an explicit ESLint scope override because its imperative camera,
      Three.js, worker, and reducer-sync patterns are deliberate and locked by
      `canvas-chrome-*` specs. This keeps the production gate strict without
      pretending those canvas patterns are ordinary React render logic; migrate
      them as separate camera-safe slices rather than widening the rule set.

- [x] **Google Fonts `<link>` → `next/font`.** `app/layout.tsx` now self-hosts
      Fraunces, Sora, IBM Plex Sans/Mono/Serif, Inter, and Architects Daughter
      through `next/font/google` variables. The old external stylesheet and
      preconnect tags are removed, preserving the existing studio font roles
      while avoiding render-blocking third-party font requests.

- [x] **`HandoffDesignStudio` keyboard-shortcut effect can go stale.** The
      global `keydown` effect (~:1763) cannot list `planOn` or `setFitSheetOn` in
      its dependency array because both are declared *below* it — naming them is
      a temporal dead zone reference (TS2448). The closure is correct at call
      time; only the dep array cannot see them, so the hook carries a documented
      `exhaustive-deps` suppression. Fixing it properly means reordering
      declarations in a 6,334-line component.

## Idle chrome coverage — resolved, ratchet now holds the line

`STUDIO-STYLING-AND-UX.md` §6 item 1 has two clauses: no fixed inventory bar,
**and** the idle view is mostly drawing. Only the first was ever probed, and a
width test passes happily while many small cards accumulate — no single element
is a bar, but a fifth of the plan was covered.

Union of painted chrome intersected with the board
(`e2e/canvas-checklist-s6.spec.ts`, item 1b). Ratchets both ways: a rise fails,
and a real drop fails too until the baseline is lowered, so the numbers below
cannot silently drift — they are the live `COVERAGE_BASELINE` in that spec.

| Mode | 2026-08-04 | Now | 
|---|---|---|
| Survey | 18.8% | **4.1%** |
| Sketch | 12.7% | **4.4%** |
| CAD | 9.4% | **2.3%** |
| Elevation | 0.1% | 0.1% |

All four ordered items are done; the spec's own changelog records each drop:

- [x] **Trace-dwelling modal off the optical centre.** `building-footprint-empty`
      (2.47%) was a 44px dashed glass card centred on the artwork that also
      swallowed clicks on the plan beneath. Now paper-haloed ink with no surface
      of its own, projected to the lot's top edge, `pointer-events: none` in the
      read-only variant.
- [x] **`SELECT` chip anchored to its selection.** `selected-shape-readout`
      renders through `CameraChrome place={{ kind: "project", pct: selected }}`,
      so it tracks the object instead of floating in whitespace.
- [x] **Dock the two Vicmap clusters into the frame band.** 4.57% removed. They
      had been escaping their `FrameDrawer` via `position: absolute` plus a
      nested `CameraChrome`; `placement="header"` keeps them in the drawer,
      which handles overflow with its own scrollbar. Two corner clusters kept —
      a single full-width strip regresses the lane collision the layout was
      written to fix (00-DISCOVERY §6).
- [x] **Survey checklist has a permanent home.** The 7.57% occupier is now
      reachable from a "2/5" progress pill in the frame band, which does not
      paint over the board. Collapsed by default (§6 item 7).
- [x] **`PhaseManagerChip` floating over the board** (0.73%) folded into the
      header left zone as `HeaderPhaseSelect`.

Remaining survey contributors are `utility-honesty-footer` (1.8%),
`header-context-strip` (1.8%) and the Vicmap chips' residue (0.5%). Both of the
first two are honesty copy rather than controls, so removing them is a content
decision, not a layout one — leave them unless product wants the disclosure
moved into the frame band.

Elevation reporting 0.1% is **unverified, not clean**: 13 painted chrome
elements were found but none intersected the board. Plausible, since its chrome
sits in the frame band — confirm before trusting it.

## Canvas a11y — resolved

Two items from the 2026-08-05 a11y pass that were UX calls. Both resolved
2026-08-09 after product direction: the operator's first screen after entering
an address is the survey canvas — that IS the main content. Quote is a mode
within the canvas, not a separate page.

- [x] **`CompactModeNav` mode-switcher used `role="menu"`/`role="menuitem"`
      without arrow-key roving.** Fixed: replaced `role="menu"`/`role="menuitem"`
      with `role="list"` + plain buttons + `aria-disabled`, matching the
      full-width `<nav>` + buttons + `aria-current="page"` pattern. The overflow
      tray is now a list of workflow-stage buttons, not a menu of commands.
      Also added `aria-keyshortcuts` (digit 1–6) to both the full-width and
      compact current-mode buttons.
- [x] **Exactly one `<main>` landmark in the canvas surface.** Fixed: wrapped
      `HandoffDesignStudio` in `<main aria-label="Design canvas">` on the
      project page (`app/projects/[id]/page.tsx`). Demoted `QuoteBuilder`'s
      `<main>` to `<section aria-label="Quote">` — it's a mode within the
      canvas, not a separate page.

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
- [x] **`setSort` (`DashboardProjects`) — was a live defect, not inert code.** The
      sort comparator ran (name / cost / activity) but no control called
      `setSort`, so sorting was permanently locked to "activity". **Fixed**: a
      `KitSelect` (Recent / Name / Cost, `aria-label="Sort projects"`) now sits
      in the search row and drives the existing comparator. Covered by
      `dashboard-filter-sort.spec.ts`, which filters to the run's three seeds so
      name-order is deterministic against a shared store.
- [x] **`PointerMarkSettings` is mounted.** A finished 91-line component
      with its own stylesheet, `data-testid="pointer-mark-settings"`, full
      `role="listbox"` / `aria-selected` a11y and passing unit tests. Nothing
      imported it, so `_setPointerMarkPreview` (its `onPreview`) and the dropped
      `savePointerMarkId` import (its `onMarkId`) had no caller and the drawing
      cursor could never be changed. **Fixed**: summoned from Cmd+K
      ("Pointer mark…"), which is what `STUDIO-STYLING-AND-UX.md` §6 item 9
      prescribes — the fixed budget is the *top ribbon*, and item 10 names
      Cmd+K as a sanctioned discovery surface, so this needed no new product
      call. The panel is viewport-anchored frost, so it portals through
      `CameraChrome place={{ kind: "frame" }}` (gate B) like `AssetPanel`.
      Kept probe: `e2e/pointer-mark-settings.spec.ts` — asserts the sheet
      paints, the choice persists across reload, and that it never lands inside
      `zoom-world`. Verified red when the mount is forced closed, because the
      reachability gate by its own admission cannot see an import that renders
      behind an always-false condition.
- [x] **`_trade`** — `solveLiveTradeEstimate` now feeds the Live BOM HUD and shows
      the matched-line ratio plus trade material value, with explicit AI-estimated
      fallback copy when no hub match exists.
- [x] **`BuildableAreaOverlay` was gated behind `buildableAreaOn` which was never
      set to true.** The overlay was fully implemented (setbacks, TPZ, easement
      exclusion) but had no UI toggle — `ui.buildableAreaOn` was initialized
      `false` and nothing ever set it to `true`. **Fixed**: added a "Buildable
      area envelope" toggle in `LayersPanel` (`data-testid="layers-buildable-area-toggle"`)
      and a Cmd+K command "Buildable area envelope" that toggles the flag.
- [x] **Canopy image scan was disabled (`autoCanopyScan={false}` hardcoded).**
      `ingestCanopyImage` and `proposeFromCanopyImage` were wired but never
      triggered because `AerialSlot`'s auto-scan effect was permanently gated
      off. **Fixed**: added a `canopyScanRequest` nonce to UI state and a
      Cmd+K command "Scan canopy from aerial" that increments it. `AerialSlot`
      watches the nonce and runs `runCanopyScan` once on change — manual
      trigger, no auto-firing on every aerial load.
- [x] **Five dead components deleted (2026-08-05 feature audit).**
      `QuoteSurface` (superseded by `LiveCostRail`), `PhaseManagerChip`
      (superseded by `HeaderPhaseSelect`), `CanvasAutosaveChip` (superseded
      by `UnifiedSaveStatus`), `CanvasHeaderRail` and `CanvasTopBorder`
      (both superseded by `Tier1TopBar`). All were exported, never imported,
      and had live replacements. Deleted with their orphan CSS modules.
- [x] **`MarginStrip` deleted (2026-08-05 feature audit).** Was wired
      pre-`8661779`, dropped in the "restore DNA chrome" consolidation. Its
      function (bottom strip with history/state/actions/hint/stamp/legal) was
      absorbed by individual components — `CadPlanBoard` renders its own
      honesty footer, `SketchDock` has undo/redo, `Tier1TopBar` handles the
      top bar. No clear home remained; deleted per the "don't add backwards-
      compatibility shims for removed code" rule.
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
- [x] **`CanvasMeasureSummary` deleted — superseded, not merely unmounted.**
      "Small, stage-aware measurement card; click for the full live ledger."
      It could not ship as designed: a 236px frosted card at `position:
      absolute; right: 14px; top: 12px` is idle chrome on the drawing, and the
      §6 item 1b ratchet allows only +0.75pp of jitter over a 4.1% survey
      baseline — the card is comparable in area to the Vicmap chip cluster that
      was removed for costing 2.09%. Relocating it does not help: the
      `kind: "dock"` placement still paints over the board (that is what
      `header-context-strip` costs 1.8% for), and a persistent readout in the
      frame band is the new top-level element §6 item 9 exists to refuse.
      Meanwhile `live-measures-rail` already serves measurements on demand via
      Cmd+K, satisfying items 10 and 13. So this is the `QuoteSurface` →
      `LiveCostRail` situation, and the rule is to delete rather than keep a
      shim. Removed with its helper, that helper's four tests and its orphan
      stylesheet; nothing live imported `buildCanvasMeasureSummary` (the
      previous note here implied otherwise — only the unmounted card and its
      own test did). Four vacuous `toHaveCount(0)` assertions naming the dead
      testid went too: an assertion for a testid that cannot exist is passing
      theatre, which is the failure mode this whole section was written about.

- [x] **`scripts/check-feature-reachability.mjs` — built and wired into
      `pnpm ci`.** Walks the canvas feature folders, collects PascalCase
      component exports, and fails when one has no import, JSX tag, call or
      barrel re-export anywhere else. 121 components scanned, 3 allowlisted
      (each entry carries a reason and an item above). The allowlist is a
      ratchet: the gate also fails on a **stale** entry, so wiring a component
      up forces its exception to be removed.

      Two notes on its limits, kept honest rather than hidden. It found
      `StudioCoachMarks` and `CanvasMeasureSummary` that ESLint could not see
      (the latter is now deleted, the former still allowlisted),
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
      **78 files, 289 declarations** (down from the original 85 files/326 —
      a follow-up session tokenized the Gold Standard Studio surfaces and the
      Home landing-page redesign that had regressed the count; see "Growth
      Studio / Subsurface Studio follow-up" below) across raw `z-index`
      (bypassing the 15-step `--ws-z-*` scale), raw `border-radius` px, and
      raw `opacity` decimals.
      A ban would mean an unreviewable diff across every canvas surface and a
      gate that lands red gets reverted, so this is a ratchet — it fails when a
      file goes up, and equally when the baseline is *stale* after an
      improvement, which forces the recorded number down and locks the gain in.
      `node scripts/check-css-scales.mjs --update` after a deliberate reduction.

      Opacity is counted rather than token-checked because there is no opacity
      scale to check against yet (00-DISCOVERY §4.1 — the ink-tier scale is
      still unbuilt). Freezing the count stops it growing while that lands.

## Growth Studio / Subsurface Studio follow-up (2026-08-14)

A second session ran `pnpm run ci` for the first time against the
uncommitted Growth Studio + Subsurface Studio work (see
[docs/GOLD-STANDARD-STUDIO-HANDOVER.md](docs/GOLD-STANDARD-STUDIO-HANDOVER.md)
for the full write-up) and found one real correctness bug plus two CI
failures, all now fixed:

- [x] **Wrong catalogue source in both new 3D studios.** `growthStudioData.ts`
      and `subsurfaceStudioData.ts` resolved `CatalogPlacement.symbol_id`
      against `CURTIS_DESIGN_ASSETS` (a small hand-authored subset) instead of
      `CURTIS_CATALOG_SYMBOLS` (the full served catalogue — size ladder +
      design library + Temaki/PlanZV/Osmic/Wikimedia/Open Crop packs; see
      `packages/domain/src/catalog.ts`). Any placement using a size-ladder
      tree (`curtis-tree-*`/`curtis-hedge-*` — arguably the most commonly
      placed generic symbols) silently vanished from both studios: Growth
      Studio rendered "No planting on this board yet" with real planting on
      the board, and Subsurface Studio's lighting-fixture detection missed
      fixtures from those packs. **Fixed**: both files now import
      `CURTIS_CATALOG_SYMBOLS`, matching the pattern the operator canvas
      already uses (`itemHeight.ts`, `studioAiEngine.ts`,
      `AssetPanelExpanded.tsx`). Verified end-to-end against a freshly seeded
      project.
- [x] **`web:check-handoff-colors` failed on the new Gold Standard Studio
      files.** `goldStandardStudio.module.css` (a legitimate token source of
      truth) and several landing-page files had raw hex outside the
      allowlist. Added the shared token file to the allowlist and tokenized
      the rest against new root tokens in `globals.css`.
- [x] **`web:check-css-scales` failed on every new/touched Gold Standard
      file.** Extended `goldStandardStudio.module.css` with a shared 5-step
      z-index scale and a pill-radius token, reused the existing global
      `--r-*` scale where a raw value matched a step exactly, and added small
      local escape-hatch custom properties for one-off values. Net result is
      a genuine reduction, not a gamed ratchet — see the updated
      `check-css-scales.mjs` entry above.

Also found, **confirmed pre-existing on committed history and left
unfixed** (out of scope for that session; each file's last commit predates
any work in it — 2026-07-28 to 2026-08-12):

- [ ] **`apps/api/src/lib/mapbox.test.ts`** expects `z=20` in the aerial URI;
      current code produces `z=19`. Same mismatch recurs in
      `apps/api/src/routes/contract.test.ts` ("covers geocode preview, search,
      and validation contracts").
- [ ] **`apps/api/src/routes/contract.test.ts`** — "smoke-tests project-scoped
      read routes across survey outputs and ops tabs" times out at 5000ms.
      May be related to the above or a separate, genuine slow-path/hang.
- [ ] **`apps/web/.../toolDock/toolChips.test.ts`** — `buildToolChips` is
      expected to return `trace`/`lock`/`grid`/`service` tool chips; the
      current implementation returns a different set (`select, add, paint,
      zone, path, measure` and no `service` chip even when authoring). Either
      `toolChips.ts` was refactored without updating its test, or the test
      itself is stale — needs someone who owns the tool-dock chip set to
      adjudicate which is correct.

Run `pnpm test` to reproduce; these 5 failures (3 files) are the only ones
in the full suite as of this entry.

## Production placeholders — hardcoded data shipping in live paths

Found 2026-08-05. Each is a stable interface returning canned data today,
with a documented path to a real adapter. None block first paying customer
(the quotes are honest about what's behind them), but all need product
investment before scale.

- [x] **Claude model names hardcoded** — `DESIGN_MODEL`, `AUDIT_MODEL`,
      `VISION_MODEL`, `DICTATION_MODEL` were `const` strings in `claude.ts`
      and `dictation.ts`. **Fixed**: moved to env vars
      (`CLAUDE_DESIGN_MODEL`, `CLAUDE_AUDIT_MODEL`, `CLAUDE_VISION_MODEL`,
      `ANTHROPIC_VERSION`) with current values as defaults. Models can now
      be swapped without redeploying code.
- [ ] **Supplier price feeds (`suppliers.ts`)** — `fetchPrices()` returns
      canned `DEV` prices for all 7 suppliers (Bunnings, Boral, Holcim,
      Andersons, ANL, Online Plants AU, Speciality Trees). The
      `SUPPLIERS_LIVE` flag is checked but no real adapters exist. Every
      quote that touches supplier pricing uses these hardcoded rates.
      **Production replacement**: trade-account scraper or PDF rate-sheet
      OCR ingestion via Claude.
- [ ] **Melbourne trade catalog (`live-trade-sourcing.ts`)** —
      `MELBOURNE_TRADE_CATALOG` is a static array of ~30 hardcoded
      wholesale offers (Dinsan, Plantmark, Warners, Speciality Trees) with
      fixed prices and `hubKmFromPrahran` distances. Comment: "Not live
      Plantmark/Dinsan APIs (Stage 2)." The `solveLiveTradeEstimate`
      function calculates against this catalog but the result is never
      displayed (see `_trade` above). **Production replacement**: live
      nursery trade APIs or periodic catalog sync.
- [ ] **Plant biogenic carbon coefficients (`carbon.ts`)** — 7 plant SKUs
      are marked `source: "stub"` — rough biogenic uptake estimates. The
      quote footer discloses this: "Plant biogenic uptake is a lifecycle
      stub — replace with EPDs when supplier data is available."
      **Production replacement**: Environmental Product Declarations from
      nurseries/suppliers.
- [ ] **Polygon difference (`geometry.ts`)** — `subtractPolygon()` returns
      the outer ring unchanged; the inner polygon (house) is ignored.
      Comment: "Implementing a full polygon-clipping (Vatti,
      Greiner-Hormann) is meaningful work." Survey-job works around this
      by using the title polygon with house-as-inner-ring. **Production
      replacement**: proper polygon clipping algorithm (martinez, vatti,
      or a library like polygon-clipping).
- [ ] **Survey utilities stub (`preemptive-risk.ts`)** —
      `// Utility stub - reserved when survey utilities land.` The function
      returns early without checking for underground utilities. **Production
      replacement**: survey utility detection when the survey utilities
      feature lands.
- [x] **Print line-weight scaling (`lineWeight.ts`)** —
      `TODO(print): map the ladder through sheetScaleDenom so 1:100 and
      1:200` — line weights don't scale with print zoom. Already documented
      as P3 above. **Production replacement**: implement the scale-aware
      ladder.

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

## Intelligent Canvas — product specification (Gold Standard 2026, separate track)

Full product spec supplied 2026-08-14, kept verbatim as the source-of-truth
brief for this track. Three concept mockups were supplied alongside it —
copied into the repo at
[docs/design-spec/concept-mockups/](docs/design-spec/concept-mockups/README.md),
with a file-by-file mapping to the specific written feature each one
illustrates. **The mockups are DNA/visual-tone references, not literal specs
to pixel-match** — same status as the Stitch export referenced in
`GOLD-STANDARD-STUDIO-HANDOVER.md`; this text spec is the literal one.
Cross-check against build status below before treating any phase as shipped.

> ## 1. VISION & PHILOSOPHY: "THE DRAWING IS THE PRODUCT"
> Workstream is an AI-native, professional workspace for landscape architects. The interface is a **Zero-Chrome** environment where structural UI frames are purged to ensure 100% focus on the spatial truth of the landscape design.
>
> ---
>
> ## 2. ARCHITECTURAL MANDATES (THE CODE LAW)
> - **Viewport**: 100% full-bleed. `overflow: hidden` on root.
> - **Canvas**: Absolute `inset-0`. The Three.js/WebGL context is the primary surface.
> - **Instruments**: No sidebars or headers. All UI must be floating **Glass Cards** (`bg-[#1E2329]/70`, `backdrop-blur-md`, `rounded-2xl`).
> - **Typography**:
>   - `Space Grotesk`: Mandatory for technical, numeric, and coordinate data.
>   - `Inter`: Mandatory for UI labels, buttons, and inputs.
> - **Tokens (Studio Dark)**:
>   - **Canvas Base**: `#101418`
>   - **Primary (Gold Standard)**: `#fbbf24` (Used for active, compliant, and verified states).
>   - **Truth Anchor (Signal Blue)**: `#0030CF` (Used for boundaries, (0,0,0) origin, and easements).
>   - **Conflict (Strike Alert)**: `#ef4444` (Used for utility and root zone collisions).
>
> ---
>
> ## 3. THE WORKFLOW STAGES
>
> ### STEP 0: SITE TRUTH (Acquisition)
> - **Objective**: Establish the high-precision digital twin.
> - **Features**:
>   - **Geo-Located Search**: Address input triggers a Mapbox "Fly-To" with 1:1 parcel extraction.
>   - **Automated Pipeline**: Staggered extraction of VicMap Survey Data, Title Photos, and Legal Easements.
>   - **Local Origin Lock**: Anchor a Signal Blue (0,0,0) crosshair to the primary survey peg.
>
> ### PHASE 1: SKETCH STUDIO (Creative)
> - **Objective**: Immersive 2D/3D creative drafting.
> - **Features**:
>   - **Infinity Zoom**: A fractal dot-grid background that maintains rhythm across all zoom levels.
>   - **Floating Tool Ribbon**: A minimalist vertical ribbon for professional drafting (Polyline, Curve, Area).
>   - **Asset Discovery HUD**: An Apple-style "Fan-Out" carousel for botanical and hardscape libraries.
>   - **AI Auto-Placement**: Double-click deployment that "ghosts" assets into positions optimized for solar exposure and root spacing.
>
> ### PHASE 2: CAD OPERATOR (Technical)
> - **Objective**: Detailed construction documentation and subsurface visualization.
> - **Features**:
>   - **Vertical Truth**: 3D Tilt and Elevation Slices with high-precision technical annotations.
>   - **Subsurface Engine**: 3D volumetric rendering of Gas, Water, and Electrical lines.
>   - **Hydrological Pulse**: Live GPM (Gallons Per Minute) and pressure-drop calculations for irrigation and drainage lines.
>   - **Strike Alert Engine**: Real-time collision alerts when design geometry intersects utility volumes.
>
> ### PHASE 3: CLIENT PROPOSAL (Intelligence)
> - **Objective**: Business logic and presentation.
> - **Features**:
>   - **Presentation Lens**: High-fidelity storytelling mode that hides technical "Spatial Truth" but keeps "Live Intelligence" data.
>   - **Itemized Fit-Sheet**: Live-synced quotation and material stock pulse linked to the canvas.
>   - **Comparison Lens**: Side-by-side split-view for design iterations.
>
> ### PHASE 4: BUILD PACK (Handoff)
> - **Objective**: Contractor-ready export.
> - **Features**:
>   - **Compliance Audit**: Automatic verification of design against local regulatory offsets.
>   - **Contractor Bundle**: Generation of high-precision CAD layers and spec sheets.
>
> ---
>
> ## 4. MOBILE FIELD BRIDGE (On-Site Execution)
> - **Environment**: 100% Camera feed with high-precision AR overlay.
> - **Staking Logic**: Digital "Staking Chips" (#fbbf24) anchored to physical GPS/RTK ground coordinates.
> - **Subsurface Ghosting**: Visualise underground utilities as translucent 3D volumes in the camera feed.
> - **Strike Alerts**: High-contrast Red alerts for site workers when digging near verified utilities.
>
> ---
>
> ## 5. SPATIAL GOVERNANCE & INTEGRATION
> - **Data Integrity**: All imported assets must map to the `SpatialObject` TypeScript schema.
> - **Hydraulic Isolation**: The (0,0,0) Site Origin must be strictly excluded from active hydraulic run calculations.
> - **Billboarding**: All Meta Chips and labels must always face the viewport camera regardless of the 3D tilt.
>
> *Directive: The drawing is the product. Strip the chrome. Execute exactly as spec'd.*

### Build status against this spec (2026-08-14)

- [x] **§2 tokens** — the original Studio Dark values were live through
      2026-08-17, then **superseded by the Studio Paper + Signal Blue pivot
      (PR #189)**: `#F4F4F4` canvas, `#3D5AFE` primary accent, `#0030CF`
      truth data stroke, `#C41E1E` crimson conflict-only
      (`docs/GOLD-STANDARD-2026-TOKENS.md` §3 migration table). Web
      `--gs-*` + `colorTokens.ts`/`color-tokens.css` mirrors are reconciled
      and CI-gated. Mobile `packages/ui/src/tokens.ts` was reconciled in
      the 2026-08-17 mobile-token PR: surfaces/ink flip to Paper, accent to
      the Signal Blue ramp, `studio.gold*`/`signalBlue*` re-point exactly as
      web's `globals.css` dialect aliases (`gold → #3D5AFE`,
      `signalBlue → #0030CF`, `conflict → #C41E1E`), IBM Plex → Space
      Grotesk/Inter, plus an inverted-screen ink ramp
      (`ink.invertedSecondary/Tertiary`) for the deliberate charcoal field
      screens (grid-soil, recording). Remaining follow-up: mobile fonts are
      not yet bundled (expo-font + assets), and the unmounted
      `MobileFieldBridge` AR component still carries dark-era literals —
      both tracked below.
- [x] **§3 Step 0 Site Truth** — landing page (`apps/web/src/app/page.tsx` +
      `landing.module.css`) has the geo search, staggered pipeline-status
      list, and a Signal Blue (0,0,0) origin crosshair. Real VicMap/title
      ingestion already exists server-side (`apps/api/src/lib/vicmap.ts`,
      `docs/SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md`) but is not yet wired to
      this specific landing flow.
      Concept reference: [concept-02-solar-subsurface-analysis.png](docs/design-spec/concept-mockups/concept-02-solar-subsurface-analysis.png)
      (coordinates/elevation panel).
- [~] **§3 Phase 1 Sketch Studio** — partially shipped, split across two
      surfaces rather than one: `HandoffDesignStudio` (blush-frost system,
      `docs/STUDIO-STYLING-AND-UX.md`) has the real 2D drafting tools
      (polyline/curve/area, infinity-zoom-style pan/zoom); the mobile
      Discovery HUD fan-out carousel and AI-optimized ghost-and-snap
      placement (gold glow = matches an AI suggestion, Signal Blue anchor
      crosshair) shipped this session in `apps/mobile` (see follow-up
      section above). Not yet unified into one Gold-Standard-dark surface —
      that's the "second, intentionally distinct surface family" boundary
      documented in `docs/GOLD-STANDARD-STUDIO-HANDOVER.md`.
      **Update (e305e2d)**: the unified WebGL studio
      (`apps/web/src/components/canvas/webgl/`) is now the default canvas
      mount with fused ortho↔persp navigation, shared ink
      (`FusedSketchLayer`: freehand + extrude-to-mass, terrain-draped), and
      the legacy isolated `/projects/[id]/sketch` route was deleted — the
      unified studio is the only sketch environment (deep links land via
      `?tool=sketch`). Still missing on the GL surface: the floating tool
      ribbon (Polyline/Curve — planned next; Area routes to
      `SpatialObject`/`outline_pct`, not a stroke). ~~The Asset Fan-Out
      carousel~~ — SHIPPED on the GL surface (`AssetFanOutDock` +
      `AssetPlaceLayer` + `assetPalette.ts`: curated TYPE_TO_SYMBOL palette
      with real catalog botany, gold active card, armed hint pill, half-metre
      grid snap, store placements with client-derived items, autosave
      round-trip e2e-verified). The **flora ring** also shipped on the GL
      surface (`floraWorld.ts` + `FloraRingLayer`: plant cards open ≤3
      ranked candidates at the click — project lat/lng + live sun-scrubber
      shade grid, TPZ/canopy guard on accept, sun/exposure chip = the Solar
      Impact readout). Soil/aspect soft filters remain SVG-only for now.
      Concept references: [concept-01-cad-operator-studio.png](docs/design-spec/concept-mockups/concept-01-cad-operator-studio.png)
      (floating tool ribbon, asset carousel, meta chips) and
      [concept-03-auto-placement-logic.png](docs/design-spec/concept-mockups/concept-03-auto-placement-logic.png)
      (AI Auto-Placement ghost + Confirm/Cancel — the direct source for the
      mobile Ghost & Snap flow shipped this session).
- [x] **§3 Phase 2 CAD Operator** — Subsurface Studio
      (`/subsurface-studio/[id]`) ships the real Subsurface Engine (BYDA
      gas/water/power volumes, `pathsCross` conflict/Strike-Alert detection)
      and Hydrological Pulse (real GPM + pressure-drop via
      `summarizeIrrigationZones`/`assessLvRuns`, not fabricated). Vertical
      Truth shipped on the unified WebGL studio (`60a2295` → `e305e2d`):
      3D tilt via the fused ortho↔persp camera (spring physics, no hard
      cut), terrain heightmap from spot levels (IDW, `terrainMath.ts` —
      shared bit-identical sampler), ink drapes over terrain as the camera
      tilts (per-vertex Y lerp on `viewBlend`), and the elevation-slice
      instrument (`ElevationSliceLine` + `SliceProfileCard`: draggable
      axis-aligned cut + live SVG profile with ×3 vert-exaggeration, datum,
      Δ-real readouts). **Terrain follow-ups now shipped**: drainage
      overland-flow (D8 routing on the mesh's own 60×60 grid —
      `flowField.ts`/`DrainageFlowLayer`/`DrainageFlowCard`: pulse-animated
      stream network, ponding markers, Σ GPM + max kPa telemetry from the
      wired `computeHydraulics()` results) and cut/fill earthworks against
      extruded sketch pads (`cutFill.ts`/`EarthworksLayer`/`EarthworksCard`:
      committed pad masses finally render outside sketch mode, red/gold
      cut/fill zone patchwork on the terrain, per-pad + total m³ readouts,
      ÷3 real-metre convention — no schema change, `extrude_height_m` reused
      as the design surface). Also fixed three pre-existing Z-mirror bugs
      where the `[-π/2,0,0]` rotation N/S-mirrored the terrain relief, the
      building mass, and the extrude preview vs the ink/slice samplers.
      **Gap 3 (SVG→WebGL layer port) now shipped**: the working-drawing
      dimension ring (`DimensionLayer` — SVG `outsideDims` engine reused
      as-is, line work as one `<Line segments>` draw call, constant-px
      `<Html>` label chips), the interactive measure tape
      (`MeasureTapeLayer` + `snapWorld.ts` — draped, ephemeral, Esc clears,
      mutual exclusion with sketch mode), and draw-time snap visuals
      (`snapWorld.ts` close→vertex→45° ladder + kind-coloured SnapMarker in
      `FusedSketchLayer`). The 2D `SunCastOverlay` shadow polygons are
      retired as superseded — the WebGL studio casts real VSM shadows from
      the real sun. With the dimension ring, in-scene CAD callouts now exist
      on the GL surface — the old "panel readouts only" caveat is closed.
      Concept reference: [concept-02-solar-subsurface-analysis.png](docs/design-spec/concept-mockups/concept-02-solar-subsurface-analysis.png)
      (subsurface legend + Strike Alert chip — matches what's built; the
      Solar Trajectory time-of-day scrubber in that same image is built on
      the WebGL studio as the real-sun `Sun · Real Shadows` scrubber, not
      on Subsurface Studio).
- [ ] **§3 Phase 3 Client Proposal** — Presentation Lens, itemized live
      fit-sheet quotation sync, and Comparison Lens split-view are **not
      built** on the Gold Standard surface. (The blush-frost studio has its
      own fit-sheet/quote surfaces; not the same thing as this spec's lens.)
      **Update**: the itemized fit-sheet IS now built on the WebGL studio
      (`fitSheet.ts` + `FitSheetCard` — live itemized quotation + material
      stock pulse chips, client-side estimate + trade-hub matching, zero
      fetch, live-synced to canvas geometry by construction; "Quote" chip,
      open by default when placements exist). **Comparison Lens split-view
      is ALSO built now** (`SplitViewLens.tsx` + `FusedCamera
      viewBlendLocked` + the rail's Split tool: locked ortho plan | live
      perspective, two full canvases with linked cameras via one shared
      rig — the dual-screen CAD/sketch workflow inside the one studio;
      e2e-verified `webgl-split-view.spec.ts`). Still open under Phase 3:
      Presentation Lens polish only.
- [ ] **§3 Phase 4 Build Pack** — compliance audit + contractor CAD/spec
      bundle export on this surface: **not built**.
- [ ] **§4 Mobile Field Bridge (AR)** — **explicitly not built, by design
      decision, not oversight.** Needs live RTK-GPS + device camera
      (WebXR or native AR). A fake AR camera overlay with invented
      "RTK FIXED <12mm"-style precision would be dishonest telemetry —
      see `docs/GOLD-STANDARD-STUDIO-HANDOVER.md`'s "Explicitly not built"
      section. Do not build this without a real GPS/AR data source.
- [x] **§5 Data integrity / hydraulic isolation / billboarding** — real
      `SpatialObject` schema already exists
      (`packages/contracts/src/schemas/orchestration.ts`); the (0,0,0) site
      origin is a pure visual anchor with no hydraulic role in either
      studio's math; floating labels in both Growth Studio and Subsurface
      Studio already billboard toward the camera (`SpeciesSymbol`-style
      HTML overlays positioned per-frame from 3D world coords, not embedded
      in the 3D scene as flat geometry).

## Human-only checklist (not code)

| Action | Command / where |
|--------|-----------------|
| Clerk on Railway | Runbook Section 1: API `CLERK_SECRET_KEY`, web `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `AUTH_REQUIRED=true` |
| API base/CORS | Runbook Section 1: `PUBLIC_API_URL=https://api-production-a8ff1.up.railway.app`, `CORS_ORIGIN=https://web-production-3c194.up.railway.app` |
| Sentry DSN | Runbook Section 3: set `SENTRY_DSN` on both Railway services |
| Redis worker | Runbook Section 2: `REDIS_URL` + enable the worker process |
| Stripe / portal / OTEL | Runbook Section 6: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WORKSTREAM_PORTAL_SECRET`, `OTEL_EXPORTER_OTLP_ENDPOINT` |
| EAS project | Runbook Section 5: `cd apps/mobile && npx eas-cli init` plus store credentials |
| Litestream | Runbook Section 7 after SQLite migration |
| Branch protection | Runbook Section 8, GitHub repo Settings (Pro plan) |

## Sandbox-blocked actions (need the user)

- Set Railway service variables from the runbook, then redeploy where noted
- Valid Apple / Google credentials for EAS submit
