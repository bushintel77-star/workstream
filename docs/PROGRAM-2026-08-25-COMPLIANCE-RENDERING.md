# Program 2026-08-25 — Compliance Suite + Top-Tier Rendering

> **Status:** binding sequencing for the leverage program built on the AEC-2026
> infrastructure (compliance-chip factory, chrome recede, ARIA mirror,
> AiScanOverlay). Subordinate to the Gold Standard docs. Companion:
> [`AEC-2026-ROLLOUT-PLAN.md`](./AEC-2026-ROLLOUT-PLAN.md) (Waves 0–5, shipped).

## Ground rules

Same as the AEC rollout (§0): single branch, per-wave gate (typecheck →
touched tests → kept e2e **executed** green → commit when the user says
ship), tokens by name, zero-mock-data, honesty stamps on all legal output.

**Rendering law (binding):** the drafting modes' dead-neutral `#F4F4F4`
paper canvas (release `87adeeb`) is untouchable — Track C upgrades live in
the SITE/3D modes (garden, present, orbit views) only, and every visual gain
must hold the existing gates (`contrast-aa`, chrome coverage/collision) and
the frame budget (no regression in the coverage spec runs).

## Track A — Trust the geometry (prerequisite for everything)

- **A1 — Boundary geometry truth (SHIPPED 2026-08-25).** Root cause found
  live: NOT the suspected PFI pin-mismatch (trace and title already share
  the keyed search and agreed — both 8,685 m² for PFI 173687792). The real
  defect was an **aspect desync**: `site_truth_import` fits the board as a
  SQUARE (board_width_m = metres per 100 board-% on both axes; the boundary
  pct shape carries the lot's true aspect), but `page.tsx` derived
  `boardAspect = boundary bbox h/w` and every consumer (`pctToWorld`,
  area maths) squashed the y-axis by that factor — a 350×71 m East
  Melbourne parcel rendered 350×14 m, its ring measured 1,686 m² instead of
  8,686 m², and only square lots (aspect≈1) hid it. Fix: **boardAspect = 1
  by law** (page.tsx), ptToM convention aligned (×, H/W), plus a
  `LOT_AGREEMENT_FACTOR` disagreement note on the A2-6 chip when title and
  ring areas diverge >2×. Proven live: overhang advisories rose 5 → 20
  (true metre distances), title↔ring agreement restored. Tests:
  thin-parcel true-area case + disagreement flag (23/23) + canopy e2e
  green. Follow-up: `pctRingToPlanarM` (handoff) still divides by aspect —
  inert under aspect 1, but unify its convention when next touched.

## Track B — The compliance factory (rule → bridge → chip → quote row)

Each item follows the A2-6 template exactly (pure domain rule, web bridge
reading placements + boundary, `a26`-style meta chip, fit-sheet row where
the quote stage cares):

- **B1 — AS 4970 tree protection zones (TPZ/SRZ).** Domain maths exists
  (`tpz-geometry.ts`, `as4970-protection-zones.ts`); existing trees carry
  DBH provenance. Wire: trenches/hardscape geometry vs TPZ discs → strike
  alerts (reuse the utility strike-alert engine) + a chip ("2 works cross
  protected root zones"). Highest landscape value.
- **B2 — Site coverage.** Live (built area ÷ lot area)% chip vs the zone
  limit; the schedule maths exists (`buildSiteSchedule`).
- **B3 — Setback advisory.** Hardscape/building entering the buildable
  envelope setback band → advisory chip (envelope maths exists via
  `buildableEnvelopeFromBoundary`).
- **B4 — Clause 52.37 canopy-removal advisory.** Existing (Vicmap-sourced)
  trees on site → "removal may trigger a canopy-tree permit" one-liner.
- **B5 — Tree schedule export.** The A2-6 candidate enumeration already
  lists every tree (species, mature/measured size, source); emit the
  arborist schedule table (survey/quote surface) + optional `carbon.ts`
  estimate row.
- **Later horizon:** solar access (real-sun + `solar-window.ts`), the
  multi-standard "deemed-to-comply 3 of 4" summary (never a permit claim).

## Track C — Top-tier rendering (site/3D modes only)

- **C1 — Audit.** Inventory the current cinematic stack (RenderFX passes,
  N8AO settings, ACES exposure, VSM shadow tuning, HDRI IBL intensity,
  material PBR channels, foliage ramp) against the "design render vs CG"
  bar; publish the ranked gap list before touching code.
- **C2 — Light + shadow.** Calibrated real-sun shadows (VSM quality,
  contact shadows under trees/furniture), IBL reflections on hardscape,
  subtle bloom only where emissive (lighting fixtures at dusk presets).
- **C3 — Materials + foliage.** Foliage legibility lift (the OUTSTANDING
  murk follow-up now the paper fix landed), PBR hardscape materials,
  water/gradient quality in garden mode.
- **C4 — Performance.** Adaptive DPR, draw-call audit at 31+ tree scenes;
  the fps story must survive the 60-tree A2-6 sites this program creates.

## Track D — Site envelope: planting becomes an aesthetic decision (core SHIPPED 2026-08-25)

Fuses sun × season × wetness × slope × soil indicators so the planting
palette is pre-filtered to what will thrive. Shipped: zod contract
(`packages/contracts` `site-envelope.ts` — SiteEnvelopeSchema), pure domain
fusion (`planting-envelope.ts`: winter/summer shade grids at the seasonal
presets, worst-season sun bound, wetness = worst driver with evidence,
palette scorer `rankPaletteForEnvelope` over catalog sun/water/soil
attributes), web bridge (`webgl/siteEnvelope.ts`: Vicmap overlay flags +
the drainage layer's own D8 grid for ponding/streams evidence + slope, zod
parse at the boundary), and the `site-envelope` meta chip (bright in
sketch/cad/garden) carrying drivers + honesty stamps. Gates: 15 unit tests
incl. a zod round-trip, typecheck, canopy e2e regression; live-verified on
10 Gisborne St ("Full sun · dry — winter 5.0h / summer 10.2h").
**Next increment:** thread the envelope into `floraWorld.rankAtPoint` so the
flora ring's candidates consume `rankPaletteForEnvelope` directly (one prop
thread through FloraRingLayer). Honest limits: Phase 1 indicative solar
model (no obstacle raycasting yet — `boardShadowCast` exists for the
upgrade); soil is overlay-indicator based, never a soil survey.

## Track E — Scan-choreographed hydration (SHIPPED 2026-08-25)

Category-aware site-truth reveal: when the import's reload rehydrates the
studio, each data category reveals in its own visual language — the title
boundary draws on, structures extrude up, easement/service lines ant-path,
terrain fades in, existing trees grow canopy masks — synchronized with the
overlay's REAL stage labels ("Tracing title boundary · 13 points",
"Placing 31 existing trees"). Shipped: zod contract in
`@workstream/contracts` (`scan-choreography.ts`), pure builder
(`webgl/scanChoreography.ts` — absent categories emit no event), store
machine (`scanStage`/`scanStageStartedAt`, flips only), a single
`ScanRevealDirector` writing per-stage 0→1 into a module singleton (layers
read it in their own useFrame — zero re-renders), drivers in
LotBoundary/Easements/BuildingFootprint/TerrainMesh/sceneItems, the
`gs-scan-reveal` arm-flag consumed only on completion (StrictMode
double-mount safe), and `stageTestIds` on the overlay. Reduced motion
resolves instantly. Gates: 18 unit tests, typecheck, lint, e2e
`webgl-scan-reveal` (ordered stages → settle → live entities) + canopy
regression. Honest gaps: rock outcrops, overhead lines, surface utilities,
doors/floor levels, shrub segmentation have NO data source — no visuals;
BYDA underground lines render-ready (schema + services/subsurface paths)
awaiting a hydration wave.

## Order

A1 → B1 → C1 (audit doc) → B2 → C2 → B3/B4/B5 → C3 → C4, with the C-track
audit (C1) pulled early so the rendering work is evidence-ranked, not taste.
