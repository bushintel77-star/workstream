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
  drag. Phase A3.
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

1. **No placement gizmo (§14b).** Adding a canvas plane is a single "+"
   button that stacks a new flat plane at the next preset Z height. The spec
   calls for two gestures — **lay flat** at a height or **stand up** on a
   bearing — with a live gizmo reading `vertical · 6.2 × 4.4 m · bearing
   018°`, `⌥` to lay flat, `⇧` to snap 15°, double-tap to fit to site, and
   presets (ground 0.00, upper terrace +1.20, canopy +4.50, boundary wall,
   hedge line). None of that exists; every plane is horizontal.
2. **No naming on create.** Spec: "Naming is required on create." Current
   planes are unnamed Z-stack entries (season chip + Z value only, per the
   `sortedCanvases.map(...)` render in `FloatingChrome.tsx`).
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

**Status: in progress, actively planned** — see "Mental Canvas UX
reference" below for the source research. This phase replaces the single
"+" button in `FloatingChrome.tsx` with the *actual* Mental Canvas
placement mechanic rather than a generic drag-arrows gizmo, decided after
the user reviewed a full UX teardown of the real app mid-session
(2026-09-03).

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
- **A1** — naming + presets (ground/terrace/canopy/boundary-wall/hedge-
  line) + a Parallel Projection height-drag handle for flat planes. New:
  `canvasPlacement.ts` (presets + `foldQuaternion(angle, bearing)`),
  `CanvasPlacementFlyout.tsx` (new sibling to `ToolFlyout.tsx` — that
  component is hardcoded to the tool ribbon's DOM/handedness, not
  reusable as-is for the depth rail's `+` cell),
  `ParallelProjectionHandle.tsx` (raycast-drag, same primitive as
  `AssetPlaceLayer.tsx`, not drei `TransformControls`), plus
  `studioStore.ts` additions (`beginSketchCanvasTransform` /
  `setSketchCanvasTransformTransient` / `endSketchCanvasTransform`,
  mirroring the placement trio at `studioStore.ts:1948-1985`) and an
  `adjustingCanvasId` transient field.
- **A2** — `HingeProjectionGizmo.tsx`: axis line with two ground-anchor
  handles + one centre fold handle (0°→90° drag), angle-snap glyph
  morphing, live angle/bearing readout.
- **A3** — `BirdsEyeHud.tsx`: its own small, separate
  `@react-three/fiber` `<Canvas>` (**not** a scissored/`Hud`-primitive
  share of the main canvas — `SplitViewLens.tsx`'s own header comment
  explains why that conflicts with the EffectComposer post-FX stack;
  mount a second real canvas instead, same as split-view does), shown
  only during an active A2 fold drag.

Full build plan (file-by-file, with the "not this session's Explore
findings" caveats) lives in the CLI's own plan file when this was
scoped — regenerate via `EnterPlanMode` if picking this up cold rather
than assuming a stale plan file still matches `main`.

### Phase B — Canvas rail as real cards (turn 16b)
Upgrade `FloatingChrome.tsx`'s `sortedCanvases.map(...)` chip row into the
spec's "canvases-as-cards rail" — cards 74×46, radius 9, gap 7
(`§4 Geometry` table in the README) showing name + a live thumbnail, not
just a season toggle + Z label.

### Phase C — Viewpoint filmstrip + walk/record (turn 7a / 16b)
New subsystem. No existing store fields for it — extend `studioStore.ts`'s
`sketch:` block per the README's §9 state shape:
`viewpoints [{ id, camera, thumb }], playing, recording`. UI: a filmstrip
strip (thumbs 82×52, active border per `§4 Geometry`) plus walk/record
controls, likely living beside the camera dock (`CameraDock.tsx`).

### Phase D — Unscaled state + calibrate later (turn 15a/15c)
- Badge: a first-class `UNSCALED` indicator (doubles as the calibrate
  entry point) wherever the project has no confirmed scale — check how
  `project.lat`/`lng`/survey status currently gate scale in
  `apps/web/src/app/projects/[id]/page.tsx` (`webglScaleM` derivation) to
  find where "unscaled" would need to short-circuit.
- Retroactive two-point calibration: tap two points, type the real
  distance, derive a ratio, and scale strokes/canvases/spreads/areas
  together as one undoable action (reuse the `docSnapshot`/history pattern
  already used by `addSketchCanvas` etc. in `studioStore.ts`). Must surface
  the real hazard the spec calls out: **canvases placed by eye move too**
  (offer `SCALE THEM` / `KEEP HEIGHTS`).

### Phase E — Falloff preset picker (turn 14c) — verify first
Before building anything: grep `FloatingChrome.tsx` and `ToolFlyout.tsx`
specifically for how (or whether) `AngleOpacityShader`'s falloff curve is
exposed as a user-facing NARROW/BALANCED/WIDE control. If it's genuinely
absent, add it as a `ToolFlyout` section next to the nib/plane pickers
already there for DRAW tools.

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
