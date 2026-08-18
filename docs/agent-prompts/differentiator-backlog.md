# Differentiator backlog — "tier above" work items (held)

Status: **held** — explicitly out of the parity-gap sequence. These answer
"what makes this a tier above the best," not "what reaches 3D CAD maturity
parity." Do not start any of these before the parity gaps close and the
operator signs off; do not silently drop them.

## Parity gaps (context, in order)

1. Inspector panel — selection-driven property editing (SKU / species /
   density / dimensions) on `LandscapeFeature`s and `CatalogPlacement`s.
   V1: single selection only; bulk-edit lands after the marquee tool.
   Boundary policy: geometry-affecting edits revalidate via
   `constrainAssetCentre` (alert surface = the clamp reason, crimson tone;
   dig-strike `strike_alert` is a separate signal) before persist;
   attribute-only edits persist directly. Step 0 (autosave fingerprint
   coverage) ships first with its own tests.
2. Marquee box-select rail tool (tool-gated drag box, additive with
   shift, plain-drag pan preserved; option A — placements + features
   only). In build: one drag lands in the inspector's read-only many-refs
   summary.
3. Photo-trace plane-to-ground projection (camera raycast to board-%),
   shipped together with live title-boundary clamping — the facade-to-plan
   converter invents positions, so the reconciliation rule binds it.
   Blocked on a product decision: the depth rule (plane-foot line,
   boundary-edge offset, or operator-set setback).
4. Gizmo phase — rotate / scale / vertex manipulators with their own
   picking, snapping, and undo surface (separate from the inspector).

## Held differentiators (named, scoped)

1. **Section / cut tool system.** Build on the existing `section` rail
   slot, `SliceProfileCard`, and `ElevationSliceLine`: persistent named
   cut planes, saved section views on the elevation sheet. Scope check:
   determine what the current section tool lacks versus a true cut system.
2. **Live AI ghost suggestions in sketch mode.** Heuristic coaching
   (`buildSketchCanvasAiSuggestions`) plus vision ghosts firing in-sketch
   while the operator draws, not only in post-hoc review.
3. **Persistent camera bookmarks as navigation.** Named, saved camera
   poses as a nav system over the canvas (`cameraRig` / `cameraAnimation`
   are the existing foundations).

## Rules

- Parity first: the inspector is the prerequisite — you cannot
  differentiate on top of a tool that cannot edit what it has placed.
- Each item gets its own scoping pass in a fresh context before build.
- Never fold gizmo scope into the inspector build (documented
  scope-expansion failure mode).
- Policy classifications that affect persistence or boundary behavior
  become tested code modules, not doc claims (the inspectorPolicy pattern
  — a future session cannot silently ship a clamp-triggering field as
  direct-persist without breaking a test).

## Verification status notes

- "Selection survives mode switches" is PARTIALLY verified: the
  `webgl-sketch-to-cad` e2e proves the inspector and selection chip do not
  break across mode switches. A spec asserting the SAME selection refs are
  preserved across every mode transition is still future work.
- Pan-gesture integrity: `webgl-pan-zero-commit` guards the zero-React-
  commit camera pan law; marquee drags are tool-gated, so the default
  drag path must never regress that gate.
