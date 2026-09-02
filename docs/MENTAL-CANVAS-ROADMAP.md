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

### Phase A — Canvas placement gizmo + naming (turn 14b)
Replace the single "+" button in `FloatingChrome.tsx` with:
- A placement flow (reuse the `ToolFlyout.tsx` "blooming" pattern — it's
  the established second-tier-panel idiom in this codebase, see
  `docs/GOLD-STANDARD-2026-ARCHITECTURE.md` and the flyout's own
  `data-testid="tool-flyout"` convention) exposing lay-flat vs stand-up,
  a bearing/height input, and the five presets (ground / terrace / canopy /
  boundary wall / hedge line).
- A required name field before `addSketchCanvas` commits — extend
  `SketchCanvas` usage (check `packages/contracts/src/schemas/` for the
  `SketchCanvas` schema — add a `name` field there first if it's not already
  present, per this repo's "contracts is the Zod schema boundary" rule in
  the root `CLAUDE.md`).
- A live 3D gizmo — likely a small `@react-three/drei` `TransformControls`
  or a bespoke handle mesh in `SketchCanvasGroup.tsx`, showing the plane's
  live dimensions + bearing as it's dragged, matching `4c`'s camera-dock
  feel for readouts.

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
