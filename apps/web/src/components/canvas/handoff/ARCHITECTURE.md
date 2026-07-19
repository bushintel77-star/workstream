# Design Studio handoff — feature architecture

Each capability is a self-contained feature module under `features/`.
The shell (`HandoffDesignStudio`) only composes chrome + mounts features.
No MapLibre on this surface — `%` board space is the drawing plane.

## Modules

| Module | Owns |
|--------|------|
| `geometry/` | Pure maths: sheet box A3/A4, polygon area/perimeter, edge dims, TPZ radius in % space |
| `state/` | `useStudioState` + **`studioAiEngine`** + continuous **`evaluateStudioCompliance`** (Stonnington permeability, setback snap, AS 4970 TPZ) — no Calculate button |
| `features/fitSheet/` | Paper frame, site schedule, boundary/footprint dim table, stacked elevations |
| `features/cadPlan/` | Aerial, SVG polys, symbol placements, corner/mid handles, dim labels, edit banner |
| `features/aiGhosts/` | Coach dock (primary), ghost review, confidence factors, accept/reject/cycle, Ask AI |
| `features/utilityDrawer/` | Right-hand Compliance + Live BOM hub — indicator tabs, sheet overlay while drawing |
| `features/layers/` | Four opacity sliders + setback toggle |
| `features/commandPalette/` | ⌘K actions + Ask AI row + arm symbols |
| `features/sunGrowth/` | Arc scrubber, growth chips, shadow length readout |
| `features/compliance/` | Pass/fail dock independent of layer opacity |
| `features/bom/` | Live BOM + mitigation chips |
| `features/tier1/` | Quote surface + Wrights Terrace value ledger |
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
