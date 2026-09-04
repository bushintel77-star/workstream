# Morpholio Trace — 3D Gap Analysis (2026)

**Status:** Decision record + roadmap input · **Date:** 2026-09-04 ·
**Owner:** canvas platform
**Goal (user direction, clarified 2026-09-04):** an **immersive 3D
freehand-sketch drawing experience in the manner of Mental Canvas, fused
with Morpholio Trace's 2D sketch-CAD fluency** — "Mental Canvas into
Trace." The operator draws freehand *inside* 3D space (on planes they
place anywhere), the drawing is ambiently precise and calibrated like
Trace, and the same ink becomes survey-honest site geometry.
**Binding regime:** Gold Standard 2026 (`docs/GOLD-STANDARD-2026.md` — the
drawing is the product; Zero-Chrome WebGL; `apps/web/src/styles/tokens.css`
is the token source of truth). Anything below that contradicts the supreme
brief loses.

---

## 1. Method

- **External research:** a 56-feature inventory of Morpholio Trace
  ("Trace — Sketch CAD", Morpholio Apps, iPad/Apple-Pencil-first; current
  guide v6.5–6.9), built from the official user guide + App Store listing,
  cross-checked against third-party reviews (ArchDaily, Designboom, BIM Tools
  Hub, Reddit r/LandscapeArchitecture, r/Architects). Feature citations in
  §3; source list in §8.
- **Internal inventory:** the WebGL studio surface as of commit 9e02e07 +
  the 2026-09-04 fix pass (sketch ink engine, stroke→CAD recognition, depth
  planes, terrain/cut-fill, sheets, present/share, subsurface conflicts).

## 2. What Trace actually is (the interaction essence)

Trace's philosophy is **the digital trace pad on a real drafting board**:

1. **Bounded translucent sheets, not an infinite canvas.** Each layer is a
   sheet of trace with its own paper opacity, drawing opacity, and blend
   mode (Multiply keeps linework visible under fills). Sheets stack, peel,
   duplicate, and reorder — the stack IS version history.
2. **Ambient, calibrated precision.** You set the world's scale ONCE — from
   a known doorway dimension, an AI-read printed scale bar, or a satellite
   map — and every tool (ScalePen lineweights, rulers, stencils at "1:1",
   live area fills, Export to Scale) quietly knows real units while the hand
   stays freehand.
3. **Assist, never constrain.** Hold-to-straighten, snap-to-vanishing-point,
   draw-along-the-ruler: the stroke is always yours; the tool tidies it.
4. **Everything is an underlay to think over.** Photos, PDFs, LiDAR room
   scans, 3D meshes (USDZ/OBJ), AR floors — all exist to be drawn on. Trace
   never lets you *inhabit* the third dimension: no terrain, no modeling, no
   grading. Its "3D" is a static view to sketch over plus AR line
   extrusion.

That last point is the strategic opening: **Trace is a magnificent 2D
surface that only borrows 3D views to draw on.** Mental Canvas is the
opposite half — pure immersive 3D freehand with no site truth, no scale
contract, no CAD. The goal "Mental Canvas into Trace" is therefore not
"copy Trace in 3D" — it is **Trace's 2D sketch-CAD fluency running on our
Mental-Canvas-grade 3D engine**: keep every stroke freehand and ambiently
precise, drawn on planes placed anywhere in space, and let the same ink
BE calibrated site geometry (features, terrain, sheets) without a mode
change.

## 2b. The Mental Canvas half is already built

The studio's own spatial-sketching engine (built under
`docs/MENTAL-CANVAS-ROADMAP.md`, phases A–R COMPLETE; see also
`docs/MENTAL-CANVAS-GAP-ANALYSIS.md`) already implements the core Mental
Canvas interaction model. Parity map:

| Mental Canvas feature | Shipped counterpart |
|---|---|
| Infinite transparent 2D canvases positioned anywhere in 3D | `SketchCanvasGroup` — each canvas a spatial node (position + rotation quaternion, raycast mesh, board-% strokes) |
| Place/orient canvases (perspective placement) | `CanvasPlacementFlyout` (5 presets + numeric height/bearing), `ParallelProjectionHandle`, `HingeProjectionGizmo` (fold-angle drag, angle snap) — roadmap Phase A |
| Projection: 2D drawings into 3D scenes | `StrokeTransferLayer` — forward-perspective projection of strokes between canvas planes (turn 14a) |
| Trace over photos/drawings loaded onto canvases | Photo-trace elevation: pinned site photos as frozen calibrated camera frames, boundary-snapped |
| Bookmark views / camera flights / animation | `ViewpointFilmstrip` + `FlythroughRig` (spline playback, per-segment timing, loop), visibility keyframes per viewpoint |
| Draw face-on, free-orbit to view | `DrawViewToggle` — Draw Mode locks the camera face-on to the active canvas; View Mode free-orbits |
| Stroke fading with viewing angle | `AngleOpacityShader` (view/normal smoothstep + seasonal crossfade, falloff presets) |
| Layers per canvas / visibility | `CanvasCardsRail` (live thumbnails, eye toggles, reorder), `VisibilityPanel` (canvas × viewpoint matrix) |
| Unscaled start, calibrate later | `CalibrateModal` — retroactive two-point calibration, SCALE THEM / KEEP HEIGHTS |

What Mental Canvas has that we do not: free-form **animation timeline**
with cinematic camera-authoring (our FlythroughRig is a walk, not an
authorable animation), **canvas links / interactive presentations**, and
4K video export. What we have that Mental Canvas does not: real site
truth — terrain, title boundary, cadastral import, grading, cut/fill,
subsurface strikes, sheets at true scale. The fusion target is exactly
that trade: **their freedom of space, our truth of ground.**

### The seam between the two halves (where the goal lives)

The two engines today meet only through the fixed-plane stack: sketch ink
on canvas planes, conversion (Tidy) on the horizontal planes. The
"Mental Canvas into Trace" experience closes three seams:

1. **Calibrated ink on any plane.** Trace's ambient precision (rulers,
   stabilizer, straighten, live dims) must work on a hinged/tilted canvas
   in perspective view, not only on ground-plane PLAN/AXO. Drawing on a
   vertical canvas in SEC/3D should carry lengths, angles and snap — the
   plane's own stationing ruler exists; the assist layer (§5 Phase 1)
   must ride it.
2. **One ink, two worlds.** A stroke drawn on any canvas can promote to
   site geometry that reconciles with the boundary — StrokeTransferLayer
   already projects between planes; the Tidy Z-routing (2026-09-04)
   elevates converted geometry. The remaining seam: draw a wall on a
   vertical canvas in elevation view → it converts to the massing plane
   with its drawn height, snap-stamped against the boundary.
3. **The walk is the pitch.** Mental Canvas sells the camera flight;
   Trace sells the issued sheet. Our flythrough + present lens + PDF at
   computed true scale already cover both — the polish is continuity of
   the loop (sketch → convert → walk → issue) with zero mode friction.

## 3. Feature gap matrix

Status legend: ✅ shipped · 🟡 partial · ❌ absent. "Ours better" marks where
the 3D-native model beats Trace's underlay-only 3D.

### 3.1 Drawing model

| Trace feature | Ours | Status / notes |
|---|---|---|
| 10-pen set (marker/technical/graphite/watercolor…) | Nib system (nib telemetry: pressure/tilt/azimuth stamped per point, materials + dash signatures, brush-width per stroke) | 🟡 — engine is deeper (per-point telemetry), but fewer *felt* pen personalities; a curated nib set is polish, not plumbing |
| Pressure/tilt response | Same (telemetry → width/bleed) | ✅ |
| Smooth curves (stabilizer) | None — raw freehand + Trace & Bake background vectorize | ❌ — the single most-felt drawing gap; a per-nib stabilizer is table stakes |
| Hold-to-straighten | Snap vertices (stitch engine) snap to geometry, not to straightness | ❌ — cheap, high-leverage, pure "assist" DNA |
| Live line length while drawing | LiveNibReadout (E/N/Z/STA/grade) | ✅ ours richer (grade/bearing/chainage) |
| Super Ruler / Triangle / Protractor | None (straightedge assist only via stitch snap) | ❌ — see §5 Phase 1 |
| 1/2/3-point perspective grids | Elevation/photo-trace with calibrated camera frames (boundary-snapped) | 🟡 — different problem shape; ours is survey-anchored, Trace's is synthetic grid |
| Scale grid underlay | Adaptive grid on ground plane | ✅ |
| ScalePen (zoom-true lineweights) | Committed stroke width resolves through brush/material/template chain | 🟡 — px-based, not scale-true at print; ties into §5 Phase 3 sheet scale truth |
| Palette maker / discipline palettes | Material palette (APWA colours) | 🟡 |
| Gesture grammar (2-finger undo, 3-finger sheet move, 4-finger chrome hide) | Pen-down quiet state (chrome recede), keyboard-first | 🟡 — touch parity matters for the field/tablet persona |

### 3.2 Layers = trace sheets

| Trace feature | Ours | Status / notes |
|---|---|---|
| Bounded translucent sheets | Sketch canvases (Spatial Sketching) as drawable planes + fixed plane stack (SRV/GRD/PLT/MAS) | 🟡 — ours is Z-organized (better for landscape), Trace's is opacity-organized (better for iterating alternatives) |
| Paper opacity / drawing opacity / blend modes | None (planes are opaque-order layers) | ❌ — the missing "peel the trace" feel; see §5 Phase 2 |
| Image/PDF underlays | Pinned site photos (frozen calibrated camera frames), Vicmap cadastral import | 🟡 ours survey-honest; Trace generic |
| Duplicate/reorder/clear sheets | History scrub (undo snapshots) + branch canvas | 🟡 — different verb set |
| Raster resolution tied to creation zoom | Board-% vector ink (resolution-independent) | ✅ **ours better** — Trace's #1 complaint (pixelation, export quality) structurally cannot happen |

### 3.3 Measurement & precision

| Trace feature | Ours | Status / notes |
|---|---|---|
| Sketch dimensions (precision/size/colour) | DimensionLayer (boundary-edge dims, bearings, TPZ rings) | ✅ ours survey-anchored |
| Smart Fill live area/perimeter | LiveMaterialCalculations (area/volume/cost per feature), cut/fill volumes | ✅ **ours better** (volumes, cost, labour) |
| Set Scale (known-distance calibration) | Not needed — the site frame is born scaled (Vicmap/title geometry, `scaleM`) | ✅ **ours better** — ambient scale by construction |
| AI Scale (read printed scale) | N/A (no unscaled imports today) | — |
| Export to Scale | SheetComposer → PDF issue: per-viewport true computed scale (1:N from live frustum) or explicit NOT TO SCALE stamp (2026-09-04 fix) | ✅ as of today |

### 3.4 CAD-ish (TracePro lineage)

| Trace feature | Ours | Status / notes |
|---|---|---|
| Smart Fill/Hatch (flood regions) | Hatch strokes (decorative, excluded from conversion); material fills on features | 🟡 — no flood-fill of closed regions |
| Hatch libraries (incl. landscape set) | APWA material palette | 🟡 |
| Stencils (people/trees/furniture, 1:1) | Catalog placements (trees, pavers…) with mature-size truth + planting spacing guides | ✅ **ours better** — real botanical data vs decorative symbols |
| Custom stencils | Catalog admin | 🟡 |
| Magic Lasso selection/edit | Marquee select + shift-multi + selection isolation (Phase H) + boolean ops; bulk-edit deferred | 🟡 |
| 100-page PDF redline sets | PDF import is not a studio surface | ❌ (deliberate: our documents are generated, not marked up — revisit if CA workflows land) |
| Scaled DXF export | Domain `LandscapeFeature` vector model is the export substrate; no DXF writer | ❌ — high-value interoperability item |

### 3.5 Presentation / collaboration

| Trace feature | Ours | Status / notes |
|---|---|---|
| Fly-between saved views | Viewpoint filmstrip (capture + walk playback head) + present lens | ✅ |
| Time-lapse sketch recording | History scrub is internal-only; no export | ❌ — cheap delight, real client value |
| SharePlay live charette | Share portal (issued sheets) — asynchronous only | ❌ live co-drawing (big lift; SharePlay-equivalent is WebRTC multiplayer) |
| Editable project file sharing | Persisted project + share tokens | 🟡 |
| Punch-list redlining | Conflict/strike cards on subsurface clashes | 🟡 different domain (design conflicts vs CA) |

### 3.6 3D / AR — the goal surface

| Trace feature | Ours | Status / notes |
|---|---|---|
| Sketch over imported 3D models (USDZ/OBJ underlay) | Not supported (our 3D is authored, not imported) | ❌ — import-as-underlay complements authored terrain |
| Solar/shadow studies | Suncast overlay + seasonal foliage dynamics (LA Seasonal Dynamics) | ✅ |
| LiDAR RoomPlan scan-to-sketch | Mobile capture app (field persona) — no scan-to-model | 🟡/❌ |
| AR SketchWalk (extrude lines, walk the plan) | Mobile AR bridge is in the architecture doc; 3D view + pedestrian camera already let you "walk" the design on screen | 🟡 — pedestrian camera ✅, on-site AR pending |
| AR Perspective Finder | Photo-trace elevation (pinned calibrated frames + boundary snap) | 🟡 ours survey-anchored |
| Maps to scale | Vicmap WFS cadastral + easements | ✅ **ours better** (cadastral truth, not raster satellite) |
| — (Trace has none) | Terrain heightmap + elevation sampler, cut/fill analysis with per-cell excavation report, depth-plane stack (SRV −0.02 / GRD 0 / PLT +1.5 / MAS +4.0), Tidy Z-plane routing with live preview (2026-09-04), extrusion pads, subsurface utility strikes | ✅ **ours alone** — this IS the 3D version; Trace cannot follow here without a rewrite |

## 4. UX pattern gaps (not features — feel)

1. **Stabilized drawing.** Trace's smooth-curve slider is the difference
   between "my hand" and "my hand on a drafting table". We have none. A
   per-nib stabilizer (one-finger lazy-nezumi style) is the highest
   felt-quality-per-line-of-code item in this document.
2. **Ambient straightness.** Hold-to-straighten + angle-snap assist. Our
   stitch engine snaps to *geometry*; nothing snaps to *straight*.
3. **Peel-the-trace iteration.** Paper opacity + blend + duplicate-sheet is
   how Trace users iterate alternatives ("peel back to the option two
   sheets down"). Our answer should NOT be raster sheet simulation — it is
   per-plane/per-canvas ink opacity + a duplicate-plane verb on the depth
   stack, vector-native.
4. **Trust the drawing, not the label.** Trace's calibration ethos maps to
   our honesty laws (computed PDF scale, honest failure, boundary
   reconciliation). Where Trace says "all tools are now calibrated", we say
   "the title boundary is the single source of truth" — keep extending that
   ambient truth (e.g. the 2026-09-04 true-scale viewport labels).
5. **Gesture parity.** Pen-down chrome quiet exists; touch gestures
   (2-finger undo, hold-to-erase) don't. Field persona is stylus+tablet —
   this is a real gap, not a nicety.

## 5. Roadmap — "3D in addition to 2D"

Each phase is independently shippable and ordered by felt value per risk.

### Phase 1 — 2D fluency parity (the Trace feel, no new geometry)
- Per-nib **stroke stabilizer** (smooth-curve slider with live test pad in
  the nib flyout).
- **Hold-to-straighten** + 15°/30°/45°/90° angle-snap assist on the live
  stroke (assist, never constrain: release keeps the freehand).
- **Straightedge rail tool** (draw-along-edge with live length readout via
  the existing LiveNibReadout channel).
- Live **line-length + angle** in the nib readout while a stroke is active
  (STA channel already exists).
- Gate: e2e stroke test + collision spec stay green; no new chrome tokens
  without tokens.css registration.

### Phase 2 — The trace-stack, vector-native (iteration feel)
- **Per-plane / per-canvas ink opacity** slider (drawing-opacity semantics;
  paper stays opaque per the LA opaque-chrome amendment).
- **Duplicate plane** verb (PLT-alt, MAS-alt…) — alternatives as sibling
  planes, share the filmstrip for A/B views; history scrub remains the
  undo truth.
- **Flood-fill hatch** into closed ink regions (target tolerance slider),
  reusing the hatch-stroke contract (decorative, conversion-excluded).
- Gate: plane opacity must not leak into PDF viewport captures as fog —
  capture honors the operator's current view honestly.

### Phase 3 — Scale-true drawing (ScalePen ethos)
- **Scale-true stroke widths**: resolve committed stroke px against the
  live camera scale band so ink reads correct at 1:100/1:200 print zoom
  (extends the 2026-09-04 true-scale capture work).
- Straight-line **dimension assist**: stroke near-horizontal/vertical →
  dim string snaps to axis.
- **DXF export** of `DesignCanvas.features` (walls/paths/beds as
  LineString/Polygon) — the interoperability wedge into CAD firms; schema
  already vector-clean.

### Phase 4 — Close the seams: Mental Canvas INTO Trace (the goal)
The engine halves both exist (spatial canvases §2b; classification
§3.1/§3.4). This phase is fusion, not greenfield — the freehand stroke
drawn anywhere in 3D space becomes calibrated site geometry, and the walk
sells it:
- **Assist on any plane**: the Phase-1 stabilizer/straighten/ruler work on
  hinged and vertical canvases in SEC/3D, reading the plane's stationing
  (lengths and dims on a tilted plane state the plane's true
  measurements, not screen-space ones).
- **Elevation-drawn → massing-landed**: a wall drawn on a vertical canvas
  converts to the massing plane with its DRAWN height (StrokeTransferLayer
  carries the geometry; Tidy Z-routing carries the plane) — the facade→plan
  reconciliation the AGENTS.md boundary rule already anticipates.
- **Per-kind elevation presets in the Tidy HUD** + multi-select bulk plane
  assignment (marquee + plane toggle).
- **Wall height from stroke gesture** (drag-up-on-commit = height, the
  extrude gesture generalized from pads to wall features).
- **Model import as underlay** (USDZ/OBJ + glTF): static mesh dropped at a
  boundary-snapped position, drawn over in any camera preset — Trace
  parity for existing-house massing, then surpassed because our ink
  converts to features that reconcile with the boundary.
- **The walk is the pitch**: pedestrian walk-through from filmstrip
  viewpoints, then cinematic flythrough authoring (Mental Canvas's
  animation strength) and canvas-links-style guided presentation in the
  present lens.
- **AR bridge** per the architecture doc (mobile): SketchWalk parity —
  walk the issued design on the real site.

### Phase 5 — Delight & collaboration (post-parity)
- **Time-lapse export** of a history-scrub session (history data already
  snapshots every commit).
- Live co-drawing (multiplayer CRDT canvas) — only after the field persona
  stabilizes; SharePlay's own beta limits show the risk.

## 6. Adopt / adapt / reject

**Adopt (Trace pattern, as-is):** stabilizer slider + test pad;
hold-to-straighten; angle-snap assist; live length display; flood-fill
hatch; time-lapse; fly-between-views (have); 1:1 stencils (have, better).

**Adapt (Trace pattern, re-grounded in our laws):** trace-sheet stack →
Z-plane stack + per-plane ink opacity + duplicate-plane (never raster
sheets, never paper translucency — opaque-chrome amendment); Set Scale →
born-scaled site frame (nothing to calibrate; extend honesty labels
instead); model underlay → boundary-snapped import with reconciliation
stamping (locational-indicative when un-snapped).

**Reject (with reasons):** raster layer engine (resolution-by-zoom is
Trace's most-cited defect; our board-% vector ink is structurally immune);
PDF-set redlining as a studio surface (our documents are generated with
provenance, not marked up — revisit only if CA workflows become a stage);
synthetic perspective grids (we have survey-anchored calibrated frames);
chatty AI chatbot patterns (AI stays a spatial collaborator per the supreme
brief).

## 7. Known Trace weaknesses to never inherit

Raster export quality complaints; subscription-gated precision tools;
SharePlay-collaboration beta limits; shallow landscape libraries; 3D as
view-only underlay. Each is a structural consequence of Trace's engine
choices, not polish debt — our vector ink, born-scaled frame, and authored
3D site model are the moat.

## 8. Sources

Mental Canvas (the immersive-3D reference): [mentalcanvas.com](https://mentalcanvas.com/),
learn.mentalcanvas.com — [canvases](https://learn.mentalcanvas.com/canvases)
(infinite transparent 2D canvases positioned in space),
[projection](https://learn.mentalcanvas.com/projection) (2D drawings into
dynamic 3D scenes), [FAQ](https://mentalcanvas.com/faq) (2025 subscription
transition, 4K export, interactive canvas links); App Store listing
(id1462179740). Internal counterparts:
`docs/MENTAL-CANVAS-ROADMAP.md`, `docs/MENTAL-CANVAS-GAP-ANALYSIS.md`.

Morpholio Trace: official: morpholioapps.com/trace + the Trace user guide (v6.5–6.9) pages
— pens, Apple Pencil, smooth curves, ruler/triangle/protractor,
perspective, layers + layer actions, image actions, set scale, AI scale,
ScalePen, stencils, hatches, smart fill, area, dimensions, selection, PDF
tools, DXF export, Vectorworks cloud, 3D models, shadow maker, RoomPlan,
AR SketchWalk, AR perspective finder, maps-to-scale, SharePlay charette,
time-lapse; App Store listing (tiers/pricing/ratings). Third-party:
ArchDaily (2012 guide; Trace 2.0), Designboom (Trace 2.0), BIM Tools Hub
(pricing), Reddit r/LandscapeArchitecture + r/Architects (field
complaints), Create Visual (garden-design guide), Nomic glossary.
"Connect the Dots" — cited in some third-party roundups as a TracePro
feature — could not be verified in any official source; treated as
folklore, not a requirement.
