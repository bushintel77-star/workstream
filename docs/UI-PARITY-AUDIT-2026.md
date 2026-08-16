# UI Parity Audit 2026 — Backend → Frontend Coverage + Landscape UX

> Audit date: 2026-08-15. Companion to the Gold Standard 2026 binding docs.
> Method: full backend route inventory (`apps/api/src/routes`, ~135 routes)
> cross-referenced against actual UI consumption in `apps/web` (server
> components + `lib/api.ts` + BFF proxies) and `apps/mobile`
> (`packages/client`). Landscape UX reviewed against industry practice for
> Melbourne/Victoria residential landscape design.

## 1. What this pass fixed (wire, don't delete)

| Backend capability | Was | Now |
|---|---|---|
| 8-mode canvas system (`?mode=…`) | Default WebGL studio ignored `?mode=` — elevation/garden/share/survey/cad deep links dead-ended on a mount that never renders them | `webglStudioSupportsMode()` (`apps/web/src/lib/canvas-mode.ts`) routes SVG-only modes to the classic studio; `StudioModeTabs` glass pill row on the WebGL studio shows all 8 modes with progressive unlock, native modes switch in place, classic modes link to `?svg=1&mode=…` |
| `GET /site-context` (council planning badges, season, daylight) | `getSiteContext` defined, never called | `SiteContextBadges` component — WebGL right-column glass card + "Planning context" block in the SVG `EnvironmentPanel` |
| `GET /projects/:id/envelope` (budget envelope ±15/20%) | `getEnvelopeBrief` defined, never called | `EnvelopeBand` in the `LiveCostRail` — shows the survey envelope band and in/over/under state beside the running total (`classifyEnvelope` unit-tested) |
| `GET/POST /measurements/photo` (Claude vision quantities) | `/measurements` was a redirect into sketch mode; the surface had been removed (its CSS survived) | Real `/projects/[id]/measurements` page — drag-drop photo upload (new BFF `POST /api/projects/:id/measurements`), itemised results with value/unit/confidence/reference |
| `POST /recordings` (voice capture pipeline) | Recordings page was list-only — the entire capture pipeline had no web entry | `RecordingUpload` on the recordings page — audio upload with metadata auto-detected duration + DIL-consent gate (backend contract enforced) |
| `GET /projects/:id/activity` | `listProjectActivity` defined, never called | "Activity trail" section on the audit page |
| Stripe checkout return URLs → `/settings/license` | 404 trap (page never existed; middleware protected the route anyway) | `/settings/license` page — plan, seats, members, studio/seat checkout buttons (wires `startStudioCheckoutApi`, `startSeatCheckoutApi`, `invite/removeWorkspaceMemberApi`), success/cancel banners |
| Quote source-of-truth drift | WebGL fit-sheet priced client-side only; share/portal used backend costing — numbers could silently diverge | `FitSheetCard` fetches `POST /costing/sketch` when opened; shows the backend total beside the client estimate with a drift chip (refresh ⟳ re-prices the saved canvas) |
| Seasonal canopy shed | "Existing vs new planting" heuristic approximated deciduousness | Species truth first: catalog symbol `keywords` (`deciduous`/`evergreen`) drive winter retention via `RenderItem.leafRetention` (`stateBridge.ts`); heuristic is the fallback |
| Sun-path DST drift | `sunPositionAt` hard-coded UTC+10 — solar time drifted ~1 h during AEDT | `melbourneUtcOffsetHours()` reads the real zone offset; test pins solar noon at ~12:22 AEST / ~13:22 AEDT |

## 2. Parity matrix — remaining status

Legend: ✅ wired in web · 📱 mobile-only surface · 🌒 dormant (backend exists, no UI anywhere) · 🧊 dormant domain module (exported, no consumer)

### Fully wired in web (no action)
Projects CRUD + pipeline (survey/design/costing/audit/outputs), design canvas + autosave, design branches (checkout/diff/commit), CAD ops/exports/quote, boundaries (auto-trace/lock/ingest), keyless overlays + stormwater, cadastral title, geocode search/preview, findings/board-report/telemetry, ghosts + sketch-CAD + NL assist, orchestration + overlays, schedules (planting/trench/lighting/material) + documentation packages, presentation documents/dissect/format/pack, share revisions + decision, portal quote + deposit, outputs (11 kinds), carbon, tasks, weather, files/gallery, quote-doc, resource pool, costings (3 scenarios), integrations sync.

### Mobile-only (backend families the web deliberately does not surface yet)
Rate card editor, plant palette browser, crew CRUD, MYOB + Xero accounting views, integration key registry/test, custom catalog symbol CRUD. The web `lib/api.ts` wrappers for these are kept (not trimmed) as the parity backlog — wiring them is a `/settings` extension, not new backend work.

### Dormant domain modules (good logic awaiting a consumer)
`volumetric-isolith`, `mass-plant`, `tpz-geometry`, `stroke-recognize`, `hybrid-plane`, `brush-recipe`, `assembly-recipe`, `spatial-turf` (`packages/domain/src`). Keep — these are Phase-1 WebGL candidates, not legacy.

### Known half-wired (tracked, lower priority)
- **All eight modes now mount natively in the WebGL studio** (2026-08-15): sketch/quote/present instruments, elevation (classic `ElevationBoard` as a glass sheet), garden (eye-level 3D rig + viewpoint strip), survey (checklist glass), CAD (technical plan lock + AI drafter hub: ensure / AI draft / accept ghosts / NL edit / quote / assist), share (portal promotion card). Mode routing never hands off; progress re-derives live from the store (first stroke/asset unlocks without reload). The `?svg=1` classic studio remains an explicit deep fallback for vector node-editing and the long feature-dock tail.
- `packages/client` drifts from the backend surface (13 unused methods, ~40 web-only endpoints unwrapped) — it tracks the mobile app's needs.

## 3. Landscape-design UX findings

### Strong already (keep)
Southern-hemisphere solar geometry (0°=north, Melbourne noon → south shadows, winter=Jun/summer=Dec presets); AS 4970-2025 TPZ/SRZ with multi-stem DBH; BYDA dig discipline + strike alerts + dig-override stamps; council permeability/canopy compliance (30%/25% Melbourne-profile); mature-size honesty contract (one symbol = one mature height; "planting shown at mature spread" disclaimers); path-corridor widths (0.9/1.2/1.5/1.8 m) + hardscape edge grammar; irrigation hydraulics (Hazen-Williams) + LV lighting 80% VA rule; planting/trench/lighting/material schedules with honesty footers; establishment calendar (Melbourne windows, two-summer watering); handover pack with per-category care + warranties; ASLA/SILA lifecycle phases; plant windows + frost/heat cues from forecast.

### Fixed this pass
Deciduous/evergreen drives seasonal canopy (species keywords, not planting provenance); AEDT-correct sun path.

**Render legibility calibration (2026-08-15, operator directive "see the
design in its best light"):** ACES tone-mapping exposure 1.05→1.4 (ACES
compresses mid-tones; daylight gardens read dusk at 1.05); sun intensity
legibility floor (base 0.55→0.75, winter dimming 0.25→0.15 — season reads
through shadow length and canopy, not murk); ambient/hemisphere lifted
(0.45/0.55 → 0.5/0.65); evergreen species no longer lerp to autumn orange or
drop winter opacity (species truth now governs colour, not just retention);
**chrome type floor 10.5px labels / 11px figures** (see the tokens doc
amendment — the old 9–10px meta idiom was unreadable; swept across all WebGL
chrome). Known remaining dim-factor: no Mapbox token in dev → the plan view
carries no aerial photo (production renders substantially lighter).

**Spatial-layer rebuild (2026-08-15, rendering-execution pass):** the
measured failure — semantic lines at constant world-Z intersected the IDW
terrain (title boundary 7.63 m under the surface on high ground, 7.33 m
floating on low; proven by running the real terrainMath over the seeded
levels). Fixed by construction: layerContract.ts declares the four in-canvas
layers (terrain / draped / semantic / markers) with renderOrder + clearances;
boundary, easements, services, and the origin peg now drape via the shared
elevation sampler (drapeRingToSurface, edges subdivided to 4 m so lines
follow relief, not chords — pinned by terrainDrape.test.ts); the aerial
underlay rides the same displaced geometry; the terrain material gained
topographic articulation (terrainMaterial.ts: contour banding at the 0.5 m
surveyor interval, slope-based albedo, noise breakup) so relief reads from
any light angle. ARCHITECTURE doc 2.4 records the contract.

### Unmasked by this audit: classic-studio contrast debt (pre-existing)
`e2e/canvas-contrast-aa.spec.ts` was silently broken since the WebGL-default
swap (it expected the SVG studio at `?mode=…` and died before asserting).
Forcing `?svg=1` restored its assertions and exposed ~186 real WCAG AA
failures in the classic studio's paper label language — light Studio-Dark
inks over parchment surfaces (`#f0f0f1 on #fafaf8` ≈ 1.1:1), concentrated
in: `cadPlan.module.css` (`dimLabel`, `cadAreaValue/Key`, `cadStreetCue`,
`machineAccessCallout`, `cadDimKey`), `boardFindings.module.css` (title,
kicker, detail, cite, basis, show, dismiss), `liveCostRail.module.css`
(kicker, statLabel, totalSuffix, sectionLabel/Meta, mono),
`nextBestOptionChip.module.css`, plus `modeBtn` pills at 4.48:1 (opacity
washing in the `.root`/`.rootDark` dual-theme system). Root cause: the
classic studio's light-paper core never completed the Studio Dark
conversion. Fixing requires a visual pass over the dual-theme label
language (blind token patches make the opposite theme worse — tried and
reverted). Recommended: either complete the paper→Studio-Dark conversion
as its own change, or land the WebGL port of these surfaces (Phase 1) and
retire the paper language with it.

### Other pre-existing red e2e (fail on `main` before this change; verified by stash-run)
- `e2e/develop-loop.spec.ts` — `council-setback-tip` never appears after the
  palette Develop-site command (20 s timeout). Previously failed earlier at
  the studio mount; mode routing now reaches the SVG studio, so the
  remaining failure is the develop pipeline / council-tip flow itself.
- `e2e/elevation-silhouettes.spec.ts:148` — `fit-sheet-layer` does not mount
  from the header fit-sheet control in a fresh cad session. Same story:
  mount fixed by routing; the layer mount itself is broken on main.

### Deferred roadmap (recommended order)
1. **Plant attribute model** (~8 attrs today vs ~20 industry): structured `native`/`endemic` flags (currently prose keywords), growth rate (growth rings use universal Year-1/5/10 constants), flowering season + foliage colour (seasonal interest), toxicity/pet-safety, maintenance level, soil pH + drainage (soil is one free-text string today), spacing/density per species, declared-weed/biosecurity check (blocklist is style-based, not DEECA).
2. **Neighbour overshadowing**: `DesignNeighbourBuilding` schema + provenance exists; only writer sets `[]`; no renderer. Wire auto-trace ingest → shade-grid/sun-cast input → overshadowing finding.
3. **North-bearing-aware boards**: `boardAzimuthDeg()` written + tested, zero consumers; sun-cast/shade-grid assume north-up.
4. **Typed functional zones**: `Zone.name/treatment` free text; no entertaining/play/utility/outdoor-room ontology or placement tool (studio "Zone" paints system zones).
5. **Ongoing maintenance calendar** output kind (establishment calendar covers establishment only; no pruning/mulching by month).
6. **Plant schedule on the quote portal** (zone narratives render; quantities live in operator docks only) and a graphic mature-size legend on sheets.

## 4. Trim decisions (2026-08-15)

Deleted after per-name reference verification (zero importers):
`ComparisonLens.tsx` (superseded by `SplitViewLens`), `DashboardProjectList.tsx`, `WorkflowPreviewStrip.tsx`, `Spinner.tsx`, `landing/PlanHeroVisual.tsx`, vestigial `?webgl=` search param.

**Legacy marketing landing removed (zero-mock-data law).** `/` presented
fabricated telemetry as live data — hardcoded lat/longs, fake pipeline
steps, an invented 14.2 L/s hydrology scan and pressure readings. The page,
its components (`FloatingHUD`, `MetaChip`, `SiteTruthSearch` + styles), and
its stylesheet are deleted; `/` now redirects to `/home` (the operator
dashboard, where the address composer runs against the real geocode API).
`/home` added to the Clerk protected matcher; `e2e/landing.spec.ts` replaced
with a redirect + composer assertion. A repo-wide mock-data sweep found no
other fabricated runtime data (all remaining matches are comments asserting
its absence).

## 5. Accessibility audit (2026-08-15)

**Method:** axe-core (WCAG 2.0 A/AA + 2.1 AA) across six routes + manual
keyboard/reduced-motion checks. Locked into CI as `e2e/a11y-axe.spec.ts`
(dashboard, canvas chrome, measurements, audit, settings).

- **Result: zero violations on every audited surface** after one fix — the
  AppNav plan pill blended an 85% info-blue text over a 20% info-blue tint
  (shared channel, ~4:1); rebalanced to 55% ink over a 12% tint.
- **Keyboard:** full canvas chrome is reachable in logical order (skip link
  → tool rail with ▸/▾ state in accessible names → mode tabs), focus rings
  render (`outline: 2px solid`), dialog focus traps covered by the existing
  `canvas-dialog-focus-trap.spec.ts`.
- **Reduced motion:** global `prefers-reduced-motion` block plus per-module
  guards (skeleton pulse, scrub pulses).
- **Excluded by design:** the classic `?svg=1` studio's paper-label
  contrast debt (§3) is tracked by `canvas-contrast-aa.spec.ts`; the WebGL
  scene's 3D content is a visual surface — its DOM chrome (layer 3) is what
  axe audits.

## 6. Loading-state audit (2026-08-15)


Coverage is complete — no gaps found:
- Every route has a Suspense boundary: root `loading.tsx` renders the full
  dashboard-shell skeleton (no layout flash), every `/projects/[id]/*`
  child renders `PipelineShellLoading`, portal routes have their own.
- Loading shells are accessible (`aria-busy`, `aria-label`) and
  reduced-motion-safe (skeleton pulse disabled under the media query).
- Error boundaries at root + `projects/[id]` + portal; the canvas hydrate
  fails closed by design (never autosave over unknown state).
- The WebGL studio's dynamic-import fallback is a flat canvas-coloured div
  (<1 s before first frame) — acceptable under the zero-chrome law; the SVG
  branch keeps its full `StudioSkeleton`.

Kept deliberately: all `lib/api.ts` endpoint wrappers (§2 mobile-only list — they are the web-parity backlog, not dead weight), the legacy SVG studio (the full studio until WebGL Phase-1 completes), dormant domain modules (§2), orphaned `measurementCard` styles (reused by the restored measurements surface).

## 7. Heuristic evaluation (2026-08-15, Nielsen-10 × WCAG 2.2 AA / DTA)

Frameworks: NN/g 10 heuristics; WCAG 2.2 AA (text 4.5:1 / large 3:1, non-text
+ focus indicators 3:1 per SC 1.4.11 + 2.4.11) — now the DTA Digital Service
Standard benchmark. Instrumented: 67 chrome elements measured (computed
styles) + axe (§5) + keyboard/reduced-motion checks.

**Passing:** visibility of system status (autosave chip, settle states,
lock reasons); match to domain (surveyor idioms — north rose, TPZ, RLs);
recognition over recall (labels + titles everywhere); error prevention
(ghosts never silent-write; consent gates); canvas-first minimalism
(measured idle coverage <1%); consistency (one `--gs-*` namespace, CI-gated);
WCAG 2.2 AA zero violations on the WebGL chrome.

**Findings (severity-ranked):**
1. **M** User control/freedom — no global undo/redo surface on the WebGL
   mount yet (undo exists in the classic board); destructive accepts
   (accept-ghosts) are single-click.
2. **M** Aesthetic/minimalist — right column can stack 6+ cards when
   terrain tools are live; needs progressive disclosure by mode (survey
   card should replace, not stack).
3. **M** Flexibility/efficiency — no command palette on the WebGL mount
   (classic has Cmd+K); power-operator path is longer.
4. **L** Help/documentation — coach marks exist classically, not on WebGL.
5. **L** Non-text contrast — rail glyph icons inherit 3:1-adjacent ink; some
   9.5px glyph accents sit below the 10.5px label floor by design (amendment
   allows) but should be verified against SC 1.4.11 in the a11y spec.
6. **L** Typography — two families correctly roled (Space Grotesk figures /
   Inter labels); hierarchy is size-led (10.5 → 16); consider weight-led
   emphasis at 11px to reduce size steps.

Layout rhythm: 4px micro-gap law holds (12/67), paddings cluster at 4–10px,
radii tokens (6/12/999) used consistently; the 15px/400 Inter cluster in the
measurement is inherited container default (not rendered label size).

**Production-hardening pass (2026-08-15, closes §7 findings 1–3 + 5):**
`pnpm run ci` now green end-to-end (placeholders, portal edge runtime, hex
allowlist, typecheck, lint, 1,682 tests). Undo/redo landed on the WebGL
studio — store-level doc history ({placements, strokes} snapshots, cap 50)
committed by every mutating action, Ctrl/Cmd+Z (+Shift), ↶/↷ buttons with
disabled states; autosave persists the undone state naturally. Command
palette (Ctrl/Cmd+K): all 8 modes, tools, camera, and edit actions,
filterable, listbox semantics, axe-clean. Right column is mode-aware
(fit-sheet renders in sketch/cad/quote/garden only). Camera + history
affordances in the top-left card (−/+/↶/↷) plus a dismissible first-run
controls hint (wheel/drag/Ctrl+K) — the zoom scheme is now discoverable.
Dev register cleaned of e2e fixtures. Remaining documented reds: the classic
studio paper-language contrast debt, develop-loop council tip, and the
classic fit-sheet strip (all pre-existing, inventoried above).
