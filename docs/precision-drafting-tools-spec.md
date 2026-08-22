# Precision drafting tools — Polyline, Curve, Area (WebGL surface)

Design spec (2026-08-22). Status: **for review — no code changed.**

The last unbuilt feature of Gold Standard Phase 1: constrained, exact drafting
on the WebGL studio. Today the only way to put a line on the drawing is to
sketch it freehand and hope the Tidy classifier rounds it correctly.

## 1. Why this is the next WebGL feature

- `docs/GOLD-STANDARD-2026.md` §3 Phase 1 (SUPREME) lists **"Floating Tool
  Ribbon: A minimalist vertical ribbon for professional drafting (Polyline,
  Curve, Area)"** as a required Phase 1 feature. It is the only Phase 1 bullet
  still unbuilt — infinity zoom, the Asset Discovery fan-out, the flora ring
  and AI auto-placement have all shipped.
- `OUTSTANDING.md` ranked priority 6 names "Phase 1 floating tool ribbon on the
  GL surface"; the build-status section says plainly: *"Still missing on the GL
  surface: the floating tool ribbon (Polyline/Curve — planned next; Area routes
  to `SpatialObject`/`outline_pct`, not a stroke)."*
- The only other unbuilt phase is **Phase 4 Build Pack** (compliance audit +
  contractor CAD/spec bundle). That is a larger slice, needs export
  infrastructure and a regulatory data source, and is worth less until the
  drawing it exports can be drawn precisely.

There is also a code-level audit finding that this work should absorb — see §3.

## 2. Current state (verified in code)

**Freehand is the only input.** `FusedSketchLayer.tsx` captures a pointer
stream into a `CanvasStroke` with `kind: "ink"`, plus the drag-up
extrude-to-mass gesture. There is no click-to-place vertex path anywhere on the
WebGL surface.

**The snap engine already exists and is multi-vertex ready.**
`webgl/snapWorld.ts` exports `snapDrawPointer(rawX, rawZ, { origin, last,
vertices }, opts)` with the ladder close (`SNAP_CLOSE_M` 2.0 m) → vertex
(`SNAP_VERTEX_M` 1.2 m) → 45° (`SNAP_ANGLE_STEP_DEG`, 5° tolerance). It already
takes a committed-vertex array and an origin for polygon closing — it was
written for exactly this tool and is currently only driving the freehand
`SnapMarker`. **No new snap maths is needed.**

**Contracts already model shapes, partially.**
`packages/contracts/src/schemas/catalog.ts:184-187` carries
`kind: z.enum(["ink", "shape"])`, `shape_tool: z.enum(["line", "rect",
"circle"])` and `shape_start` / `shape_end`. This is a two-point model written
for the retired SVG `SketchBoard`.

**The Area target exists.** `LandscapeFeatureSchema`
(`packages/contracts/src/schemas/landscape-feature.ts:117`) with
`FeatureGeometrySchema` and `material_fill`. The sketch→CAD path already
persists a mirrored Polygon feature whose id equals the placement id.

**CAD export already speaks the vocabulary.** `CadSyncAssetSchema`
(`schemas/cad.ts:260`) includes `polyline` and `arc` kinds, so Stage 2 export
does not need new entity types for this.

## 3. Audit finding this work must absorb

**Shape strokes hydrate but have no renderer on the only surface that exists.**
`WebGLStudioPreview.tsx:593-597` maps `kind`, `shape_tool`, `shape_start` and
`shape_end` out of the persisted `CanvasStroke` into the store, but no layer in
`webgl/` consumes `shapeTool`. The producer (SVG `SketchBoard`) was deleted in
the 2026-08-19 retirement, so nothing writes them today and the gap is
invisible — but any project whose canvas was saved before that date carries
shape strokes that now render as ordinary ink or not at all.

Whatever persistence shape this feature takes, it has to add a shape renderer
to the WebGL surface, which closes this latent defect at the same time.

## 4. The product gap in one sentence

Freehand plus a classifier is a guess; setting out a 4.2 m path, a rectangular
deck or a title-parallel garden edge needs exact vertices, and the studio has
no way to produce one.

## 5. Target design

### Interaction model — one draft session

A single `draftSession` slice in `studioStore`, shared by all three tools:

```
draftSession: {
  tool: "polyline" | "curve" | "area";
  vertices: WorldXZ[];
  hint: SnapHint | null;   // live, from snapDrawPointer
} | null
```

- Click places a vertex through `snapDrawPointer` (origin = first vertex, last
  = previous, vertices = all committed).
- Pointer move updates the rubber-band preview segment and the snap marker.
- `Backspace` removes the last vertex; `Esc` cancels the whole draft.
- `Enter` or double-click finishes an open run; clicking the origin (the
  `close` snap already returns `kind: "close"`) finishes a closed one.
- A live readout follows the cursor: segment length in metres and bearing in
  degrees, both derived, both honest.

This is a *tool-gated pointer mode*, exactly like the existing marquee tool, so
it inherits the pan law: unarmed drag still pans, mod-drag still orbits.

### The three tools

**Polyline** — open or closed run of straight segments. Persists as linework.

**Curve** — same vertex placement; segments render as a Catmull-Rom spline
through the placed points (see open question 2). Persists the control points,
not the tessellation, so it stays editable and small.

**Area** — a polyline that must close. On close it persists a
`LandscapeFeature` with `material_fill`, which is what makes it a costed region
rather than decoration.

## 6. Persistence — the decision this spec needs

Two candidates:

**(a) Everything as `CanvasStroke` with `kind: "shape"`.** Reuses the stroke
pipeline wholesale: undo, autosave fingerprint, design-VCS three-way merge. But
`shape_start`/`shape_end` is a two-point model, so it needs a new optional
points array regardless.

**(b) Split by what the thing *is* — recommended.** Polyline and Curve are
linework and persist as `CanvasStroke`; Area is a region and persists as a
`LandscapeFeature`. This matches the existing rule that accepted proposals with
drawn outlines persist a mirrored Polygon feature, and it means an Area is
costable the day it is drawn.

Either way this is a `packages/contracts` change **first**, per `CLAUDE.md`:
extend `shape_tool` with `"polyline" | "curve"` and add an optional
`shape_points: z.array(CanvasStrokePointSchema)`. Both are additive and need no
migration.

## 7. Scope slices

| Slice | Contents | Size |
|---|---|---|
| v1 | Contracts extension + shape renderer (closes §3) + draft session + Polyline + Area + boundary-edge snap + live readout + rail tools + `cutFill` accepts feature pads (§8.1) | M |
| v2 | Curve (Catmull-Rom through the same vertices) | S |
| v3 | Numeric entry — type a length mid-draft to constrain the next segment | S |
| v4 | Vertex editing on a committed shape (drag a vertex, insert/delete) | M |

v3 is what makes this "professional" rather than "tidier freehand", but it is
worthless without v1 and is cleanly separable.

## 8. Decisions (product, 2026-08-22)

1. **Rail, not a second ribbon — DECIDED.** The three tools extend
   `StudioToolRail`. Tool triggers stay in the established left rail (x=8–64),
   which protects canvas real estate and keeps the measured 8 px gap to the nib
   palette at x=72. No second vertical rail.
2. **Boundary-edge snap — DECIDED, in v1.** Title boundary edge segments become
   an explicit rung in `snapDrawPointer` alongside the vertex and 45° rungs,
   using the same per-edge world-space geometry `DimensionLayer` already
   derives via `pctToWorld`.
3. **Area consolidates region creation — DECIDED, with a constraint.** Area is
   the one way to *create* a closed region; freehand-plus-drag-up is not a
   second creation path. See §8.1 — "consolidate" cannot mean "delete extrude",
   because of a coupling found after the decision was taken.
4. **Curve type — still open.** Catmull-Rom through-points (no handles, no
   extra chrome) vs cubic with draggable handles (more control, more chrome,
   more hit-testing). Recommend Catmull-Rom for v2; revisit if operators ask
   for handles. Does not block v1.
5. **Title-boundary reconciliation — no new event.** Per `AGENTS.md`, any new
   sited geometry must reconcile with the boundary or be stamped
   locational-indicative. These tools place vertices in world space from the
   operator's own pointer, so they invent no positions — the same reading that
   applied to sketch→CAD conversion. Note the boundary snap in decision 2
   actively *strengthens* reconciliation rather than weakening it.

### 8.1 The extrude coupling — why "consolidate" is not "delete"

`cutFill.ts` states it is "the single definition of what is a pad: a closed
stroke carrying a positive `extrude_height_m`", and both `EarthworksLayer`
(scene) and `EarthworksCard` (HUD) read `padStrokes()` from it. The drag-up
extrude gesture is therefore not merely a rival way to draw a region — it is
**the only input to the cut/fill earthworks feature**.

Two consequences the build must respect:

- **Deleting the extrude gesture would silently remove earthworks' data
  source.** Cut/fill would render nothing, with no error.
- **Persisting Area as a `LandscapeFeature` (§6b) would make Area pads
  invisible to `cutFill`,** which scans strokes only. Drawing a pad with the
  new tool would produce no earthworks analysis — a silent regression against
  the current freehand behaviour.

**Resolution.** Split creation from elevation:

- **Area owns creation.** It is the only way to draw a new closed region, and
  it persists as a `LandscapeFeature` so the region is costable on creation.
  The freehand drag-up gesture stops being a *creation* path.
- **Height becomes a property of a region, not a second drawing mode.** Setting
  a height on a selected Area (via the inspector, and optionally the same
  drag-up affordance once one is selected) is an edit, not a draw.
- **`cutFill.padStrokes()` extends to accept features carrying a height,** so
  there remains exactly one definition of "pad" and earthworks keeps working
  for both legacy extruded strokes and new Areas.

This satisfies the intent behind the decision — no competing pathways for
*creating* a region — without breaking a shipped feature. If product prefers
the harder line (delete extrude outright), earthworks must be re-pointed at
features in the same slice, and legacy extruded strokes need a migration.

## 9. Verification

- **Unit:** draft-session reducer (add / undo vertex / cancel / close),
  Catmull-Rom tessellation, shape→`LandscapeFeature` geometry conversion,
  boundary-edge snap rung. All pure, colocated `*.test.ts`.
- **e2e (new kept probe):** `webgl-drafting-tools.spec.ts` — arm Polyline,
  place four vertices, close on the origin snap, assert the shape renders, then
  reload and assert it persisted; repeat for Area asserting a costed line
  appears in the fit sheet.
- **Kept gates that must stay green:** `webgl-chrome-collision.spec.ts` (three
  new rail tools change the rail's height, and the rail-label contract caps
  pills at 42 px — "Polyline" is 8 characters, at the truncation threshold),
  `webgl-contrast-aa.spec.ts`, `canvas-first-z-stack.spec.ts`.

## 10. Acceptance criteria

- [ ] Polyline places exact vertices with the existing snap ladder, closes on
      the origin, and cancels cleanly on Esc
- [ ] Area closes into a persisted `LandscapeFeature` that appears in the fit
      sheet as a costed line
- [ ] A live length + bearing readout tracks the pointer during a draft
- [ ] Shape strokes render on the WebGL surface (closing the §3 defect)
- [ ] Drafting is tool-gated — unarmed drag still pans, mod-drag still orbits
- [ ] Contracts extended additively, no migration
- [ ] New unit tests + the new kept e2e probe pass; the three kept gates above
      stay green
- [ ] Rail labels still fit their 42 px pills without wrapping
- [ ] Cut/fill earthworks still renders for legacy extruded strokes AND for
      new Areas carrying a height (§8.1) — verified, not assumed
