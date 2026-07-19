# Design Studio handoff — feature architecture

Each capability is a self-contained feature module under `features/`.
The shell (`HandoffDesignStudio`) only composes chrome + mounts features.
No MapLibre on this surface — `%` board space is the drawing plane.

## Modules

| Module | Owns |
|--------|------|
| `geometry/` | Pure maths: sheet box A3/A4, polygon area/perimeter, edge dims, TPZ radius in % space |
| `state/` | `useStudioState` — single mutate path, undo/redo, layer opacity, ghosts |
| `features/fitSheet/` | Paper frame, site schedule, boundary/footprint dim table, stacked elevations |
| `features/cadPlan/` | Aerial, SVG polys, symbol placements, corner/mid handles, dim labels, edit banner |
| `features/aiGhosts/` | Review card, confidence factors, accept/reject/cycle, Ask AI |
| `features/layers/` | Four opacity sliders + setback toggle |
| `features/commandPalette/` | ⌘K actions + Ask AI row + arm symbols |
| `features/sunGrowth/` | Arc scrubber, growth chips, shadow length readout |
| `features/compliance/` | Pass/fail dock independent of layer opacity |
| `features/bom/` | Live BOM + mitigation chips |
| `features/tier1/` | Quote surface + Wrights Terrace value ledger |
| `features/elevation/` | Full-mode front/side elevation profile |
| `features/trace/` | Click-trace boundary/building + Tab rectangle autocomplete |
| `features/measure/` | Indicative two-point measure tape |

## Visual source of truth

`docs/design/operator-redesign/design_handoff_landscape_cad_studio/screenshots/`
+ `Design Studio v4.dc.html` behaviour — reimplemented, not copied.
