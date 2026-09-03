# Mental Canvas — build roadmap

Written 2026-09-03 after a full audit of the design handoff spec
(`design_handoff_landscape_canvas/.../README.md` + `BUILD_CHECKLIST.md`)
against the live codebase. This is the single source of truth for what is
done, what remains, and in what order.

**Spec:** `design_handoff_landscape_canvas/design_handoff_landscape_canvas/README.md`
**Checklist:** `design_handoff_landscape_canvas/design_handoff_landscape_canvas/BUILD_CHECKLIST.md`
**Visual truth:** `Landscape Canvas.dc.html` — cards 16a/16b/16c/17a/17b are
the build targets; turns 1-15 are rationale, not instructions.

---

## Completed work

### Pre-existing foundations (shipped before the Mental Canvas phases)

The WebGL studio already had a real spatial sketching engine, not a stub:

- **SketchCanvasGroup.tsx** — each canvas is a real spatial node: position +
  rotation quaternion, raycast mesh, strokes in board-% space.
- **StrokeTransferLayer.tsx** — projects strokes from one canvas plane onto
  another via forward perspective projection (turn 14a).
- **AngleOpacityShader.ts** — strokes fade with camera-to-canvas angle
  (smoothstep on view/normal dot product) plus seasonal crossfade.
- **studioStore.ts** — full CRUD for canvas planes, wired into undo/redo.
- **R3F scene shell** — FusedCamera with four rigs (PLAN/AXO/SEC/3D), plane
  stack at real z-heights, 320ms projection-matrix blend.
- **Plane-locked ruler** as scene geometry (not DOM) — `stationing.ts`,
  `SketchCanvasGroup.tsx`.
- **Crosshair + E/N/Z chip** — `NibCrosshair`, `metaChips.ts`.
- **Snapping** from stationing — `snapWorld.ts`.
- **Pen-down quiet state** — `penDown` in store, ribbon/dock/chips respond.
- **Four nibs** — pen, charcoal, marker, stipple.
- **Stroke-to-object promotion** — `sketchCad.ts`, `scheduleVectorize`.
- **Schedule** with tabs (planting/hardscape/services) — `ScheduleSheet.tsx`.
- **Section view** — `SectionLayer.tsx`, `cutFill.ts`, `sectionGeometry.ts`.
- **Ghost review** — `GhostOverlay.tsx`, confidence floor in store.
- **Command palette** (Cmd+K) — `StudioCommandPalette.tsx`.
- **Scan reveal** (staged import) — `scanReveal.tsx`, `AiScanOverlay.tsx`.
- **Flora ring** — `FloraRingLayer.tsx`.
- **Depth rail** — `DepthRail.tsx`.
- **Layers panel** — `LayersPanel.tsx`.

### Phase A — Hinge/Parallel projection canvas placement (turn 14b)

**Status: COMPLETE.** Replaced the single "+" button with the actual Mental
Canvas placement mechanic: `CanvasPlacementFlyout.tsx` (required name, five
presets, numeric height/bearing), `ParallelProjectionHandle.tsx` (flat-plane
height drag), `HingeProjectionGizmo.tsx` (fold-angle drag with angle-snap glyph
morphing), `BirdsEyeHud.tsx` (secondary mini-viewport with frustum wireframe
and canonical view buttons). Commits: `e2ef9f1`, `9be0d78`.

### Phase B/B2 — Canvas rail as real cards (turn 16b)

**Status: COMPLETE.** Mode-conditional rails: `DepthRail.tsx` (non-sketch
modes, fixed reference bands) and `CanvasCardsRail.tsx` (sketch mode, 74x46
cards with live SVG thumbnails, eye toggle, hover delete, season tag, inline
rename, drag-to-reorder, collapse/expand, context menu). Store additions:
`hiddenCanvasIds`, `inactiveCanvasOpacity`, `canvasOrder`, `railCollapsed`.

### Phase C/C2 — Viewpoint filmstrip + walk/record (turn 7a/16b)

**Status: COMPLETE.** `ViewpointFilmstrip.tsx` with capture/walk/record
controls, `FlythroughRig.tsx` spline playback with configurable per-segment
timing (linger/transition/loop), progress bar. `viewpointThumbnail.ts` for
thumbnail capture. Store: `cameraBookmarks` extended with thumb + rig +
preset, `walkLingerS`, `walkTransitionS`, `walkLoop`, `walkProgress`.

### Phase D/D2 — Unscaled state + calibrate later (turn 15a/15c)

**Status: COMPLETE.** `WfsChips` renders hazard-coloured UNSCALED pill
(doubles as calibrate entry point). `CalibrateModal.tsx` implements
retroactive two-point calibration with SCALE THEM / KEEP HEIGHTS commit.
`commitCalibration` scales canvas positions as one undoable action.

### Phase E — Falloff presets (turn 14c)

**Status: COMPLETE.** NARROW/BALANCED/WIDE picker in DRAW tool flyout
(`FalloffPicker` in `ToolFlyout.tsx`), wired through to
`AngleOpacityShader.ts`'s `uFalloffEdge1` uniform. `FusedSketchLayer.tsx`
live-updates the uniform per-frame.

### Phase F — Sketch-first entry (turn 15)

**Status: COMPLETE.** Sketch always unlocked (was gated behind `hasAerial`),
`suggestedMode` returns Sketch for blank board, boundary gate removed from
`firstSketchGuide.ts`, hint copy matches spec.

### Phase G — Draw/View camera mode

**Status: COMPLETE.** `DrawViewToggle.tsx` locks camera face-on to active
canvas in Draw Mode (prevents parallax distortion), free orbit in View Mode.
`drawViewAlign.ts` computes face-on rig from canvas quaternion. Orbit gestures
gated off in Draw Mode.

### Phase H — Selection Mode (red-mask isolation + boolean ops)

**Status: COMPLETE.** `SelectionModeToggle.tsx` + `SelectionIsolationOverlay.tsx`
with red-tinted vignette and floating toolbar (count, ALL, INVERT, NONE,
CLEAR, DONE). Store: `selectionModeActive`, `subtractFromSelection`,
`invertSelection`, `selectAll`.

### Phase I — Brushes panel parity

**Status: COMPLETE.** `NibPicker` upgraded to visual texture grid with SVG
brush previews, width slider, stroke-matching eraser (scales to stroke's own
width). Store: `brushWidthOverride`, `eraserActive`, `eraseStrokeAt`.

### Phase J — Visibility Panel (per-bookmark canvas visibility keyframing)

**Status: COMPLETE.** `VisibilityPanel.tsx` renders canvas x viewpoint matrix
with eye toggles. `FlythroughRig.tsx` applies keyframes during playback,
restores original hidden set on stop. Store: `viewpointVisibility`,
`toggleViewpointVisibility`.

### Phase K — Numeric entry on every flyout parameter (spec section 5.3)

**Status: COMPLETE.** `NumericSlider.tsx` combines range slider with
tap-to-type numeric input (clamps on blur/Enter, Escape cancels, separate
unit span). Replaced raw sliders in ToolFlyout, ViewpointFilmstrip,
CanvasCardsRail, FloatingChrome.

### Chrome sizing audit

**Status: COMPLETE.** All WebGL chrome font sizes raised to 9.5px mono floor
(8.5px group headers allowed). Slider geometry corrected to spec (3px track,
10px ink thumb). Filmstrip de-bloated (700px to 494px). ~233 lines of orphaned
CSS removed. Commit: `c0273c0`.

### CI/deploy fix

**Status: COMPLETE.** `/home` route was statically importing WebGLStudioPreview
(3315 kB vs 900 kB budget), failing the bundle-size gate on every push and
blocking Railway deploy. Fixed with `LazyWebGLStudioPreview.tsx` (client
component, `next/dynamic` ssr: false). Commit: `91b196d`.

---

## Build roadmap — remaining phases

Ordered by dependency and impact. Each phase references the BUILD_CHECKLIST
items it closes. Phases are independently shippable unless a dependency is
named.

### Phase L — Chrome contract per camera state

**BUILD_CHECKLIST: Phase 6 (6.1-6.10), spec section 11c**
**Dependency: None (governs existing chrome)**
**Size: Largest structural gap — 10 items**

The spec requires every chrome element to have one of four behaviours per
camera state (same / convert / lock / hide), driven by a single contract.
None of this exists today. `ChromeRecedeWatcher.tsx` handles orbit recede
but not the convert/lock/hide contract.

Build items:
- L.1 Port `code/chromeContract.ts`; drive every camera-dependent element
  from it. Each element gets an entry for all four modes (PLAN/AXO/SEC/3D).
- L.2 Ruler converts to horizon band with bearings only in 3D, cross-fading
  at 60% of the 420ms transition.
- L.3 Coordinate chip converts to eye height / bearing / fov in 3D.
- L.4 Dimensions billboard, prefix approximate, marked indicative in 3D,
  and are not issuable.
- L.5 GRADE + MEASURE lock in 3D with lock glyph and one stated reason line
  ("locked in perspective — switch to PLAN or AXO to measure").
- L.6 Weight control converts mm to screen px in 3D and says so.
- L.7 Depth rail skews to a stack in 3D; becomes band selector in SEC.
- L.8 Suncast + drainage hide in SEC.
- L.9 Test: every `ChromeElement` has an entry for all four modes. Adding a
  new element without a rule fails the test.
- L.10 Test: no chrome element bounding box changes between camera states.

Done when: the test asserting every ChromeElement has an entry for all four
modes passes, and the no-bounding-box-change test passes for all four modes.

### Phase M — Material palette, dash signatures, assets

**BUILD_CHECKLIST: Phase 8 (8.1-8.10), spec sections 7.1/8c/5b/5c**
**Dependency: None**
**Size: 10 items**

Missing items:
- M.1 21-material palette, grouped, 22px swatches, no colour wheel. Active
  ring per section 4.
- M.2 Build-up ramp at 0.22 / 0.42 / 0.62 / 0.82 / 1.0.
- M.3 Dash signatures mandatory for every semantic markup material (8c).
  Sofftscape stays hue-only.
- M.4 Signature scales with stroke weight, not zoom. Dash length is constant
  across 3 zoom levels.
- M.5 Greyscale proof: render palette to greyscale; every semantic line is
  still distinguishable.
- M.6 Asset bento (CANOPY/SHRUB/HARD/FURN/SYM) with real dimensions on each
  tile (`spread 9.0m, ht 14m`).
- M.7 Drag to active plane, ghost carries readout, dashed mature-spread ring
  on ground.
- M.8 Snap `canopy grid 3m`; option-drop scatters x5.
- M.9 Stroke-to-object promotion: loop detection produces quiet chip at nib
  (110ms) with area, perimeter, plane. Enter promotes, Escape keeps ink.
  Non-modal. (The promotion logic exists in `sketchCad.ts`; the chip UI does
  not.)
- M.10 Cmd+Z reverts a promotion to ink with stroke geometry byte-identical.

Done when: greyscale proof passes; a 0.5mm line measures 0.5mm on an issued
A1 at 1:200; dash length is constant across 3 zoom levels.

### Phase N — Strike chip + conflict card

**BUILD_CHECKLIST: Phase 12 (12.5-12.6), spec section 11a**
**Dependency: None**
**Size: 2 items**

The services/subsurface system exists (TrenchLayer, SubsurfaceEngine) but the
operator-facing strike chip and conflict card are missing.

- N.1 Strike chip in the top bar beside the WFS chips. Count + severity, tap
  cycles and flies the camera. In-scene pulse is halo-opacity only, 1400ms —
  no scale, no colour flash.
- N.2 Conflict card: utility, trench depth, clearance, tolerance, severity +
  REROUTE / DEEPEN / FLAG, labelled `indicative`.

Done when: no run renders without a source and a measured/assumed flag; the
canvas carries `indicative only, not a substitute for locating`.

### Phase O — Error and empty states

**BUILD_CHECKLIST: Rules of engagement stop-condition 2, spec "Open before
the sprint starts" item 2**
**Dependency: None**
**Size: Broad surface, 1 spec item**

The spec lists this as a blocking open item: "only WFS failure is drawn.
Failed import, empty schedule, corrupt underlay, rejected calibration are
not."

- O.1 Failed import state — drawn, not silent.
- O.2 Empty schedule state — drawn, not silent.
- O.3 Corrupt underlay state — drawn, not silent.
- O.4 Rejected calibration state — drawn, not silent.

Done when: each failure mode has a drawn state that names what failed and
offers retry or dismiss. No failure is silent.

### Phase P — History scrub

**BUILD_CHECKLIST: Phase 13 (13.4-13.5), spec section 8a**
**Dependency: None**
**Size: 2 items**

- P.1 History scrub: segmented by activity (survey / grading / paving /
  planting / markup), ghost-ahead compare, volume delta readout (then vs
  delta now), 1:1 with the finger, zero easing.
- P.2 Branch-on-edit: releasing the head with work ahead offers a branch —
  never a silent overwrite.

Done when: the scrub head tracks the finger with zero easing; releasing
with work ahead offers a branch, not an overwrite.

### Phase Q — Sheet composition / issue PDF

**BUILD_CHECKLIST: Phase 16 (16.1-16.12), spec section 18a**
**Dependency: Phase M (dash signatures for auto legend)**
**Size: 12 items**

- Q.1 Sheets are live viewports onto the same canvas — never copies. Editing
  the canvas changes the sheet with no re-import.
- Q.2 Viewport chrome states camera, scale-at-sheet-size, and LIVE.
- Q.3 Legend auto-builds from materials actually used, carrying dash
  signatures.
- Q.4 Title block: project / sheet / scale / date / rev / north / template
  version.
- Q.5 Sheet set rail + paper size + orientation; one action issues the whole
  set as PDF.
- Q.6 Greyscale proof of an issued sheet is legible and every semantic line
  is distinguishable.
- Q.7 Sheet is the second and last light surface. `paper.bg` used only by the
  schedule and the sheet.
- Q.8 Slots read from the bound office template; drag tray lists every
  available viewport plus site photos and schedule extracts.
- Q.9 Dropping inside a slot follows the standard; dropping outside marks
  the sheet with an override.
- Q.10 Crop, never rescale. A viewport dropped into a smaller frame keeps its
  scale and crops.
- Q.11 The dragged frame states what the scale would become, offered as a
  decision — never applied.
- Q.12 Viewports live until issued, then the issued revision is frozen.

Done when: editing the canvas after issue changes the working sheet and not
the issued PDF; a viewport dropped into a smaller frame keeps its scale and
crops.

### Phase R — Office template

**BUILD_CHECKLIST: Phase 15 (15.1-15.11), spec section 17a/17b**
**Dependency: Phase Q (sheet slots read from template)**
**Size: 11 items**
**Blocked: 15.11 needs a permission model (stop-condition 3)**

- R.1 Port `code/officeTemplate.ts`. Template holds conventions only —
  assert it can hold no geometry.
- R.2 Editor on `panel.bg` with section rail carrying live counts.
- R.3 Sections: planes, trade packs, materials, line weights + signatures,
  sheet and title block, schedule codes, defaults.
- R.4 Weights stated in mm at issued scale; changing one re-renders bound
  drawings at next open and never edits geometry.
- R.5 Binding is a reference. Editing the template updates all bound
  projects with no per-project write.
- R.6 Overrides name what, who, when, why; null reason renders as "no reason
  given" — never hidden.
- R.7 Override count appears in the project chip; revert is one action per
  item.
- R.8 New version is an offer with a diff, item by item, each stating its
  computed consequence.
- R.9 Destructive changes (renumbering, anything touching an issued
  revision) default to unchecked.
- R.10 Sheets already issued keep the version they were issued at; the
  version prints in the title block.
- R.11 PROMOTE TO v5 needs a permission model — resolve stop-condition 3
  before shipping.

Done when: editing the template updates all bound projects with no
per-project write; a new version is an offer with a diff, not a silent
change.

### Phase S — AI run from camera dock

**BUILD_CHECKLIST: Phase 16b (16b.1-16b.9), spec section 18b**
**Dependency: None**
**Size: 9 items**

- S.1 Entry lives on the camera dock beside the time pill. No new panel, no
  prompt box. No free-text input anywhere in the flow.
- S.2 Inputs are read from the file — geometry, materials, species, sun,
  growth year — and each is listed with its count before the run.
- S.3 Staged progress with real per-stage completion and elapsed time. A
  stalled stage shows as stalled, never as a moving spinner.
- S.4 Drawing continues during a run; a stroke committed mid-run joins the
  next run, and the UI says so.
- S.5 Result is a derived view with a drawing-to-render scrub; at 0 the ink
  is untouched underneath.
- S.6 Refusal 1: an unspecified bed renders empty. A bed with no species
  produces no planting.
- S.7 Refusal 2: the run cannot write geometry. No code path from the run
  touches `objects` or a stroke.
- S.8 Anything placed on a sheet from a run carries `indicative render, not
  a construction document`.
- S.9 A run records its inputs so it can be reproduced or invalidated when
  the drawing changes. Editing a bed marks the placed render stale, with the
  reason named.

Done when: no free-text input exists in the flow; a stalled stage shows as
stalled; editing a bed after a run marks the render stale.

### Phase T — Acceptance pass

**BUILD_CHECKLIST: Phase 17 (17.1-17.10)**
**Dependency: All phases above**
**Size: 10 items**

Run these against the finished build, in order. All must pass.

- T.1 Overlay each of 16a/16b/16c/17a/17b against the running app at 1:1.
  Report every delta over 2px.
- T.2 Camera matrix: no chrome bounding box moves across all four modes.
- T.3 Measurement: a known 10m span reads 10m in PLAN, AXO and SEC, and reads
  no chainage at all in 3D.
- T.4 Derived integrity: mutate one bed's geometry; schedule area, softscape
  total and canopy cover all change with no explicit refresh.
- T.5 Motion audit: no chrome element animates position anywhere;
  prefers-reduced-motion zeroes everything but the 120ms camera.
- T.6 Legibility: no chrome label below 9.5px mono / 8.5px group header,
  anywhere, in any state.
- T.7 Provenance: no imported or derived element renders without its source;
  no view shows a number it cannot prove.
- T.8 Round trip: empty site to sketch over an aerial unscaled to calibrate
  to draft to plane, schedule, section to compose sheets to AI run to issue
  PDF. No dead ends, no unspecified interaction.
- T.9 Offline: kill the network mid-session. Drawing continues, queue count
  is visible, nothing blocks, everything replays.
- T.10 Real content: run one real job — survey, plant list, services —
  through all three screens. Layout breaks that invented data hid are found
  here, not in the field.

---

## Deferred

These are real parts of the spec but are explicitly out of scope for the
current platform per CLAUDE.md or the spec's own "Out of v1" list.

| Item | Reason |
|------|--------|
| Sync + collaboration (Phase 13.6-13.7, section 8b) | Single-tenant store per CLAUDE.md. The sync states (offline queue, conflict UI) could be built without real-time sync, but the full collaboration model is deferred. |
| Site mode / phone capture (Phase 14, section 16c) | Separate Expo surface (`apps/mobile`). The spec's site-mode capture flow is a different product, not a responsive breakpoint. |
| Panel customisation | "Out of v1, on purpose" (spec section 0). |
| Light canvas theme | "Out of v1, on purpose" (spec section 0). |
| Desktop layout | "Out of v1, on purpose" (spec section 0). |
| Real underlay loading | "Out of v1, on purpose" (spec section 0). |

---

## Spec open items

The spec lists three items as "Open before the sprint starts":

1. **Numeric entry on every flyout parameter** — COMPLETE (Phase K).
2. **Error and empty states** — Phase O.
3. **Real project content** — Phase T.10.

---

## Verification per phase

- `pnpm lint` / `pnpm typecheck` from `apps/web` (zero-warning gate).
- `pnpm vitest run` from repo root.
- Manual pass in the browser: create a project via the command palette
  (lands in Sketch mode), exercise the new flow, confirm strokes still
  round-trip through `useStudioAutosave.ts`.
- Each phase should get its own plan pass in the CLI picking this up —
  this document is a map of the gaps, not a locked implementation plan.
