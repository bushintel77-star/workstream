# PHASE 4 SEAM — decision record: elevation-drawn ink → massing geometry

**Status:** v2 — Pro review pass complete (in-session, 2026-09-05); three
amendments folded in (§A1–A3); ready for build. · **Date:** 2026-09-05
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
- **(b) Always stamp locational-indicative** — REJECTED as too weak: the
  landed footprint's horizontal position is real plan-space geometry and CAN
  be checked against the title ring.
- **(c) CONTAINMENT (adopted; amended by A1).** The landed footprint is
  checked for containment against the title boundary ring, computed in the
  shared board-% horizontal space (valid because every fixed plane shares the
  one horizontal board grid — a footprint dropped onto massing at +4.0 is
  horizontally comparable with the ground-space title ring):
  - footprint fully inside → feature lands stamped `contained in title`;
  - footprint crosses the boundary → the feature STILL LANDS where drawn
    (never moved), the Tidy review shows a conflict-crimson warning, and the
    feature carries `boundary_cross: true`. Crossing is surfaced, never
    silenced and never auto-corrected.
  - no title boundary on the project → `indicative` (the photo-trace
    vocabulary).

**> A1 (Pro review amendment):** v1 said the landed footprint "inherits the
source canvas's reconciliation provenance" — that field DOES NOT EXIST:
`SketchCanvas` carries `{id, label, position, rotation, season_tag}` only;
`boundary_snap` lives on photo elevations, not canvases. The inherit path was
vacuous and is removed. Containment IS the reconciliation. (Placing canvases
with a boundary-snapped base edge — the photo-trace pattern applied to plane
placement — remains a worthwhile FUTURE provenance enhancement, explicitly
out of scope here.)

**Contract:**

```ts
/** D1 — reconciliation status stamped on every converted wall feature. */
export type WallReconciliation =
  | { kind: "contained" }                       // inside the title ring
  | { kind: "crosses"; crossedEdges: number[] } // honest conflict stamp
  | { kind: "indicative" };                     // project has no boundary truth

export function reconcileWallFootprint(
  footprintPct: PctPoint[],
  boundaryPct: PctPoint[],
): WallReconciliation;
```

Pure, unit-tested, no THREE dependency. `PhotoElevationSheet`'s existing
stamp copy is the UI voice; the Tidy review renders the same vocabulary.

## D2 — Drawn-height projection contract

**Question:** how does vertical ink become a wall height without a mode
change, honestly?

**Adopted rule — only geometrically-standing canvases convert as walls
(amended by A2).** On a standing canvas the plane's local up-axis is
world-vertical, so the stroke's extent along that axis IS a world-metre
height at canvas scale. Tilted/folded/flat canvases keep today's routing
(their ink is plan-like; a "height" read from a tilted plane would be a
trigonometric lie).

**> A2 (Pro review amendment), two parts:**

1. **Standing-ness is GEOMETRIC, not a preset tag.** The hinge gizmo
   (HingeProjectionGizmo, Phase A2) can fold a plane AFTER placement, so the
   placement preset (`PlaneOrientation: "flat" | "standing"`) is not stable
   truth. Standing-ness is computed from the live rotation quaternion:
   `|planeNormal · worldUp| < ε` (ε = 1° equivalent). A plane that was placed
   standing then folded past ε stops converting as a wall — correctly.
2. **Wall conversion requires a CLOSED stroke (the wall-face outline).** An
   open vertical stroke drops to a zero-width line on the massing plane —
   not a polygon; inventing a thickness would be the exact fake-precision
   this platform forbids. A closed outline carries its own drawn thickness
   and drops to a proper polygon footprint. Open strokes are skipped with
   the standard counter + reason — the same closed-loop gate the Tidy path
   already applies to beds/pads/hatch.

**Conversion path** (extends `convertStrokesToFeatures`; new canvas-aware
branch for CLOSED strokes whose `canvas_id` resolves to a standing canvas):

1. Each stroke point → world space via the canvas pose (existing
   `canvasPctToWorld`), gated by the A2 geometric standing test.
2. **Plan footprint** = each world point dropped onto the massing plane
   (keep world X/Z, discard Y) → board-% ring. The wall lands where it was
   drawn, not snapped.
3. **`drawn_height_m`** = max world Y − min world Y across the stroke's
   points (the drawn vertical extent, in metres at canvas scale).
4. **`height_source: "operator"`** — drawn by the operator, NOT assumed, NOT
   survey-measured. Reuses the neighbour-building enum verbatim so one
   vocabulary covers all heights.
5. Reconciliation per D1. `plane_z_m` stays the massing plane's +4.0 stamp.

**Never:** write `extrude_height_m` (pad-only semantics); invent a default
height or thickness when the stroke is degenerate (open / zero vertical
extent → skipped with reason, per the existing honesty pattern).

```ts
/** D2 — standing-canvas wall conversion. Null = not a wall candidate. */
export function wallFromStandingStroke(
  stroke: CanvasStroke,
  canvas: SketchCanvas,
  scaleM: number,
  boardAspect: number,
): { footprintPct: PctPoint[]; drawnHeightM: number } | null;
```

## D3 — Schema + Tidy presets

**Schema (additive, no migration; amended by A3):**
- `LandscapeFeature` gains optional **`drawn_height_m: number`** — the
  qualified name joins the existing `_m` family (`extrude_height_m` = pad
  raise above grade, `plane_z_m` = base-plane elevation, `drawn_height_m` =
  vertical extent drawn on a standing canvas) so pad-vs-wall can never be
  confused by name. It already has NO `height_m` field (verified), so no
  collision — but the bare name `height_m` (v1) is rejected precisely
  because the qualified family exists.
- Optional `height_source: "assumed" | "measured" | "operator"` — the exact
  neighbour-building enum, so downstream sun/overshadowing consumes both
  vocabularies as one.
- Optional `boundary_cross: boolean` for the D1 conflict stamp.

**Tidy presets table (per-kind, drives the HUD + bulk assignment):**
- The HUD stops showing a bare plane cycle for standing-canvas ink: wall
  proposals show **plane: massing + drawn-height readout + reconciliation
  chip**; bed/ditch proposals keep today's cycle. `KIND_TO_PLANE` remains
  the single default table — the HUD renders FROM it, no second source of
  truth.
- Marquee multi-select + one plane action = bulk `planeOverrides` (already
  the commit-path shape), gated by the existing marquee selection store.
  **(A3) Bulk assignment commits ONE history step** — the operator undoes
  one re-planing decision, not N per-feature edits.

**Honesty bounds (what this feature must never claim):**
- A drawn height is an operator intent, not a measurement of anything.
- A contained footprint is not "survey-verified" — it is contained-in-title.
- Crossing ink lands where drawn. The platform's job is the stamp, not the
  correction.

---

## Gate plan ("polish sticks only when a gate enforces it")

1. Unit: `wallFromStandingStroke` (standing pose → footprint + drawn height;
   folded/tilted pose → null; open stroke → null), `reconcileWallFootprint`
   (contained / crosses / indicative; shared-edge tolerance), the geometric
   standing test (placed-standing-then-folded → not standing),
   `drawn_height_m` + `height_source` propagation through
   `convertStrokesToFeatures`, bulk plane assignment = one history commit.
2. Contract: additive schema fields parse legacy payloads unchanged
   (`cad.test.ts`-style round-trip).
3. e2e: extend `webgl-sketch-assist.spec.ts` — draw a closed wall outline on
   a standing canvas, commit via Tidy, assert the feature lands at massing
   with `drawn_height_m` > 0 and the reconciliation stamp; assert the
   crossing case shows the conflict warning; assert an open stroke is
   skipped with the stated reason.
4. No new chrome → collision + contrast gates untouched; tokens.css
   unchanged.

## Build order (after this record is approved)

1. D1 + D2 pure modules + unit gates (no UI).
2. `convertStrokesToFeatures` standing-canvas branch + schema fields.
3. Tidy HUD preset rendering + bulk plane assignment.
4. e2e extension + vision shots.
