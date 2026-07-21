# Canvas remaining features — engineering handover

**Scope:** Operator canvas only.
**Product phase:** Workflow 1 professional sketch now; Stage 2 true CAD only where explicitly identified.
**Source brief:** `workstream-canvas-implementation-prompt.md` supplied 21 July 2026.
**Status:** Canonical handover for the balance of requested canvas work.

## Product laws

These rules override individual feature notes:

1. The drawing is the product. Idle chrome stays limited to the mode row,
   material tray and state breadcrumb.
2. Plan geometry is the source of truth for measurements, quantities, prices
   and checks.
3. Feedforward comes before commit: previews, ghosts, arcs and corridors show
   the proposed result.
4. Workflow 1 percentage geometry is indicative. Survey-grade set-out,
   topography, offsets and exports remain Stage 2.
5. AI never writes accepted geometry without an operator action.

## Status key

| Status | Meaning |
| --- | --- |
| Shipped | Present in the live Handoff studio and covered by code/tests |
| Partial | Useful slice exists; acceptance criteria are not yet complete |
| Contract required | Workflow is defined, but persistence must be approved in `packages/contracts` first |
| Stage 2 | Requires metre-space geometry, height data or a new CAD document model |
| Deferred | Explicitly prohibited until its dependency exists |

## Current delivered foundation

The following should be treated as existing infrastructure, not rebuilt:

- Canvas-first progressive disclosure and tactile soft-CAD chrome.
- Drag measurement, snap pulse/glyphs, selected-item readout and precision zoom.
- Swatch apply, preview, eyedropper and direct canvas paint.
- Sketch pen/finger capture, pressure-derived stroke width, whole-stroke eraser,
  undo, tidy and persistent ink.
- Explicit Sketch → CAD formalisation through reviewable ghosts. Original ink
  remains as a quiet CAD reference.
- Seasonal sun-study dates, time scrubber and indicative shade mesh.
- Spot-level RL pins with downhill fall percentage and millimetre change.
- Layer isolation with non-hittable dimmed layers and a dismissible breadcrumb.
- AI/manual history ticks and session-only placement/style/cost rejection hints.
- Typed trace length/angle input and Shift rotation protractor feedforward.
- Constant-screen-size vector handles, 8 px edge targets and projected
  double-click vertex insertion.
- Dynamic title/building/outdoor area labels and the compact measure summary.
- Save/saving/retrying/error states with explicit manual retry.

## Workflow 1 balance

### Precision input completion

**Status:** Partial

Typed length and angle currently work for trace creation. Extend the same shared
interaction to every remaining create or transform drag:

| Operation | Required fields | Commit behaviour |
| --- | --- | --- |
| Item move | Distance, angle | Enter or pointer-up uses typed endpoint |
| Item resize | Width/diameter or scale | Use plan metres; never expose `%` |
| Item rotate | Angle | Keep the existing 15° Shift protractor |
| Boundary/building vertex | Previous edge, next edge | Show both adjacent lengths |
| Measure | Length, angle | Typed endpoint replaces pointer endpoint |
| Area creation | Length, angle, resulting area | Area is derived, not independently editable |

Acceptance:

- First numeric key focuses the cursor field.
- Tab cycles available fields.
- First Escape clears typed input; second Escape cancels the operation.
- Pointer-up with typed content commits typed values.
- Values use the active calibration and never display percentage coordinates.

Primary code:

- `features/trace/TraceOverlay.tsx`
- `features/cadPlan/CadPlanBoard.tsx`
- `features/cadPlan/SelectionHandles.tsx`
- `features/measure/MeasureOverlay.tsx`
- `geometry/drafting.ts`

### Snap vocabulary completion

**Status:** Partial

Current snap reasons cover vertex, alignment, orthogonal and grid. Add:

- Midpoint.
- Perpendicular.
- Tangent, only when true arc/circle geometry exists.
- Candidate priority: vertex → midpoint → perpendicular → grid.

Only one glyph may display. Tangent must not be inferred from rectangular
catalog bounds.

### Vector micro-behaviour completion

**Status:** Partial

Still required:

- Adjacent segment length pills during vertex drag.
- A distinct coincident-vertex warning. Do not merge automatically.
- Hovering a non-editing line should reveal its vertices at reduced opacity.
- Double-click delete must retain the refusal flash when three vertices remain.
- Semantic line weights must also cover authored bed/path geometry once those
  become true shapes rather than catalog symbols.

### Tool and panel Escape hierarchy

**Status:** Partial

The two-slot tool stack and Q toggle are shipped. Esc-to-Select no longer
overwrites the previous real tool.

Remaining:

1. Escape from a tool → Select.
2. Escape from Select with a selection → clear selection.
3. Escape with no selection → close only the topmost contextual surface.

Do not close every open surface in one key press.

### Multi-selection measurement

**Status:** Partial

Single-item readouts are shipped. Multi-selection must show:

- Item count.
- Summed area for area-bearing items.
- Summed lineal metres where applicable.
- No per-item pills while the group readout is visible.

### Empty pre-project canvas

**Status:** Product decision required

The supplied brief asks for a blush canvas with one centred address input before
a project exists, but also declares the dashboard out of scope. Current `/`
remains the dashboard/project list.

Choose one before implementation:

1. Replace the home entry with the address-only canvas; or
2. Add a dedicated `/new` canvas route and retain the dashboard.

Do not partially hide project chrome without defining project creation and
navigation.

## Practical site operations

### Machinery access and sweep corridor

**Status:** Contract required

Goal: answer, for example, “Can a 1.2 m bobcat travel from this gate to the rear
work area?”

Proposed Workflow 1 record, subject to contracts approval:

```ts
type DesignAccessPath = {
  id: string;
  label: string;
  machine_profile: "mini-loader-1.0" | "bobcat-1.2" | "custom";
  required_width_m: number;
  safety_clearance_m: number;
  points: Array<{ x_pct: number; y_pct: number }>;
  source: "operator-trace";
};
```

Add `access_paths[]` to `DesignCanvas` only after the schema is accepted.
Do not overload `site_frame.services[]`; a machine route is not a utility.

Workflow:

1. Operator selects a machine profile and traces a centreline from the gate.
2. Before commit, show the full buffered sweep corridor.
3. Check the corridor against title boundary, existing house, fixed structures,
   protected-tree zones and operator-authored exclusions.
4. Return `Pass`, `Tight` or `Blocked`.
5. Mark the narrowest point and first collision directly on plan.

Geometry:

- Convert percentage points to the calibrated planar-metre frame.
- Use a tested Turf line buffer at
  `(required_width_m / 2) + safety_clearance_m`.
- Never use `packages/domain/src/geometry.ts#subtractPolygon`; it is a stub.
- If scale is uncalibrated, disable the verdict and show “Calibrate to test
  machine access”.

Acceptance:

- The corridor is feedforward before commit.
- Verdict and bottleneck update when the route, machine or obstacle moves.
- The check never claims swept-turn clearance unless the turning-radius model
  exists.
- The result is labelled indicative in Workflow 1.

### Drainage and water movement

**Status:** Partial / Stage 2 split

Shipped:

- French drain symbol.
- Service/easement traces.
- RL pins.
- Downhill arrows between authored consecutive levels.
- Fall percentage and millimetre difference.

Workflow 1 balance:

- Let the operator explicitly connect level pins into drainage runs instead of
  assuming capture order is hydraulic order.
- Add invert level, outlet type and “confirm locate” provenance to a drainage
  run contract.
- Feed traced drainage/service proximity into AI confidence instead of the
  current neutral drainage score.
- Produce a small on-plan drainage schedule from the same run geometry.

Stage 2:

- TIN surface interpolation.
- Surface-wide flow arrows.
- Ponding/low-point detection.
- Existing-versus-proposed cut/fill drainage analysis.

Do not infer ponding from isolated spot levels without a surface model.

### Set-out and peg confidence

**Status:** Partial

Shipped RL pins are viewable across plan modes. Remaining:

- Persist board calibration (`board_width_m` or an approved equivalent).
- Add optional peg label/note and source:
  `survey`, `operator`, `derived`, `AI proposal`.
- Show confidence/provenance without implying survey certification.
- Produce a printable peg schedule: point ID, RL, adjacent fall and note.
- Stage 2 may add bearing/distance from a locked title origin and DXF export.

### Sun and shade

**Status:** Partial / height contract required

Shipped:

- Today, both equinoxes and both solstices.
- Time scrubber.
- Growth-stage control.
- Coarse indicative shade-hours mesh.

Remaining truthful C1 work:

- Melbourne-correct solar time including daylight saving.
- Instant projected shadows and accumulated daily shade-hours modes.
- Building, structure, fence, screen, existing-tree and proposed-canopy
  casters.
- Per-zone sun exposure supplied to AI planting selection.

This depends on approved heights. Do not label the existing coarse grid as a
real building-shadow calculation.

## Sketch workflow balance

**Status:** Functional basic workflow; refinement remains

Remaining:

- Pen-priority palm rejection and explicit non-primary pointer handling on
  tablet hardware.
- Persist per-point pressure only if the contracts schema is extended; current
  persistence stores a pressure-derived stroke width.
- Partial stroke eraser. Current eraser removes a whole stroke.
- Lasso/select/transform for sketch ink.
- Optional “Archive ink after accept” action.
- Deterministic E2E coverage: draw → tidy → formalise → accept → reload.
- Improve formalisation from one symbol at each stroke centroid to authored
  path/shape geometry where the Workflow 1 schema supports it.

The fast path must stay: draw, optionally tidy, explicitly formalise, review,
accept.

## Stage 2 height and terrain

Do not add these fields to Workflow 1 `DesignCanvas` without the Stage 2
contracts brief:

1. Asset height properties and growth-stage crown dimensions.
2. Structure `topRL` / `bottomRL`.
3. Finished surface level at each defining vertex.
4. TIN and derived contours.
5. Cut/fill volumes and visible assumptions.
6. Retaining wall area by height band.
7. Step count/riser compliance.
8. Terrain cut/fill wash, slope thresholds, ponding and erosion checks.
9. Tilt camera, diagrammatic 3D, camera pins and sightline screening.

Plan remains authoritative. Tilt is a view state and may never author geometry.

## Explicitly deferred

Keep these deferred until their named dependency exists:

- Large-proposal inline diff scrubber — stable geometry IDs required.
- Constraint pinning — solver-enforced constraint objects required.
- Per-edge AI rationale — segment provenance required.
- Path array/repeat — true arc-length geometry required.
- Boolean marching-ants preview — robust Boolean engine required.
- Multi-user cursors — multi-user sessions required.
- Photoreal rendering — intentionally outside product direction.

## Recommended implementation order

1. Complete dynamic input coverage and vector micro-behaviour.
2. Approve and add the machinery access-path contract, then build the corridor
   test.
3. Persist calibration and add the peg schedule.
4. Add explicit drainage runs and service-aware drainage confidence.
5. Complete sketch tablet QA and deterministic E2E coverage.
6. Open the Stage 2 height contract.
7. Build real sun shadows on approved height data.
8. Build TIN, cut/fill and terrain drainage.
9. Add tilt camera and sightline tools only after plan/height reconciliation is
   tested.

## Release gates

- No operator-facing percentage coordinates.
- Every metre/area/volume value uses the same calibrated plan geometry as BOM.
- Every Workflow 1 spatial verdict says indicative.
- No unavailable building, utility, level or access geometry is invented.
- Client mode hides internal controls, confidence, measurement pills and view
  cones.
- AI/manual provenance is visible in history.
- Save failure remains visible and recoverable.
- Reduced-motion disables decorative motion.
- Contract tests precede API/client changes.
- Unit tests cover geometry; Playwright covers the operator journey.

## Primary code map

| Concern | Location |
| --- | --- |
| Studio shell and keyboard | `apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx` |
| Local studio state/history/save | `apps/web/src/components/canvas/handoff/state/useStudioState.ts` |
| Plan interaction | `apps/web/src/components/canvas/handoff/features/cadPlan/` |
| Sketch capture | `apps/web/src/components/canvas/handoff/features/sketch/` |
| Levels/services | `apps/web/src/components/canvas/handoff/features/survey/` |
| Sun controls/shade | `apps/web/src/components/canvas/handoff/features/sunGrowth/`, `features/shade/` |
| Workflow 1 schema | `packages/contracts/src/schemas/catalog.ts` |
| Stage 2 CAD schema | `packages/contracts/src/schemas/cad.ts` |
| Tested Boolean area | `packages/domain/src/outdoor-area.ts`, `spatial-turf.ts` |
| Sketch interpretation | `packages/domain/src/sketch-to-cad.ts` |
| Product phase firewall | `docs/STUDIO-PRODUCT-PHASES.md` |

## Required product decisions

1. Dashboard replacement versus dedicated `/new` empty canvas.
2. Approved machine profiles, clearance allowances and whether turning radius
   is included in the first access test.
3. Calibration persistence field and authority.
4. Drainage run fields and provenance.
5. Stage 2 height-contract opening.

Until those decisions are made, keep the affected controls out of the UI rather
than shipping non-functional or misleading chrome.
