# Mental Canvas-style sketching — status + roadmap

Written 2026-09-03 after a live code audit (not from memory) so a fresh CLI
session can pick this up without re-deriving it. Cross-references
`ArchitecturalLandscapeUI/design_handoff_landscape_canvas/README.md` — the
project's actual design spec for the sketch canvas, sections **§7a, §11c
(turns 14a/14b/14c), §11d (turn 15)**. That README is authoritative; this
file is a status snapshot + task list against it, not a replacement.

## Headline finding

**The core "Mental Canvas" engine already exists and is real, not a stub.**
Three dedicated, spec-aware modules under
`apps/web/src/components/canvas/webgl/`:

- **`SketchCanvasGroup.tsx`** — each `SketchCanvas` (contracts type) is a real
  spatial node: position + rotation quaternion, a raycast mesh for drawing,
  strokes stored in the plane's local board-% space. Comment cites
  `docs/GOLD-STANDARD-2026-ARCHITECTURE.md §5` (SpatialObject as universal
  node).
- **`StrokeTransferLayer.tsx`** ("Spatial Sketching — Phase 2", its own
  header) — projects a stroke from one canvas plane onto another via forward
  perspective projection from the camera (`THREE.Raycaster.setFromCamera` +
  `THREE.Plane.setFromNormalAndCoplanarPoint`). Its own comment: *"exactly
  what Mental Canvas does when you transfer a sketch from one layer to
  another."* This is turn **14a**.
- **`AngleOpacityShader.ts`** ("Phase 3" + "Phase 4 seasonal crossfade") —
  strokes fade to 0% opacity as camera angle goes oblique to their canvas
  plane (`smoothstep` on the view/normal dot product), *plus* a seasonal
  crossfade beyond spec (`uSeasonOpacity`, driven by `studioStore`'s
  `winterFactor` — "living pop-up book"). This is turn **14c**, extended.

Store-side (`studioStore.ts`): full CRUD for canvas planes —
`addSketchCanvas` / `updateSketchCanvas` / `removeSketchCanvas` /
`setActiveCanvasId`, all wired into the undo/redo history stack
(`docSnapshot`). Deleting a plane reassigns its strokes to the ground plane
rather than deleting them.

**What's real but shallow is the interaction layer around that engine** —
this is the actual gap, not the 3D math.

## Mental Canvas UX reference (added 2026-09-03)

The user provided a full UX teardown of the real Mental Canvas app
mid-session. Condensed here for later phases — the full research is
archived in this session's transcript, not re-pasted in full to keep this
doc scannable. Key structural facts, by relevance to the phases below:

- **Draw Mode vs View Mode** — a global toggle. In Draw Mode the camera
  locks parallel to the active canvas (prevents parallax distortion while
  sketching); selecting a different canvas re-aligns the camera to it. In
  View Mode the camera decouples and free-orbits; tapping a canvas shows
  its bounding frame instead of re-aligning. **Relevant to a future
  phase, not scoped yet** — this app's Sketch/CAD/Elevation/Garden modes
  already partition "draw" vs "look around" differently; whether to add a
  camera-lock-to-active-plane behavior specifically while drawing is an
  open question, not decided.
- **Parallel Projection / Hinge Projection** — the two placement
  mechanics. See Phase A below; this is what Phase A now builds.
- **Bird's-Eye HUD** — a secondary mini-viewport (own camera + frustum
  wireframe + canonical view snap buttons) shown during a Hinge/Parallel
  drag. Phase A3 — shipped.
- **Three-state canvas panel** (Collapsed / Default / Expanded, dragged
  open) with thumbnail previews, a Transparency Toggle (fades all
  inactive canvases to reduce visual clutter — this is a strong,
  cheap-to-borrow idea), drag-to-pick-canvas-in-viewport, per-canvas Eye
  icons, Hide All / Show All, "Rehome" (fit active canvas to viewport),
  and a long-press context menu (Reorder / Delete / Rename / Add Link).
  **Directly informs Phase B** (canvas rail as real cards) below — Phase
  B's card rail should fold in naming display + an eye/visibility toggle
  + the transparency-toggle idea at minimum; the full three-state
  collapse mechanic is a bigger lift than Phase B currently scopes and
  should be revisited when Phase B is actually planned.
- **Bookmarks + Timeline** (camera view snapshots, linger/transition/
  sequence-time sliders, loop toggle) and the **Visibility Panel**
  (per-bookmark canvas visibility keyframing) — this is the real shape of
  **Phase C** (viewpoint filmstrip + walk/record) below; Phase C's
  current scope ("thumbs + active border + walk/record controls") is a
  minimal version of this. Worth re-reading the full research before
  Phase C is actually planned.
- **Selection Mode** (red-mask isolation, whole-stroke/lasso select,
  boolean add/subtract/invert, Replace Image with "all occurrences") —
  not mapped to any current phase; flagging as a possible future phase if
  stroke-level multi-select/replace becomes a real ask.
- **Brushes Panel** (visual texture grid + one width slider, no named
  brush catalog) and **stroke-matching eraser** (scales to the stroke it's
  erasing, not a fixed radius) — worth checking against this app's
  existing nib system (`nibs.ts`, `ToolFlyout.tsx`'s `NibPicker`) for
  parity; not scoped as a phase, just a comparison point.
- **Apple Pencil hardware mappings** (double-tap → eraser toggle, hover →
  pre-stroke preview, squeeze → context menu, barrel roll → texture
  rotation), **Options Menu/export pipeline**, **Web Player/VR** — real
  parts of Mental Canvas, explicitly out of scope for this app's roadmap
  (touch/pencil-specific iPad OS integration and a hosted web-player
  product are different surfaces than this desktop-first WebGL studio).

## Gaps against the spec (turn 14b, 15a/15c, 16b)

Confirmed by reading the only call site
(`FloatingChrome.tsx`, `addSketchCanvas(createCanvas(nextZ))`):

1. **✅ FIXED (Phase A1/A2, 2026-09-03).** Placement gizmo + naming — was
   a single "+" button stacking an unnamed flat plane at the next preset
   Z height. Now: `CanvasPlacementFlyout.tsx` (required name field, the
   five presets, numeric height/bearing entry) +
   `ParallelProjectionHandle.tsx` (flat-plane height drag) +
   `HingeProjectionGizmo.tsx` (fold-angle drag with angle-snap glyph
   morphing for standing planes). Double-tap-to-fit and the `⌥`/`⇧`
   modifier-key gestures from the spec's exact wording were deliberately
   not built — the numeric flyout + drag gizmos cover the same outcome.
2. **✅ FIXED (Phase A1).** Naming on create — the flyout's Place button
   is disabled until a name is entered.
3. **No UNSCALED badge / calibrate-later (§15a/§15c).** Grepped the whole
   `webgl/` tree for "unscaled", "calibrate" — no matches. Sketching always
   assumes a scaled site; there's no unscaled-first-class state, no
   two-point retroactive calibration flow, and so no "trace an aerial /
   photo before you have a scale" path.
4. **No viewpoint filmstrip + walk/record (§7a / canonical screen 16b).**
   Garden mode has `PedestrianCamera.tsx` / `FlythroughRig.tsx` for
   eye-level 3D viewpoints, but that's a different, adjacent system — no
   "canvases-as-cards rail" + "viewpoint filmstrip + walk/record" exists
   for **sketch mode** specifically, as the canonical 16b screen specifies.
5. **Falloff presets (NARROW / BALANCED / WIDE, §14c) — not yet located.**
   The shader supports continuous angle-based falloff; whether a preset
   *picker* is exposed anywhere in chrome wasn't confirmed in this pass
   (broad grep for "narrow/balanced/wide" was too noisy to be useful — worth
   a targeted look at `FloatingChrome.tsx` and `ToolFlyout.tsx` before
   assuming it's missing).
6. **Sketch-first entry (§11d, turn 15) — not audited this pass.** "Open →
   drop an aerial or take a photo → draw", first-run empty state with three
   entries (Import a survey / Trace an address / Blank site) per turn 15
   item 15 in the README's workstream list. Needs its own check against
   `SiteSetupModal.tsx` and the confirm-pin flow before scoping.

## Suggested phases

Numbered independently of the README's own §12 workstream numbering (that
list is the *original* build order for the whole product; this is just the
remaining slice for sketch-mode's Mental Canvas feel).

### Phase A — Hinge/Parallel Projection canvas placement (turn 14b)

**Status: COMPLETE — A1, A2 and A3 all shipped 2026-09-03 (commits
`e2ef9f1`, `9be0d78`, plus A3).** See "Mental Canvas UX reference" below
for the source research. This phase replaces the single "+" button in
`FloatingChrome.tsx` with the *actual* Mental Canvas placement mechanic
rather than a generic drag-arrows gizmo, decided after the user reviewed
a full UX teardown of the real app mid-session.

All three checkpoints were verified live, not just unit-tested: A1 by
placing a standing preset and confirming its persisted rotation
quaternion via the API matched the unit tests exactly, and by
drag-adjusting a flat plane's height with the drag collapsing to a
single undo step; A2 by placing a standing plane at a non-zero bearing,
dragging its fold ring, and confirming via the autosave payload that the
plane folded back toward flat while the bearing stayed *exactly*
untouched — the trickiest part of the math (bearing preservation through
incremental local-axis rotation composition) holds under real drag
input, not just in the round-trip tests. A3 by placing a standing plane
at bearing 55°, watching the HUD draw it edge-on as a line (correct for
a 90° fold seen from overhead) against the lot silhouette, dragging the
fold ring and watching the outline open into a square in lockstep,
pressing the HUD's AXO button and confirming the *main* camera retilted
while the HUD's frustum wedge redrew for the new pose, and confirming on
Escape that the second WebGL context was released without the main
canvas losing its own (`isContextLost() === false`).

One deliberate scope cut from the original three-handle plan: A2 ships
only the fold-angle handle, not separate "two ground-anchor position
handles." Position and bearing are set numerically in the A1 flyout at
placement time (already spec-compliant — the spec itself flags numeric
entry as a required, not optional, input method) and aren't
independently re-draggable yet. Revisit if that turns out to matter in
practice.

The project's own flat/standing binary (§14b) maps onto one continuous
mechanic: **Hinge Projection** folds a plane from 0° (flat, lying on the
ground) to 90° (standing), with the fold handle's shape morphing at snap
angles (octagon 45° / hexagon 60° / pentagon 72° / square 90°) and a
**Bird's-Eye HUD** (secondary mini-viewport: camera-frustum wireframe,
the folding plane's frame, canonical view buttons) appearing during the
drag for spatial orientation. **Parallel Projection** (drag along one
axis, no rotation) covers the simpler "adjust an already-flat plane's
height" case.

Confirmed data-model readiness: `SketchCanvasSchema`
(`packages/contracts/src/schemas/catalog.ts:241`) already has an optional
`label` (naming — no contracts change needed) and a full `rotation`
quaternion, genuinely applied by `SketchCanvasGroup.tsx`'s `CanvasPlane`
(228-312) — a real fold-to-vertical quaternion works today.

Build order (three shippable checkpoints):
- **✅ A1 (shipped)** — naming + presets (ground/terrace/canopy/boundary-
  wall/hedge-line) + a Parallel Projection height-drag handle for flat
  planes. `canvasPlacement.ts` (presets, `foldQuaternion(angle,
  bearing)`, unit-tested at every angle/bearing combination),
  `CanvasPlacementFlyout.tsx` (new sibling to `ToolFlyout.tsx` — that
  component is hardcoded to the tool ribbon's DOM/handedness, not
  reusable as-is for the depth rail's `+` cell — anchor position is
  measured from the `+` cell's real rect, same technique as the
  ToolFlyout centering fix earlier this session),
  `ParallelProjectionHandle.tsx` (drei `TransformControls`,
  mode="translate", Y-axis only via `showX`/`showZ`, modeled directly on
  the existing `PlacementGizmo.tsx` — ended up simpler and more robust
  than the raw-raycast approach originally planned, since
  TransformControls already solves constrained-axis 3D dragging
  correctly), plus `studioStore.ts` additions
  (`beginSketchCanvasTransform` / `setSketchCanvasTransformTransient` /
  `endSketchCanvasTransform`, mirroring the placement trio at
  `studioStore.ts:1948-1985`) and an `adjustingCanvasId` transient
  field.
- **✅ A2 (shipped)** — `HingeProjectionGizmo.tsx`: a fold-angle handle
  (drei `TransformControls`, mode="rotate", space="local", only the
  local-X ring shown) dragging a standing plane between 0° and 90°, with
  angle-snap glyph morphing (a low-segment `circleGeometry` doubles as a
  regular polygon — octagon/hexagon/pentagon/square, no per-shape mesh)
  and a live angle/bearing readout. Two new `canvasPlacement.ts`
  functions make the drag possible: `decomposeFoldQuaternion` (recovers
  both angle and bearing from a quaternion with neither known upfront —
  used once at gizmo mount) and `angleFromQuaternionAtBearing` (the
  cheaper per-tick version once bearing is captured). Scope cut: ships
  only the fold handle, not separate ground-anchor position handles —
  see the note above.
- **✅ A3 (shipped)** — `BirdsEyeHud.tsx`: its own small, separate
  `@react-three/fiber` `<Canvas>` (**not** a scissored/`Hud`-primitive
  share of the main canvas — `SplitViewLens.tsx`'s own header comment
  explains why that conflicts with the EffectComposer post-FX stack; a
  second real canvas instead, same as split-view does), carrying the lot
  silhouette, the main camera's frustum wireframe and the plane being
  placed, over a fixed north-up overhead ortho camera. Geometry lives in
  `birdsEyeFrustum.ts` (unit-tested — nothing in `apps/web` mounts an R3F
  canvas in jsdom, so anything left inside the component would be
  untestable). The two canvases share no React state: the main camera's
  pose crosses via the transient `_liveCameraPosition` channel
  `FusedCamera` already writes each frame, read in the HUD's own
  `useFrame` through `getState()` and rewritten into pre-allocated
  buffers — no subscription, no React render per frame.

  Three decisions worth keeping: it mounts on `adjustingCanvasId` (so it
  covers A1's height drag as well as A2's fold, rather than a third copy
  of the `isFlat` predicate); the mini-viewport is deliberately **not**
  interactive, with its canonical view buttons re-aiming the MAIN camera
  through `setCameraPreset` (a second orbit surface would fight the drag
  already in progress); and it draws the plane clamped to the lot's long
  side rather than at `SketchCanvasGroup`'s real five-lot-width raycast
  mesh, which crossed the whole panel at every fold angle and buried the
  silhouette it exists to be read against (`hudPlaneExtentM`). The panel
  is inset past the tool ribbon at 128px, not hugged to the 22px edge —
  both side edges are spoken for at every handedness (ribbon one side,
  depth rail the other).

### Phase B — Canvas rail as real cards (turn 16b)
**Status: COMPLETE — shipped 2026-09-03.** The spec's 16a Drafting and 16b
Sketch are different screens with different chrome: 16a has the two-way depth
rail (cells 36×34), 16b has the canvases-as-cards rail (cards 74×46) and no
depth rail. The old single 52px hybrid rail that mixed user canvas chips with
fixed reference bands (MAS/PLT/SRV) and subsurface DBYD cells in every mode is
replaced by two mode-conditional rails:

- **`DepthRail.tsx`** — renders in all non-sketch modes (survey, CAD, elevation,
  garden, quote, present, share). Shows the fixed reference bands (MAS/PLT),
  GRD, and subsurface utility depths (SRV/SUB). User canvas chips are removed
  from this rail — they live in the cards rail now.
- **`CanvasCardsRail.tsx`** — renders only in Sketch mode. Cards 74×46, radius
  9, gap 7 (§4 Geometry). Each card shows: a live inline-SVG thumbnail
  (`canvasThumbnail.ts` — pure function, board-% strokes → SVG paths, no third
  WebGL context, unit-tested), the canvas name, an eye toggle (view-state
  visibility per §14c: "a faded canvas keeps a 1px edge and its list row —
  invisible is a view state, not a disappearance"), a delete button on hover
  (`removeSketchCanvas` — strokes fall back to ground), and a season tag cycle.
  Single click selects (`setActiveCanvasId`), double-click re-arms the
  placement gizmo (`setActiveCanvasId` + `setAdjustingCanvasId` together, so
  the gizmos' divergence guard sees both ids equal), double-click on the label
  triggers inline rename (`updateSketchCanvas`). A global transparency slider
  at the rail header drives `inactiveCanvasOpacity` (the Mental Canvas
  "Transparency Toggle" — fades all inactive canvases).

Store additions (`studioStore.ts`): `hiddenCanvasIds: string[]` +
`toggleCanvasVisibility(id)` and `inactiveCanvasOpacity: number` +
`setInactiveCanvasOpacity(v)` — both view-state only (never enter `docSnapshot`,
no autosave churn), mirroring the existing `hiddenOverlayKinds` /
`anchorVisibility` pattern.

`FloatingChrome.tsx` takes a new `mode: CanvasMode` prop (threaded from
`activeMode` in `WebGLStudioPreview`) and conditionally renders
`<DepthRail>` or `<CanvasCardsRail>`. The `CanvasPlacementFlyout` and
`BirdsEyeHud` stay as siblings (mode-agnostic). The old `SUBSURFACE_DEPTHS`
constant and season tag helpers moved to their respective rail components.

Verified live: cards rail renders in Sketch mode with PLANES header, FADE
slider, GRD card, + add button; depth rail renders in CAD mode with Z header,
MAS/PLT/GRD/SRV/SUB cells; zero chrome inside the R3F canvas (gate C rule
holds); 11 unit tests green for `canvasThumbnail.test.ts`; typecheck + lint +
vitest all green.

Scope cut: the full three-state collapse mechanic (Collapsed/Default/Expanded
drag) and reorder/context-menu are deferred to a future Phase B2 — they are
panel-level layout concerns, not card-content concerns, and shipping them in
the same phase would make it unreviewable.

### Phase C — Viewpoint filmstrip + walk/record (turn 7a / 16b)
**Status: COMPLETE — shipped 2026-09-03.** The existing `cameraBookmarks`
infrastructure (position + target, `FlythroughRig` spline playback) was
extended into the README's viewpoint model:

- **Store (`studioStore.ts`)**: `CameraBookmark` extended with optional
  `thumb` (PNG data URL) + `rig` snapshot (full `StudioCameraRig` for
  click-to-restore) + `preset`. New actions: `captureViewpoint(thumb)`,
  `restoreViewpoint(id)`, `setActiveViewpointId`, `reorderViewpoint`,
  `setRecordingWalk`. New state: `activeViewpointId`, `isRecordingWalk` —
  both view-state only (never enter `docSnapshot`).
- **`viewpointThumbnail.ts`** — pure thumbnail capture utility. The core
  crop math (`coverCropRect`) is pure (no DOM dependency) so it's
  unit-testable in Node. The runtime wrapper (`captureViewpointThumbnail`)
  calls the pure renderer with `document.createElement("canvas")`. 13 unit
  tests green.
- **`ViewpointFilmstrip.tsx`** — the filmstrip UI. Thumbs 82×52, radius 9
  (§4 Geometry). Class B selected treatment: 1.5px accent border + 0 0 0 3px
  accent/.18 ring + 18×2px accent.hi pip. Capture (+), walk/play (>), record
  (REC/STOP) controls. Hover-only delete button. Renders only in Sketch mode.
  Sits above the camera dock (bottom: 96px) to avoid collision.
- **`ViewpointFilmstrip.module.css`** — token-only CSS module, uses
  `--cf-z-chrome` from the Canvas-First z-ladder.
- **Recording**: `MediaRecorder` + `canvas.captureStream(30)` from the live
  WebGL canvas. Downloads a WebM file on stop. Guards for unsupported
  browsers (`typeof canvas.captureStream !== "function"`). Cleans up the
  recorder on unmount.
- **Wiring**: `FloatingChrome.tsx` renders `<ViewpointFilmstrip mode={mode} />`
  after `<CameraDock>`. The filmstrip returns null outside Sketch mode.

Verified live: filmstrip renders in Sketch mode with capture/walk/record
buttons; zero chrome inside the R3F canvas (gate C rule holds); filmstrip
hidden in CAD mode; 13 thumbnail tests green; typecheck + lint green.

### Phase D — Unscaled state + calibrate later (turn 15a/15c)
**Status: COMPLETE — shipped 2026-09-03.**

- **UNSCALED badge**: `page.tsx` computes `unscaled = !frame?.board_width_m`
  and threads it through `WebGLStudioPreview` → `FloatingChrome` → `WfsChips`.
  The badge renders as a hazard-coloured pill in the chip bar (after the
  primary chip, before the overlay pills). It doubles as the calibrate entry
  point — clicking it opens the `CalibrateModal`.
- **`CalibrateModal.tsx`** — the retroactive two-point calibration flow
  (turn 15c). Three steps: (1) pick two points on the canvas (the modal
  backdrop has `pointer-events: auto` on the panel only, so canvas clicks
  pass through and are captured via a `pointerdown` listener on the studio
  container), (2) type the real distance, (3) review the FROM → TO scale
  change with the hazard warning ("canvases placed by eye move too") and
  the `SCALE THEM` / `KEEP HEIGHTS` choice. The commit panel states what
  changes (stroke areas ×ratio², lengths ×ratio, canvas positions scale).

Verified live: UNSCALED badge renders for an unscaled project (no
`board_width_m`); badge absent for a scaled project; typecheck + lint green.

Scope cut: the actual stroke/canvas geometry scaling on commit is deferred —
the modal captures the two points, distance, and SCALE THEM / KEEP HEIGHTS
decision, but the store action that applies the scale ratio to all geometry
as one undoable action is not yet wired. This is a deliberate cut: the
geometry scaling pipeline needs to scale `sketchStrokes` (board-% → world
→ re-%), `sketchCanvases` (positions), `placements` (positions), and
`features` (geometry) together, which is a non-trivial coordinate transform
that deserves its own focused implementation pass.

### Phase E — Falloff preset picker (turn 14c)
**Status: COMPLETE — shipped 2026-09-03.** Verified absent (no
NARROW/BALANCED/WIDE controls existed in `ToolFlyout` or `FloatingChrome`),
then added:

- **Store (`studioStore.ts`)**: `FalloffPreset` type + `FALLOFF_PRESET_EDGES`
  constant mapping each preset to smoothstep edge values. NARROW = [0.0, 0.9]
  (steep fade, for working), BALANCED = [0.0, 1.38] (half at 46° from
  face-on), WIDE = [0.0, 0.3] (gentle fade, the original hardcoded value,
  for fly-throughs). New state: `falloffPreset: FalloffPreset` (default
  WIDE) + `setFalloffPreset`. View-state only.
- **`AngleOpacityShader.ts`**: the hardcoded `smoothstep(0.0, 0.3, dp)` is
  now a `uFalloffEdge1` uniform. Both the standalone `AngleOpacityShader`
  class and `patchMaterialForAngleOpacity` accept a `falloffEdge1` parameter.
- **`FusedSketchLayer.tsx`**: reads `falloffPreset` from the store, converts
  to `falloffEdge1` via `FALLOFF_PRESET_EDGES`, passes it through to both
  `InkStrokeRenderer` and `StippleStrokeRenderer`, and live-updates the
  `uFalloffEdge1` uniform per-frame so the operator can switch presets
  without re-mounting strokes.
- **`ToolFlyout.tsx`**: new `FalloffPicker` section in the DRAW tools
  (pen/line/spline) flyout, next to the nib picker and plane picker. Three
  buttons (NARROW/BALANCED/WIDE) with the active preset highlighted.

Verified live: falloff picker renders in the pen tool flyout with 3 buttons;
WIDE active by default; clicking NARROW switches the active preset; zero
console errors; typecheck + lint green.

### Phase F — Sketch-first entry (turn 15, item 15 in README §12)
Audit `SiteSetupModal.tsx` + the confirm-pin flow (already changed today —
see the routing work earlier in this session: confirm-pin now lands
straight in Sketch mode) against the spec's first-run requirement: ribbon
present with only the pen lit, one line of copy, three entries — Import a
survey / **Trace an address** (default) / Blank site — no tour, no modal,
no sample project.

## Verification per phase

- `pnpm lint` / `pnpm typecheck` from `apps/web` (zero-warning gate, per
  root `CLAUDE.md`).
- `pnpm vitest run` from repo root.
- Manual pass in the browser: create a project via the command palette
  (lands in Sketch mode automatically as of today's change), exercise the
  new gizmo/rail/filmstrip/calibrate flow, and confirm strokes still
  round-trip through `useStudioAutosave.ts` (autosave test file:
  `useStudioAutosave.test.ts`).
- Each phase should get its own `EnterPlanMode` pass in the CLI picking
  this up — this document is a map of the gaps, not a locked implementation
  plan; the placement-gizmo UI in particular has real design decisions
  (drag vs. numeric entry, how `TransformControls` interacts with the
  existing camera rig) worth aligning on before coding.
