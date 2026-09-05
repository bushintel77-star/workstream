# The Sketch System, for Designers — features, and the backend logic behind them

**Audience:** UI/UX designers working on the Landscape Canvas studio.
**Purpose:** describe every freehand-sketch feature, what the operator sees,
and the actual backend function behind it — so a designer can reason about
what is real wiring, what is honest feedback, and what is still missing,
without reading code.

**The product sentence:** *a trace pad floating in 3D space.* You draw
freehand with expressive nibs on sheets (planes) you place anywhere — like
Mental Canvas — and every stroke stays ambiently precise: scaled, reconciled
to the site's real title boundary, and convertible into true site geometry
(Trace's promise), without ever leaving the drawing.

Companion docs: `MORPHOLIO-TRACE-3D-GAP-ANALYSIS-2026.md` (feature parity),
`MENTAL-CANVAS-ROADMAP.md` (what's next), `PHASE4-SEAM-DECISION-2026.md`
(the wall seam). This doc describes what IS built.

---

## 1. The life of a stroke — the spine every feature hangs on

A stroke travels through seven stages. Every feature in this doc is a
modification of one of these stages.

| Stage | What happens | The function behind it |
|---|---|---|
| 1. Capture | Pen/mouse samples arrive at display rate; stylus pressure, tilt and azimuth are read (mouse synthesizes a neutral 0.5 pressure) | `telemetryFromPointer` |
| 2. Stabilize | A "pull chain" damps hand wobble — the ink follows the hand with a slight lag (the SM dial sets how much). Holding still ≥0.4 s on a straightish run straightens it to the nearest 15° (±5° tolerance) — assist, never constraint: release keeps your freehand | `stabilizePoint`, `shouldStraighten`, `straightenStroke` (strokeAssist.ts) |
| 3. Snap | The stroke's endpoints quietly find nearby geometry: existing stroke ends, the title boundary, the site grid — shown as a snap glyph so the precision is visible, never silent | `snapWorld.ts` (snap kinds: close / vertex / boundary / grid / angle) |
| 4. Ink identity | The stroke draws with the armed "spec": the nib's personality (width, grain, edge softness, bleed, base opacity), optionally re-coloured and re-weighted by a material | `armedNibSpec` (nibs.ts) — the single resolution path, so what you draw with is what lands |
| 5. Live ink | The line renders under your hand on the active surface; the live readout shows real chainage/bearing while drawing; in 3D, ink fades with the camera angle so the drawing reads | `LiveNibReadout`, `AngleOpacityShader` (falloff) |
| 6. Commit | Pen lift persists the stroke: points in board-% + per-point telemetry + nib + material + width + opacity + which plane it was drawn on. Ink is KEPT even after conversion — it is the provenance of everything built from it | `addSketchStroke` (studioStore) |
| 7. Understand | The classifier recognises what you drew (bed / wall / ditch / path) with a confidence score; the Tidy HUD offers the conversion at the pen lift; accepting lands real site geometry. The drawing stays; the geometry is added | `recognizeStroke`, `convertStrokesToFeatures` (sketchCad.ts) |

---

## 2. Feature catalog — what the designer sees ↔ what the backend does

### 2.1 The Brush widget (draw-tools flyout)

| You see | Backend logic | Function |
|---|---|---|
| 4 nib keys with drawn texture previews (6B graphite, Ink, Chisel, Stipple) — each with a purpose tooltip | A nib is a parameter set: base width, grain density, edge softness, wet-ink bleed, base opacity, and WHICH stylus channels it listens to (pressure→width for graphite, tilt→width for chisel, pressure→dot density for stipple, nothing for technical ink) | `NIBS` table, `widthScaleForPoint`, `bleedScaleForSegment` |
| **W** width slider (0.5–20 px, tap-to-type, arrows step, Shift ×10) | An explicit width override stamped onto every new stroke — it outranks material and template weights, because a deliberate choice must survive standard changes | `setBrushWidthOverride`, `committedStrokeWidthPx` |
| **OP** opacity slider | Per-brush ink density, stamped onto new strokes so it survives reload; shown on the live line too | `setBrushOpacity`, stamped as `CanvasStroke.opacity` |
| **SM** smoothing slider | The stabilizer strength (0 % = raw hand). Each nib carries its own default (technical pen 5 %, chisel 25 %); the dial follows the nib until you touch it — then your choice sticks | `stabilizePoint`, per-nib `defaultSmoothing`, `smoothingTouched` |
| **ERASE** key (click toggles, hold ~0.45 s latches) | Stroke-matching erasure: the eraser targets the stroke under the cursor measured by ITS OWN width, not a fixed circle | `eraseStrokeAt` |
| Falloff disclosure (collapsed) | 3 presets for how ink fades with camera angle in 3D (NARROW working / BALANCED / WIDE fly-through) | `AngleOpacityShader` |

### 2.2 The Palette widget (colour-well tile)

| You see | Backend logic | Function |
|---|---|---|
| Colour-well tile on the rail showing the armed ink | The rail previews state so the panel stays closed: material colour if armed, else the nib's own | `ColourWellTile` → `materialById` / `NIBS` |
| 21 named swatches in 4 groups | The single source of truth for stroke materials; markup materials carry mandatory dash signatures so they survive greyscale and colour-blind review | `MATERIALS`, `materialsByGroup` |
| RECENT row (last 6, this session) | Session memory of what you used — the outgoing material becomes "previous" | `recentMaterialIds`, maintained by `setActiveMaterialId` |
| Active well + "X swaps" | Clicking the well (or X) exchanges current ↔ previous material — the two-pencil workflow | `swapActiveMaterial` |
| Contrast readout ("3:1") | The WCAG contrast ratio of the armed material against the live canvas ground — the ink-legibility law surfaced as a number, computed from OKLCH | `contrastReadout`, `relativeLuminance` (materialContrast.ts) |
| Build-up ramp | The five alpha layers the multiply-style nib stacks | `BUILD_UP_RAMP` |

### 2.3 Planes — the Mental Canvas half

| You see | Backend logic | Function |
|---|---|---|
| Depth rail: GRD / PLT / MAS fixed planes (+ SRV survey line below grade) | Ink can be drawn onto named heights; the rail is the plane selector, and a 150 ms white LED flash confirms where a commit landed | `FIXED_PLANES`, `planeZ`, `kindPlane` (planeStack.ts) |
| "＋" on the rail → placement flyout | Create a named sketch canvas: 5 pose presets, flat or standing orientation, height/bearing tap-to-type | `CanvasPlacementFlyout`, `poseForPreset` (canvasPlacement.ts) |
| Cards rail (canvas list with eye/rename/delete) | Each canvas is a real spatial node — position + rotation — carrying its own strokes in its own board-% space | `SketchCanvasGroup`, `canvasPose.ts` |
| Draw on any canvas in any camera | Pointer ray-casts onto the active plane; strokes live in that plane's local space and stay glued to it through orbits | `canvasPctToWorld`, `worldToCanvasPct` |
| Transfer (pick a stroke, pick a plane) | Forward perspective projection through the camera onto the target plane | `StrokeTransferLayer` |
| Hinge/fold gizmo on a fresh plane | Drag the projection handle to fold the plane in 3D before drawing | `ParallelProjectionHandle`, `HingeProjectionGizmo` |
| Tidy plane flash + Z-routing | A classified stroke lands on its kind's default plane (wall→MAS, bed→PLT, ditch/path→GRD); the HUD cycle overrides per stroke | `KIND_TO_PLANE`, `planeOverrides` |

### 2.4 Assist, Tidy & the conversion to site truth

| You see | Backend logic | Function |
|---|---|---|
| Tidy HUD at the pen lift (kind label + plane chip + ✓/ESC) | Only ink that would genuinely convert spawns it (same confidence bar as the commit) — annotation ink is never interrupted | `isConvertibleStroke`, `isWallCandidateStroke` |
| Plane cycle chip | Pre-selects the classifier's default plane; the ghost in the scene lifts live so you see exactly what you'll get | `tidyPreviewZ`, `TidyPreviewLayer` |
| **WALL preset** (walls on standing planes) | Plane locked to massing; the drawn vertical extent becomes the wall's height (labelled `drawn_height_m`, provenance "operator"); a chip shows the title-boundary verdict: ✓ in title / ⚠ crosses (crimson) / indicative | `wallFromStandingStroke`, `reconcileWallFootprint` (wallSeam.ts) — D1/D2 of PHASE4-SEAM-DECISION-2026.md |
| One-click "Convert strokes to CAD features" (palette) | Converts every convertible stroke in one pass; ink stays as reference | `convertStrokesToFeatures` |
| Bulk re-plane ("Move N selected" in Layers) | Moves N committed features to another plane in ONE undo step | `assignFeaturesToPlane` |
| Sun-hatch fill | Hatch lines snap to the site's inverse sun angle (or 45° off); hatches are decorative and excluded from conversion — stated, never silent | `hatchFillStroke` |
| Extrude (drag up on a closed loop) | A closed footprint + drag = a cut/fill pad with real volume; volumes feed the earthworks readout | `extrude_height_m`, `padCutFill` |

### 2.5 Views & presentation

| You see | Backend logic | Function |
|---|---|---|
| Camera dock PLAN / AXO / SEC / 3D | One orbit rig (azimuth + tilt); nothing in the chrome ever moves between presets — position-invariance is a gated contract | `cameraRig.ts`, chrome-contract spec |
| Split view (palette: "Split plan \| 3D") | Two linked canvases: locked plan left, live 3D right | `SplitViewLens` |
| Bird's-eye HUD while placing planes | An outside view showing the camera frustum and the plane you are placing — so you can judge placement from outside the viewport you're inside | `BirdsEyeHud` |
| Viewpoint filmstrip + walk | Capture viewpoints, play them as a walk; pedestrian camera on the ground | `ViewpointFilmstrip`, `walkMode` |
| Hold-H chrome peek | All chrome fades to a token value so the drawing reads; release restores | `gs-chrome-receding`, `ChromeRecedeWatcher` |

### 2.6 Where the drawing goes

| You see | Backend logic | Function |
|---|---|---|
| Autosave + reload unchanged | The whole canvas (strokes, planes, features) persists and re-hydrates; sheets and viewpoint bindings are session-scoped today (roadmap Phase 4b) | design-canvas autosave |
| History scrub | Undo snapshots — every commit is one step; the scrub is the time machine | `historyPast` / `docSnapshot` |
| PDF / DXF / glTF exports | Issued sheets carry a computed true scale (1:N) or an honest NOT-TO-SCALE stamp; CAD documents export as DXF and glTF | `SheetComposer`, `cadDocumentToDxf`, `exportCadGltf` |
| Records surfaces (Outputs / Audit / Carbon / Measurements / Recordings) | Reached ONLY through the command palette (Ctrl+K) — the palette is the single door, which is why an e2e spec walks it | `StudioCommandPalette`, `ProjectUtilitySurface` |

---

## 3. Rules the system obeys (why the UI can be trusted)

1. **The drawing is the product.** Ink is never moved, deleted or "corrected"
   by the system. Assist bends toward your intent (straighten, snap, plane
   routing) but a crossing wall lands where you drew it, flagged —
   `reconcileWallFootprint` never relocates.
2. **Assist, never constrain.** Straighten requires a deliberate hold AND a
   mostly-straight stroke; curves that pause stay curves.
3. **What you draw with is what lands.** One resolution path
   (`armedNibSpec`) feeds the live line AND the commit; there is no second
   code path that could silently change the ink.
4. **An assumption is never presented as a measurement.** Every height and
   position stamp carries provenance (`height_source: operator/assumed/
   measured`; boundary contained/crosses/indicative). The UI shows the
   stamp, not a confident lie.
5. **Dead controls are a defect.** Every control listed here is wired to the
   function named next to it; gates (collision, contrast-AA, reachability,
   wall-seam e2e) keep that true. If a control stops being wired, that is a
   bug to file, not a convention.

---

## 4. What is NOT built (so nobody designs against a ghost)

Itemized with status in the session handover (`HANDOVER-2026-09-05-E2E-SIGNAL.md`
§5). Headlines: straightedge ruler tool, hold-to-extend, per-plane ink
opacity (the shipped OP dial is per-brush), duplicate-plane verb, flood-fill
hatch, scale-true print lineweights, 3D model import as underlay, flythrough
authoring, live co-drawing, AR bridge, and touch-gesture parity.

---

## 5. Function index (quick lookup)

| Function | Module | In one line |
|---|---|---|
| `telemetryFromPointer` | nibs.ts | Pointer event → normalized pressure/tilt/azimuth |
| `stabilizePoint` | strokeAssist.ts | Pull-chain wobble damping (the SM dial) |
| `shouldStraighten` / `straightenStroke` | strokeAssist.ts | Hold-to-straighten gate + 15° snap |
| `armedNibSpec` | nibs.ts | Resolve nib + material + width + opacity into one ink spec |
| `widthScaleForPoint` / `bleedScaleForSegment` | nibs.ts | Per-sample width modulation and speed bleed |
| `pctToWorld` / `worldToPct` | coordTransform.ts | Board-% ⇄ metres on the shared horizontal grid |
| `canvasPctToWorld` / `worldToCanvasPct` | canvasPose.ts | The same, through a placed plane's position + rotation |
| `isStandingCanvas` | wallSeam.ts | Live quaternion test: is this plane vertical right now |
| `wallFromStandingStroke` | wallSeam.ts | Closed outline on a standing plane → plan footprint + drawn height |
| `reconcileWallFootprint` | wallSeam.ts | Title-boundary containment verdict (contained / crosses / indicative) |
| `recognizeStroke` | stroke-recognize.ts | Geometry → bed / wall / ditch / path with confidence |
| `convertStrokesToFeatures` | sketchCad.ts | Strokes → `LandscapeFeature`s with plane routing + wall seam |
| `buildLandscapeFeatureFromStroke` | structured-tools.ts | Feature construction: layer, material, labour, closed rings |
| `convertStrokesToCadFeaturesWithPlanes` | studioStore.ts | The Tidy commit: one stroke, one plane override |
| `assignFeaturesToPlane` | studioStore.ts | Bulk re-plane, one undo step |
| `eraseStrokeAt` | studioStore.ts | Stroke-matching erasure at the cursor |
| `hatchFillStroke` | studioStore.ts | Sun-aware hatch fill of a closed stroke |
| `snapWorld` kinds | snapWorld.ts | Close / vertex / boundary / grid / angle snap hints |
| `contrastReadout` | materialContrast.ts | Material vs canvas WCAG ratio (the palette readout) |
| `planeZ` / `kindPlane` | planeStack.ts | Fixed-plane heights and kind→plane defaults |
| `padCutFill` | cutFill.ts | Pad cut/fill volumes from the terrain sampler |
