# PHASE 4 SEAM — decision record: elevation-drawn ink → massing geometry

**Status:** v1 draft for review (Pro pass or direct approval) · **Date:** 2026-09-05
**Scope:** roadmap Phase 4 seams — `docs/MENTAL-CANVAS-ROADMAP.md` items
"per-kind Tidy presets + bulk plane assignment" and "elevation-drawn →
massing-landed". This is the gap-analysis decision AGENTS.md's
title-boundary reconciliation rule requires BEFORE build.
**Binding regime:** Gold Standard 2026 supreme; honesty laws (`0.1 never a
dead control`, assumed-never-presented-as-measured) bind everything below.

---

## 0. What exists today (verified against `main` a8ff1e7)

- **Stroke transfer** (`StrokeTransferLayer.tsx`): manual camera ray-cast
  projection of a committed stroke from one canvas plane onto another.
  Operator verb, one stroke at a time.
- **Tidy Z-routing** (`sketchCad.ts`): `KIND_TO_PLANE` maps classified kinds
  to fixed planes (wall→massing +4.0, bed→planting +1.5, ditch/path→ground
  0.0); `convertStrokesToFeatures(strokes, planeOverrides)` lands features at
  `plane_z_m`; the HUD cycle toggle writes per-stroke overrides.
- **Pad extrusion** (`extrude_height_m` on strokes): closed footprint + drag-up
  height = cut/fill pad. Distinct semantics — must never be conflated with
  wall height.
- **Standing canvases**: `SketchCanvas {position, rotation quaternion}`,
  orientation preset "standing" from the placement flyout; strokes live in
  that canvas's board-% space at the canvas's scale.
- **Boundary vocabulary**: photo-trace stamps `boundary_snap {edge_index}` or
  declares "locational-indicative" — reconciliation is a FIRST-CLASS stamp,
  never silent.
- **Height provenance pattern**: `height_source: assumed | measured |
  operator` on `DesignNeighbourBuilding`, with the law "an assumed height
  must never be presented as measured truth".

**The seam:** a wall drawn on a STANDING canvas lives in elevation space.
The plan classifier never sees its vertical extent as height; today that ink
cannot become massing geometry at all. Photo-trace strokes have the same
geometry problem and are (correctly) scoped out with a stamped notice — the
wall case is where we CLOSE that seam instead of stamping it away.

---

## D1 — Reconciliation rule for the landed footprint

**Question:** when a wall drawn on a standing canvas converts to a massing
feature, what does the title-boundary rule demand?

**Options considered:**

- **(a) Auto-snap footprint to the boundary** — REJECTED. Walls relate to the
  building footprint, not the title boundary; and auto-moving drawn geometry
  violates "the drawing is the product" (assist, never constrain).
- **(b) Always stamp locational-indicative** — REJECTED as too weak. The
  standing canvas itself already carries reconciliation provenance from its
  placement; discarding it throws away site truth the operator earned.
- **(c) INHERIT + CONTAIN (adopted).** The landed footprint inherits the
  source canvas's reconciliation provenance, then a containment check runs
  against the title boundary ring:
  - footprint fully inside → feature lands with provenance
    `reconciled (contained in title)`;
  - footprint crosses the boundary → the feature STILL LANDS where drawn
    (never moved), and the Tidy review shows a conflict-crimson warning
    ("crosses the title boundary — keep or adjust") with a `boundary_cross`
    honesty stamp on the feature. Crossing is surfaced, never silenced and
    never auto-corrected.

**Contract:**

```ts
/** D1 — reconciliation status stamped on every converted wall feature. */
export type WallReconciliation =
  | { kind: "contained" }                       // inside the title ring
  | { kind: "crosses"; crossedEdges: number[] } // honest conflict stamp
  | { kind: "indicative" };                     // source canvas had no boundary truth

export function reconcileWallFootprint(
  footprintPct: PctPoint[],
  boundaryPct: PctPoint[],
  sourceCanvasSnap?: { edge_index: number } | null,
): WallReconciliation;
```

Pure, unit-tested, no THREE dependency. `PhotoElevationSheet`'s existing
stamp copy is the UI voice; the Tidy review renders the same vocabulary.

## D2 — Drawn-height projection contract

**Question:** how does vertical ink become a wall height without a mode
change, honestly?

**Adopted rule — only STANDING canvases convert as walls.** On a standing
canvas the plane's local up-axis is world-vertical, so the stroke's extent
along that axis IS a world-metre height at canvas scale. Hinged/flat canvases
keep today's routing (their ink is plan-like; a "height" read from a tilted
plane would be a trigonometric lie).

**Conversion path** (extends `convertStrokesToFeatures`; new canvas-aware
branch for strokes whose `canvas_id` resolves to a standing canvas):

1. Each stroke point → world space via the canvas pose (existing
   `canvasPctToWorld`).
2. **Plan footprint** = each world point dropped onto the massing plane
   (keep world X/Z, discard Y) → board-% ring. The wall lands where it was
   drawn, not snapped.
3. **`height_m`** = max world Y − min world Y across the stroke's points
   (the drawn vertical extent, in metres at canvas scale).
4. **`height_source: "operator"`** — drawn by the operator, NOT assumed, NOT
   survey-measured. Reuses the neighbour-building enum verbatim so one
   vocabulary covers all heights.
5. Reconciliation per D1. `plane_z_m` stays the massing plane's +4.0 stamp.

**Never:** write `extrude_height_m` (pad-only semantics); invent a default
height when the stroke has no vertical extent (degenerate → skipped with the
standard `skipped` counter + reason, per the existing honesty pattern).

```ts
/** D2 — standing-canvas wall conversion. */
export function wallFromStandingStroke(
  stroke: CanvasStroke,
  canvas: SketchCanvas,
  scaleM: number,
  boardAspect: number,
): { footprintPct: PctPoint[]; heightM: number } | null; // null = degenerate
```

## D3 — Schema + Tidy presets

**Schema (additive, no migration):**
- `LandscapeFeature` gains optional `height_m: number` and
  `height_source: "assumed" | "measured" | "operator"` — the exact
  neighbour-building enum, so downstream sun/overshadowing can consume both.
- Optional `boundary_cross: boolean` for the D1 conflict stamp.

**Tidy presets table (per-kind, drives the HUD + bulk assignment):**
- The HUD stops showing a bare plane cycle for standing-canvas ink: wall
  proposals show **plane: massing + height readout + reconciliation chip**;
  bed/ditch proposals keep today's cycle. `KIND_TO_PLANE` remains the single
  default table — the HUD renders FROM it, no second source of truth.
- Marquee multi-select + one plane action = bulk `planeOverrides` (already
  the commit-path shape), gated by the existing marquee selection store.

**Honesty bounds (what this feature must never claim):**
- A drawn height is an operator intent, not a measurement of anything.
- A contained footprint is not "survey-verified" — it is contained-in-title.
- Crossing ink lands where drawn. The platform's job is the stamp, not the
  correction.

---

## Gate plan ("polish sticks only when a gate enforces it")

1. Unit: `wallFromStandingStroke` (standing pose → footprint + height; flat
   pose → null), `reconcileWallFootprint` (contained / crosses / indicative;
   shared-edge tolerance), `height_source` propagation through
   `convertStrokesToFeatures`.
2. Contract: additive schema fields parse legacy payloads unchanged
   (`cad.test.ts`-style round-trip).
3. e2e: extend `webgl-sketch-assist.spec.ts` — draw a wall on a standing
   canvas, commit via Tidy, assert the feature lands at massing with
   `height_m` > 0 and the reconciliation stamp; assert the crossing case
   shows the conflict warning.
4. No new chrome → collision + contrast gates untouched; tokens.css
   unchanged.

## Build order (after this record is approved)

1. D1 + D2 pure modules + unit gates (no UI).
2. `convertStrokesToFeatures` standing-canvas branch + schema fields.
3. Tidy HUD preset rendering + bulk plane assignment.
4. e2e extension + vision shots.
