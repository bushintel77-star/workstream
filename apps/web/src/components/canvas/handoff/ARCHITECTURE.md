# Design Studio handoff — feature architecture

Each capability is a self-contained feature module under `features/`.
The shell (`HandoffDesignStudio`) only composes chrome + mounts features.

**Canvas-first (Workflow 1):** `%` board space is the drawing plane. The default
plane is **tactile parchment ground** (adaptive metric mesh + true-north rose +
ghost cadastral) — never a sterile void. Aerial/survey cross-fades above with
parchment kept as a soft underlay. Invisible UI (ambient ribbon, selection rings,
calm compliance) keeps cognition on geometry.

**Binding UX mandate:** [`docs/CANVAS-FIRST-UX.md`](../../../../../../docs/CANVAS-FIRST-UX.md)
+ handoff README § *UX/UI execution mandate*. Chrome matrix:
`state/handoffChrome.ts` (`resolveHandoffChrome`). Nested BOM stays under
Live cost **Advanced**.

**Spatial engine SDS:** [`docs/CANVAS-FIRST-SPATIAL-ENGINE-SDS.md`](../../../../../../docs/CANVAS-FIRST-SPATIAL-ENGINE-SDS.md)
— parchment tokens, 1.5px vectors, 8px corner / diamond mid nodes, 12px cadastral
snap, oblique dim ticks, TPZ / permeability colours, scale ladder. MapLibre +
PostGIS remain Stage 2.

**Flora / micro-climate SDS:** [`docs/CANVAS-FIRST-AI-FLORA-ENGINE-SDS.md`](../../../../../../docs/CANVAS-FIRST-AI-FLORA-ENGINE-SDS.md)
— planting Add opens inline Flora Ring; shade-grid + Curtis deterministic solver;
holographic mature canopy preview; Accept places stock. PostGIS registry is Stage 2.

**Volumetric Isolith SDS:** [`docs/CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md`](../../../../../../docs/CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md)
— micro-topographic stockpile contours from live estimate (topsoil / CR6 / clay);
bank×bulkage → loose m³; compact tag expands to micro-HUD. PostGIS volumes Stage 2.

**Live Trade SDS:** [`docs/CANVAS-FIRST-LIVE-TRADE-SDS.md`](../../../../../../docs/CANVAS-FIRST-LIVE-TRADE-SDS.md)
— ambient budget margin + selection SKU tags from cached Melbourne trade hubs;
amber “Wholesale Unverified” fallback. Live Plantmark/Dinsan APIs are Stage 2.

**Patch verification:** [`docs/CANVAS-FIRST-PATCH-VERIFICATION.md`](../../../../../../docs/CANVAS-FIRST-PATCH-VERIFICATION.md)
— drawn geometry overrides Vicmap placeholders; elevation label stack; Fit sheet clip;
Isolith vector drafting in the Isolith SDS §5.

**Spatial correction NLP:** [`docs/CANVAS-FIRST-SPATIAL-CORRECTION-NLP-SDS.md`](../../../../../../docs/CANVAS-FIRST-SPATIAL-CORRECTION-NLP-SDS.md)
— `runSpatialCorrection` / Ask AI: Vicmap boundary snap, vegetation sieve, elev clamp, parchment-only.
— `runStage1FoundationCleanse` / ⌘K “Stage 1 foundation cleanse”: purge aerial + AI veg, lock Vicmap title, charcoal CAD overlay + mm dims (`foundationCleanse` chrome).
— Quiet Vicmap hydrate on mount (`boundarySource`); no silent `scanGhosts` / canopy scan. Cad chrome diets while AI ghosts pending. See `docs/CANVAS-FIRST-SCREENSHOT-ISSUES.md`.

**Stage 2** (MapLibre + PostGIS / EPSG:7855 / FLOAT8) is a separate product
phase — see `docs/STUDIO-PRODUCT-PHASES.md`. Do not make MapLibre the default
studio surface here until that schema brief lands.

## Modules

| Module | Owns |
|--------|------|
| `geometry/` | Pure maths: sheet box A3/A4, polygon area/perimeter, edge dims, TPZ radius in % space |
| `state/` | `useStudioState` + **`studioAiEngine`** + continuous **`evaluateStudioCompliance`** + continuous **`estimateStudioDrawing`** (assemblies, labour, tippers, horizon) — no Design↔Quote toggle |
| `features/fitSheet/` | Paper frame, **Vicmap cadastral title block** (selected address), site schedule, dims, stacked elevations |
| `features/cadPlan/` | Aerial, SVG polys, symbol placements, corner/mid handles, dim labels, edit banner |
| `features/aiGhosts/` | Coach dock (primary), ghost review, confidence factors, accept/reject/cycle, Ask AI |
| `features/utilityDrawer/` | Right-hand Compliance + Live BOM hub — indicator tabs, sheet overlay while drawing |
| `features/ground/` | Tactile parchment earth, adaptive metric grid, compass, ghost cadastral |
| `features/ambient/` | Proximity left ribbon — dormant blur strip, layer chips with counts |
| `features/selectionRing/` | Contextual radial UI on selected asset (material / peel / lock / delete) |
| `features/flora/` | Inline Flora Ring — micro-climate sample + top-3 Curtis plant suggestions |
| `features/isolith/` | Dynamic Volumetric Isolith — SVG stockpile contours + bulkage ledger |
| `features/trade/` | Ambient budget margin + contextual SKU trade tags / alternatives |
| `features/layers/` | Four opacity sliders + setback toggle |
| `features/commandPalette/` | ⌘K actions + Ask AI row + arm symbols |
| `features/sunGrowth/` | Arc scrubber, growth chips, shadow length readout |
| `features/compliance/` | Pass/fail dock independent of layer opacity |
| `features/bom/` | Live preemptive BOM (primary + shadowed assembly / labour / logistics) |
| `features/horizon/` | Preemptive horizon cards + canvas pins; Accept sketches mitigation ghosts |
| `features/share/` | Share lens — AI draft gate, promote quote, portal copy/open |
| `features/tier1/` | Quote surface (same estimate report) + Wrights Terrace value ledger |
| `state/canvasBridge.ts` | StudioItem ↔ DesignCanvas placements; durable autosave payload |
| `features/elevation/` | Full-mode front/side elevation profile |
| `features/trace/` | Click-trace boundary/building + Tab rectangle autocomplete |
| `features/measure/` | Indicative two-point measure tape |
| `features/aerial/` | Drag-drop aerial slot + canopy colour-cluster scan |
| `features/sketch/` | Freehand ink strokes in sketch mode |
| `features/sites/` | Multi-site switcher with per-site snapshots |
| `features/coach/` | 3-step onboarding (`cc_coach_done`) |

## Visual source of truth

`docs/design/operator-redesign/design_handoff_landscape_cad_studio/screenshots/`
+ `Design Studio v4.dc.html` behaviour — reimplemented, not copied.
