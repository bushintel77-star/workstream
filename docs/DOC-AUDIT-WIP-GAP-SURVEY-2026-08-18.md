# Doc audit — WIP / gap / open-decision survey (2026-08-18/19)

Audit of the repo documentation for the master WIP/gap survey. Sources cited
inline by file name. Doc taxonomy used below (per `ONBOARDING.md` §"Role" table):
**binding** = GOLD-STANDARD trio, **living** = OUTSTANDING/roadmap/feature list,
**historical** = handovers/CHANGES/etc. Contradictions are listed with both
sides; where a doc self-labels its own correction, it is noted.

---

## 1. Current state (2026-08-18/19)

Per `docs/SESSION-HANDOVER-2026-08-18-CONTINUATION.md` (the designated "current
handover"), `ONBOARDING.md`, and `OUTSTANDING.md`:

- **`main` = `e6da28e` at handover write time** (clean except two pre-existing
  working-tree mods: `.devin/mcp_config.json`, `apps/web/next-env.d.ts`).
  Later same-day commits landed after the handover: photo-trace capstone
  `0b37127` + inspector/marquee/sketch→CAD WebGL wiring `a6f6646`, `78864ae`
  (`ONBOARDING.md` §3, §5; `OUTSTANDING.md` ranked-priorities note).
- **PRs #192–#201 merged** this session: mobile Studio-Paper tokens (#192),
  mobile web preview bundles / Sentry platform split (#193), vendored IBL HDR
  crash fix (#194), perimeter tab chrome (#196), camera pointer-interaction
  fix (#197), live-capable e2e harness (#198), aerial underlay retired + quiet
  auto-trace (#199), native vegetation EVC kind (#200), hydrate schema fix
  (#201) — `SESSION-HANDOVER-2026-08-18-CONTINUATION.md` §"Shipped this session".
- **Live prod healthy**: web + api `/readyz` 200; Vicmap boundary auto-trace
  verified live (`POST /boundary/auto-trace` → 201, `source_kind: vicmap`);
  keyless hydrate returns planning/bushfire/contour/native_vegetation/water_corp
  for the Heathcote site (real EVC 20 polygons) — same handover §"Live-verified".
- **Photo-trace elevation capstone shipped and committed on `main`**
  (`0b37127`): pinned photo = frozen calibrated camera frame, reference-line
  calibration, boundary-snap reconciliation, site-photo gallery, photo
  elevation sheet in `DesignCanvas.photo_elevations` (`OUTSTANDING.md` P1;
  `docs/CAMERA-STATE-MACHINE.md`; `ONBOARDING.md` §3).
- **WebGL sketch→CAD + selection now native**: rail "Tidy" (confidence-scored
  ghost review) and one-click convert mint real `LandscapeFeature`s; unified
  selection state + tool-gated marquee (`AGENTS.md`; `ONBOARDING.md` §5).
- **All local gates green at handoff**: typecheck 13/13, lint `--max-warnings 0`,
  vitest (290 files / 1818 tests, 6 live skips), affected e2e incl.
  `webgl-asset-fanout`, photo-flow, terrain, split-view, a11y-axe
  (`SESSION-HANDOVER-2026-08-18-CONTINUATION.md` §"State at handoff";
  `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` §1).
- **GitHub Actions still frozen** (account billing hold) → CI never runs on
  GitHub's runners; Railway git-linked builds fail silently → deploys go via
  `railway up --detach` CLI. Single outstanding verification: dispatch CI on
  `main` once the card clears (handover §"Known issues"; `OUTSTANDING.md` P1;
  `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` §2).
- **Prod auth is still `dev-user`**: `AUTH_REQUIRED=false`; Clerk keys not
  provisioned (`PRODUCTION.md` §"Current auth mode"; `OUTSTANDING.md` human
  checklist).

---

## 2. Open product decisions (explicitly flagged, unresolved)

| Decision | Flagged by | Status of the decision |
|---|---|---|
| **SVG studio permanence**: permanent frozen `?svg=1` fallback vs transitional until WebGL Phase 1, then retired | `docs/UI-PARITY-AUDIT-2026.md` §6 blockquote ("flagged 2026-08-18 docs audit, not resolved"); `ONBOARDING.md` §1 blockquote ("Product must pick (a) or (b). Do not build SVG features or delete the SVG studio until this is decided"); `AGENTS.md` "Migration status" | OPEN. Both readings still coexist in docs (see §5) |
| **Calibration model for photo-trace** — "calibration UX decision first" | `docs/SESSION-HANDOVER-2026-08-18-CONTINUATION.md` ranked #2; `HANDOVER-NEW-CONTEXT.md` §8 ("Calibration model is undecided"); `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` #4 | RESOLVED in the shipped capstone: **reference-line calibration** (`docs/CAMERA-STATE-MACHINE.md` "Decisions made"; `OUTSTANDING.md` P1 "Calibration UX (product decision): reference-line calibration"; `ONBOARDING.md` §3). The current handover's ranked list is stale on this — see §5 |
| **Cross-studio selection sync** — "do not build a runtime bridge without a product decision" | `AGENTS.md` "WebGL selection state" | OPEN (explicitly gated behind a product decision) |
| **Bulk-edit of marquee selection** — deferred until bulk-edit lands; inspector shows read-only many-refs summary | `AGENTS.md` "WebGL selection state" | OPEN/deferred |
| **Estimation dock v2 (durable exclusions)** — whether unticked lines feed the saved/portal quote | `docs/estimation-dock-spec.md` §5, §8 Q3 (recommendation: v1 drafting-only; v2 = portal/backend consumption) | v1 shipped with recommended defaults; v2 explicitly not built |
| **`StudioCoachMarks`** — leave unmounted forever (delete vs fold into `AiCapabilityCue`) | `OUTSTANDING.md` "Shipped inert" entry | OPEN ("Delete it or fold its copy into the cue when someone owns that call; do not mount both") |
| **Classic-studio contrast fix approach** — second option ("land the WebGL port and retire the paper language") | `docs/UI-PARITY-AUDIT-2026.md` §3 "Unmasked by this audit" + its `[2026-08-18]` note | First option shipped (repair in place, gate at zero); the port/retire option still open; subsumed by the SVG-permanence decision |
| **Dashboard delete / honesty footers** — "leave them unless product wants the disclosure moved" | `OUTSTANDING.md` "Idle chrome coverage" (utility-honesty-footer / header-context-strip) | Content decision, deferred |

---

## 3. Explicitly deferred / not built / not started (exhaustive)

### Product-stage features not built
- **Phase 4 Build Pack** (compliance audit + contractor CAD/spec bundle export)
  — NOT BUILT, the largest remaining stage gap (`OUTSTANDING.md` §3 Phase 4;
  `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` §3 #1; `docs/GOLD-STANDARD-2026.md`
  §3 Phase 4 as spec; `docs/PRODUCTION-ROADMAP-2026-08-17.md` "Next roadmap
  items not yet started").
- **Presentation Lens polish** — fit-sheet + split-view shipped; the
  storytelling lens is "polish-only, not built out" (`OUTSTANDING.md` §3
  Phase 3; `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` §3 #3;
  `docs/PRODUCTION-ROADMAP-2026-08-17.md` "Next roadmap items").
- **Mobile Field Bridge AR** (staking chips, subsurface ghosting, strike
  alerts) — **explicitly not built, by design** (no real RTK/WebXR source;
  fake telemetry would violate no-mock-data law) (`OUTSTANDING.md` §4;
  `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` §3 #5; spec at
  `docs/GOLD-STANDARD-2026.md` §4 / `docs/GOLD-STANDARD-2026-ARCHITECTURE.md` §7).
- **Stage 2 CAD (survey-grade true CAD)** — survey coordinates, named layer
  export (DXF/DWG), dim styles; schema-gated, **not started**, blocked until
  product opens Stage 2 (`OUTSTANDING.md` ranked #10 in WIP doc;
  `CLAUDE.md` "Stage 2 (product-gated)" + "Out-of-scope today";
  `docs/STUDIO-PRODUCT-PHASES.md` banner).
- **Mobile offline-first sync** — design doc only
  (`docs/SYNC-LAYER-DESIGN-OFFLINE-FIRST.md` — "design — not yet implemented");
  every capture screen is a blocking HTTP call; `useOfflineQueue.ts` is dead
  code; deps (NetInfo, expo-file-system) not added; server idempotency not
  built; Stage 2 mobile rail unmet (`docs/PRODUCTION-ROADMAP-2026-08-17.md`
  Phase 2 "mobile offline/sync pending"; `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md`
  #11; `FEATURE-LIST` A6).
- **Council/BYDA live data pull** — overlays exist keyless; live council
  drainage / BYDA plans are human workflows, not code (`docs/PRODUCTION-ROADMAP-2026-08-17.md`
  Screen 1 missing, §7 next actions; `docs/SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md`
  BYDA/COUNCIL rows; `FEATURE-LIST` A4 🟡).
- **Presentation export + council-pack export** — last Screen 4 polish before
  end-to-end quoting (`docs/PRODUCTION-ROADMAP-2026-08-17.md` §7 #4; F5 ⬜).
- **Phase 1 floating tool ribbon on GL** (Polyline/Curve) — Polyline/Curve
  still route to the legacy SVG surface; Area routes to
  `SpatialObject`/`outline_pct`; soil/aspect soft filters remain SVG-only
  (`docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` §3 #2; `OUTSTANDING.md` §2 build
  status "Still missing on the GL surface").
- **AI Phase 6 (Aerial Design Studio)** — deferred (`CHANGES.md`; `OUTSTANDING.md`
  "Aerial Design Studio" track; root `PROPOSAL.md` "AI Phase 6 deferred").
- **Brochure output** — deferred in spec (`CHANGES.md`; `OUTSTANDING.md`).

### Feature-list gaps (all ⬜ or 🟡, per `docs/FEATURE-LIST-CONCEPT-TO-SIGNOFF.md`)
- ⬜ E3 construction details; F5 council/approval pack export; G3 change
  orders; **G4 DWG/DXF export — "explicitly out of scope today"**.
- 🟡 A4 council/BYDA links; A6 handheld offline; B3 cut/fill volumes partial;
  B4 slope analysis (P2); B6 DBH capture partial; C4 bubble diagrams; C5
  concept presentation partial; C7 freehand export; D3 hardscape detailing;
  D4 softscape; D5 grading volumes; D6 drainage design; D8 lighting (partial
  — note a lighting-runs tool DID ship in PR #190); D12 variation schemes
  (session-only, not generative); E2 fit-sheet composition; E7 quote
  end-to-end polish; F1 presentation mode; F4 client review loop; G1
  construction documents; G2 as-built/site notes.

### UI-PARITY deferred roadmap (`docs/UI-PARITY-AUDIT-2026.md` §3)
Plant attribute model (~8 vs ~20 attrs), neighbour overshadowing (schema +
provenance exist but writer sets `[]`, no renderer), north-bearing-aware boards
(`boardAzimuthDeg()` zero consumers), typed functional zones, ongoing
maintenance calendar output kind, plant schedule on the quote portal.

### Infrastructure / tooling not built
- **Storybook for web primitives** — P3, not built (`OUTSTANDING.md` P3).
- **Multi-region Railway deploy (HA)** — P3, not built (`OUTSTANDING.md` P3).
- Postgres migration — superseded by SQLite WAL (kept as strikethrough history;
  `CLAUDE.md` "Out-of-scope today: Postgres" is the current line).
- Single API replica constraint — P0 still open (unchecked) while SQLite is
  single-writer (`OUTSTANDING.md` P0).
- **Estimation-dock v2** (durable `excluded_estimate_line_ids` through
  contracts/merge/API/portal) — not built (`docs/estimation-dock-spec.md` §5/§6).

### Camera-scope not built (`docs/CAMERA-STATE-MACHINE.md` "Out of scope / open questions")
Bare-facade editing at φ=90 on scene geometry without a photo; "Pitch dial" UI
(referenced in the gesture table, not a shipped control); touch long-press
thumbnail → jump-to-photo (⬜ in the gesture table).

### Classic-studio e2e debt — not fixed
`quote-tier1` `?svg=1&mode=cad&svg=1` double-param routing, develop-loop
council tip, classic fit-sheet strip; full `?svg=1` suite not re-run end-to-end
("floor-not-ceiling") (`OUTSTANDING.md` P3; `docs/UI-PARITY-AUDIT-2026.md` §7
`[2026-08-18]`; handover §"Other known items").

### Mobile-specific deferred
Mobile fonts not bundled (system fallback at runtime) (`SESSION-HANDOVER-2026-08-18-CONTINUATION.md`;
`OUTSTANDING.md` §2 token note); mobile sketch tool port ("licensable onsite
tool" endpoint, future phase) (`HANDOVER-GS2026.md` Gap 6); web parity backlog
for mobile-only backend families (rate card editor, plant palette browser,
crew CRUD, MYOB/Xero views, integration key registry, custom catalog symbol
CRUD — wrappers kept, wiring is a `/settings` extension) (`docs/UI-PARITY-AUDIT-2026.md` §2).

---

## 4. Known issues and debt

### Human-owned ops items (blocking prod hardening; code is inert without them)
All cited by `OUTSTANDING.md` "Human-only checklist", `PRODUCTION.md`
"Secrets still needed", `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` §4,
`docs/PRODUCTION-ROADMAP-2026-08-17.md` §2 "Human-owned blockers",
`docs/SESSION-HANDOVER-2026-08-17.md` gotchas:
- **Clerk keys** (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `AUTH_REQUIRED=true`) — prod runs `dev-user` today.
- **Sentry DSNs** on both services (scaffold + instrumentation shipped; PR #183
  wired mobile error paths).
- **Redis worker** (`REDIS_URL` + enable worker; pipeline runs inline).
- **EAS credentials** (Apple/Google) + `eas init` before TestFlight/store.
- **Litestream** R2/B2 bucket + sidecar (SQLite journal is the durable store
  now; single-writer constraint applies).
- **Branch protection on `main`** — needs GitHub Pro; 403 from API.
- **Stripe / portal / OTEL vars** (`STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `WORKSTREAM_PORTAL_SECRET`, `OTEL_EXPORTER_OTLP_ENDPOINT`).

### Infra freeze (do not re-debug as code bugs)
- **GitHub account frozen on failed payment** → Actions `0-second
  startup_failure with zero jobs`; **Railway git-linked builds fail silently**
  (stop after "scheduling build on Metal builder"); pushes/PRs/CLI deploys
  still work; operator clears via Billing (`SESSION-HANDOVER-2026-08-18-CONTINUATION.md`
  §"Known issues"; `OUTSTANDING.md` P1 "CI deploy job" freeze note).
- Prior CI diagnosis corrected: real repo-wide failure was the osmic
  git-SSH clone in the lockfile — fixed on main `5a5e0ee`; the startup_failure
  was the frozen account (`docs/SESSION-HANDOVER-2026-08-17-CONTINUATION.md` §2).

### Code bugs / flakes / reds
- **`webgl-asset-fanout.spec.ts` positional flake** — ~50% failure at batch end,
  state leakage; tracked, not fixed (`OUTSTANDING.md` P3).
- **Ground-plane aliasing / z-fighting + grid Moire** — diagnosed
  (`docs/GROUND-PLANE-ALIASING-AUDIT.md`: 20 km ortho depth span ≈ 1.19 mm/unit
  bucket vs 1 mm grid lift; 330 × 1 m grid cells). **No fixes applied** —
  remediation plan (near/far ±120, grid lift 10 mm, 10 m cells) awaiting
  sign-off; verification plan not run.
- **Facade raycasting gotcha** — R3F raycaster uses the perspective branch
  under the ortho facade projection (~120× squash); worked around in
  `PhotoTracePlane.hitFromEvent`; ground-plane tools at the horizon inherit the
  bug — general fix (unproject-to-ground) not done
  (`docs/CAMERA-STATE-MACHINE.md` "Facade raycasting gotcha").
- **Classic-studio e2e debt** (3 items, see §3) — tracked lowest priority
  (`OUTSTANDING.md` P3; `docs/UI-PARITY-AUDIT-2026.md` §7).
- **Elevation reporting 0.1% idle chrome is "unverified, not clean"** —
  13 painted elements found, none intersected the board
  (`OUTSTANDING.md` "Idle chrome coverage").
- **Dev no-Mapbox-token dim factor** — plan view carries no aerial; "production
  renders substantially lighter" (`docs/UI-PARITY-AUDIT-2026.md` §3; partially
  moot since PR #199 retired the aerial underlay by design).

### Honest placeholders / canned data in live paths (`OUTSTANDING.md`
"Production placeholders")
- `suppliers.ts` canned `DEV` prices for all 7 suppliers (`SUPPLIERS_LIVE` flag
  checked, no real adapters).
- `MELBOURNE_TRADE_CATALOG` — ~30 hardcoded wholesale offers.
- Plant biogenic carbon — 7 SKUs `source: "stub"`.
- `subtractPolygon()` — returns outer ring unchanged (no polygon clipping).
- Survey utilities stub (`preemptive-risk.ts` early-returns).
- Print line-weight scaling not scale-aware (`lineWeight.ts` TODO).

### Dead / dormant code waiting for a consumer
- **Dormant domain modules**: `volumetric-isolith`, `mass-plant`,
  `tpz-geometry`, `hybrid-plane`, `brush-recipe`, `assembly-recipe`,
  `spatial-turf` (`docs/UI-PARITY-AUDIT-2026.md` §2). (`stroke-recognize` was
  on this list on 2026-08-15 but is now wired into WebGL sketch→CAD —
  `ONBOARDING.md` §5 — so the audit's dormant list is partially stale.)
- **`packages/client` drift** — 13 unused methods, ~40 web-only endpoints
  unwrapped (`docs/UI-PARITY-AUDIT-2026.md` §2).
- **`useOfflineQueue.ts`** — dead code, nothing imports it
  (`docs/SYNC-LAYER-DESIGN-OFFLINE-FIRST.md` §1.2).
- **Unmounted `MobileFieldBridge` AR component still carries dark-era
  literals** (`OUTSTANDING.md` §2 token note).
- **`StudioCoachMarks`** never mounted — deliberately, pending the delete/fold
  decision (`OUTSTANDING.md` "Shipped inert").

### Other debt
- Dashboard delete undo exception in `CLAUDE.md` — **stale**, shipped (see §5).
- `e2e/canvas-contrast-aa.spec.ts` classic gate is green, but the classic
  studio is outside axe scope (`docs/UI-PARITY-AUDIT-2026.md` §5).
- CI e2e is **non-blocking by design**; revisit with self-hosted runner
  (`docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` §4; `AGENTS.md`).
- E2E rate-limit gotcha when reusing a plain `pnpm dev` API (`AGENTS.md`).

---

## 5. Stale or contradictory docs

1. **SVG studio: transitional vs permanent** — `docs/UI-PARITY-AUDIT-2026.md`
   §6 "Kept deliberately" phrasing ("the legacy SVG studio (the full studio
   until WebGL Phase-1 completes)") implies transitional/retirement, vs
   `AGENTS.md` "Migration status" ("`?svg=1`-only deep fallback … no longer
   part of mode routing" — permanent framing) and `ONBOARDING.md` §1 ("not
   developed further"). Both sides now also carry a blockquote flagging the
   question as **open** (`UI-PARITY` §6, `ONBOARDING` §1), so the unresolved
   tension is itself the open decision — do not treat either reading as settled.
2. **Photo-trace capstone status: still-open vs shipped** —
   `docs/SESSION-HANDOVER-2026-08-18-CONTINUATION.md` (the "current handover")
   lists "Photo-trace elevation capstone (calibration UX decision first)" as
   ranked remaining work #2 and pins `main` at `e6da28e`, vs
   `ONBOARDING.md` §3/§5, `OUTSTANDING.md` P1, and
   `docs/CAMERA-STATE-MACHINE.md` ("SHIPPED (2026-08-18)", committed
   `0b37127` + `a6f6646`/`78864ae`). The handover predates those commits and
   was never reconciled.
3. **"Working tree, PR pending" vs committed** — `docs/PRODUCTION-ROADMAP-2026-08-17.md`
   header + Screen 2 note and `docs/FEATURE-LIST-CONCEPT-TO-SIGNOFF.md`
   `[2026-08-18]` note and `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` #4 all say
   photo-trace was "working tree"; `ONBOARDING.md` §3 + `OUTSTANDING.md`
   explicitly call that wording stale (committed `0b37127`, pushed).
4. **Sketch→CAD "not on WebGL" vs shipped on WebGL** —
   `docs/PRODUCTION-ROADMAP-2026-08-17.md` Screen 2 `[2026-08-18]` note
   ("none of the sketch→CAD parse is surfaced on the WebGL studio yet — the GL
   freehand ink persists but does not convert") and `docs/FEATURE-LIST-CONCEPT-TO-SIGNOFF.md`
   C6 `[2026-08-18]` note ("not yet surfaced on the WebGL studio") vs
   `ONBOARDING.md` §5 ("WebGL studio (shipped 2026-08-18 — the former 'Part A'
   gap is closed): rail Tidy + Convert to CAD features") and `AGENTS.md`
   ("Sketch → CAD on WebGL (2026-08-18)"). Same-day updates that never landed
   in the roadmap/feature list.
5. **EVC/native-vegetation kind shipped but absent from feature docs** — PR
   #200 wired the `native_vegetation` keyless kind (handover table), yet
   `docs/FEATURE-LIST-CONCEPT-TO-SIGNOFF.md` A3 and
   `docs/PRODUCTION-ROADMAP-2026-08-17.md` §1 list the overlay set without
   `native_vegetation` (AGENTS.md and the handover do mention it).
6. **Marquee: "not implemented" vs implemented** — `CHANGES.md` ("Marquee
   multi-select: Not implemented; tap-select + drag-move only", 2026-05-21,
   and "Cmd+K command bar: Deferred with Phase 6 AI") vs `AGENTS.md`
   ("A tool-gated marquee rail tool is implemented (`webgl/marqueeSelect.ts` +
   the `marquee` rail tool)") and `docs/UI-PARITY-AUDIT-2026.md` §7
   ("Command palette (Ctrl/Cmd+K)… axe-clean"). CHANGES.md is a stale-era doc
   never reconciled.
7. **Dashboard delete undo: "on the punch list" vs shipped** — `CLAUDE.md`
   ("the current dashboard delete is the exception and is on the punch list to
   add an undo toast") vs `OUTSTANDING.md` P2 (`[x] Dashboard delete undo —
   toast restores via restore endpoint`, `[x] Project soft delete + restore`).
8. **Stage 2 terminology collision (two "Stage 2"s)** —
   `docs/STUDIO-PRODUCT-PHASES.md` marks Stage 2 "AI CAD" Phases 1–6 as
   **shipped** (incl. "Share Download DXF", glTF, UE5 sync, telemetry, AR) yet
   its own 2026-08-18 banner says "survey-grade coordinates and DXF/DWG layer
   export remain product-gated"; `CLAUDE.md` "Stage 2 (product-gated)" and
   `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` #10 say Stage 2 "not started";
   `docs/FEATURE-LIST-CONCEPT-TO-SIGNOFF.md` G4 says "DWG/DXF export…
   explicitly out of scope today". The docs never cleanly separate the old
   AI-CAD route from the product-gated survey-grade Stage 2.
9. **OUTSTANDING.md spec blockquote: source-of-truth vs historical** —
   `OUTSTANDING.md` "Intelligent Canvas — product specification" labels the
   2026-08-14 blockquote "kept verbatim as the **source-of-truth brief** for
   this track" (and its own build-status notes that the Studio Dark values it
   contains were superseded by the Paper/Signal-Blue pivot), while
   `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` §5 explicitly instructs: "The spec
   blockquote inside OUTSTANDING.md is the historical 2026-08-14 brief (Studio
   Dark, gold primary). It is quoted as history, **not** as the current
   standard." Plus `docs/GOLD-STANDARD-2026.md` (supreme) supersedes it. The
   label is ambiguous; the content is historical.
10. **Railway config: root vs `/apps/api/railway.toml`** — `RAILWAY.md` says
    the API service uses "Railway config file `/apps/api/railway.toml`" and
    names services `workstream-api`/`workstream-web`, vs
    `docs/SESSION-HANDOVER-2026-08-18-CONTINUATION.md` ("Railway deploy from
    repo root uses the service configs (`apps/web/railway.toml` for web; root
    `railway.toml` for api)"), `docs/SESSION-HANDOVER-2026-08-17-CONTINUATION.md`
    §3 (preview broke because the ROOT railway.toml builds the API image), and
    `PRODUCTION.md`/`CONSOLIDATION.md` (real service names
    `web-production-3c194` / `api-production-a8ff1`). RAILWAY.md reads as the
    original setup doc, never reconciled with the live config.
11. **Screen 1 "Missing: live Vicmap title fetch" vs verified live** —
    `docs/PRODUCTION-ROADMAP-2026-08-17.md` §3 Screen 1 build-state still says
    "Missing: live Vicmap title fetch (only documented), council/BYDA data
    fetch, live-estimate figures wired to the running BOM" while the same
    doc's status table says "**Vicmap + keyless hydrate verified live**" and
    "**live BOM (worker)**"; the handover §"Live-verified" and FEATURE-LIST A2
    confirm live. Internal stale paragraph.
12. **`DEPLOY.md` references `docs/GAP-ANALYSIS.md` as the current gap audit**
    — `OUTSTANDING.md` marks GAP-ANALYSIS.md historical ("current gap picture
    is docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md + this file"). Dead-ish
    reference.
13. **`docs/STUDIO-PRODUCT-PHASES.md` references
    `./CANVAS-FIRST-SPATIAL-ENGINE-SDS.md`** — that file now lives in
    `docs/archive/pre-gold-standard-2026/` (AGENTS.md: "Archived…
    do not follow"), so the reference is dead and points at a retired doc.
14. **`DEPLOY.md` CI description** ("ci.yml runs on every PR and push…")
    carries no GitHub-freeze caveat — contradicts the freeze reality in the
    handover/OUTSTANDING (a transient-state staleness, not a design conflict).
15. **Stale CI diagnosis chain (historical, labeled)** — `HANDOVER-NEW-CONTEXT.md`
    §3 ("GitHub CI: BROKEN repo-wide… startup_failure… exact cause only visible
    on the GitHub run page") and `docs/SESSION-HANDOVER-2026-08-17.md` gotchas
    were corrected by `docs/SESSION-HANDOVER-2026-08-17-CONTINUATION.md` §2
    (real cause = lockfile osmic SSH clone, fixed `5a5e0ee`; startup_failure =
    frozen account). All three files carry superseded banners — correct only in
    the newest.
16. **`docs/UI-PARITY-AUDIT-2026.md` dormant-module list includes
    `stroke-recognize`** (2026-08-15) — now consumed by WebGL sketch→CAD
    (`ONBOARDING.md` §5) — audit list not refreshed.
17. **Classic contrast-debt section wording** — `docs/UI-PARITY-AUDIT-2026.md`
    §3 describes ~186 AA failures as live, then its own `[2026-08-18]` note
    says fixed (gate at zero) — self-corrected within the doc, but the body
    still reads as current debt if skimmed.

---

## 6. Spec-after-ship smells + features shipped with no doc

### Docs written after (or around) the feature shipped
No egregious spec-after-ship cases found — the docs that post-date code are
self-labeled maps/corrections:
- `docs/CAMERA-STATE-MACHINE.md` — "**Not binding.** This is a map of the
  shipped camera machine… Code is the source of truth"; drafted during the
  camera branch, extended after the photo-trace capstone. Labeled.
- `docs/GOLD-STANDARD-2026-ARCHITECTURE.md` — "Corrected 2026-08-18
  (docs-vs-code audit)" — reconciled to shipped schema/component names after
  the fact (labeled correction).
- `docs/estimation-dock-spec.md` — spec written "for review — no code changed",
  then §9 "Execution status — v1 shipped (2026-08-18)" appended the same day
  (spec → implementation, healthy).
- `docs/UI-PARITY-AUDIT-2026.md`, `docs/PRODUCTION-ROADMAP-2026-08-17.md`,
  `docs/FEATURE-LIST-CONCEPT-TO-SIGNOFF.md` — carry `[2026-08-18]` corrections
  after code moved; the audit itself both documented and fixed gaps.

The dominant smell is the reverse: **docs lagging shipped features** (see §5
items 2–6): the current handover, roadmap, feature list, and CHANGES.md each
predate late-2026-08-18 shipments.

### Features shipped with thin or no dedicated doc
- **Native vegetation (EVC) kind (PR #200)** — only the handover PR table +
  AGENTS.md keyless mention; absent from FEATURE-LIST A3 / PRODUCTION-ROADMAP
  overlay lists / SITE-INFRA tables.
- **Perimeter tab chrome (PR #196)** — one `[2026-08-18]` note in UI-PARITY §1
  + AGENTS.md mention; no dedicated doc.
- **Marquee rail tool + read-only many-refs inspector (2026-08-18)** —
  AGENTS.md only (no doc file).
- **WebGL selection state / one-store selection (2026-08-18)** — AGENTS.md
  only.
- **Aerial underlay retirement + session-gated quiet auto-trace (PR #199)** —
  handover PR table + UI-PARITY §1 note; no dedicated doc.
- **Mobile web preview bundles / Sentry platform split (PR #193)**,
  **vendored IBL HDR fix (PR #194)**, **live-capable e2e harness (PR #198)** —
  handover PR table only.
- **Lighting runs tool (PR #190)** — described in
  `docs/SESSION-HANDOVER-2026-08-17-CONTINUATION.md` §1 only; FEATURE-LIST D8
  still reads "Lighting dock partial".
- **Mobile tokens → Studio Paper (PR #192)** — handover + WIP-AND-GAP
  `[2026-08-18]` RESOLVED note; no standalone doc.
