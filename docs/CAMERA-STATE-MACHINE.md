# Camera state machine

> **Not binding.** This is a map of the shipped camera machine: PR #187
> (single-pitch full-orbit camera + elevation snap + touch orbit) plus the
> photo-trace elevation capstone (2026-08-18). Code is the source of truth;
> this is just a map. Correct/extend freely.

## What is real today

One continuous camera. Single rig:

```
(φ pitch 0–90°, θ azimuth 0–360°, zoom z, pan px/py)
```

No separate "tilt" / "full-3D" / "elevation" modes. Renderer + editing are both
*derived* from `(φ, θ)`.

| φ | θ | Renderer | Editing |
|---|---|---|---|
| 0 | any | orthographic plan | ✅ unlocked |
| 0 < φ < 90 | any | perspective orbit | 🔒 locked |
| ≈90 (≤1.5°) | snapped to k·90° (≤2°) | orthographic facade (elevation) | ✅ unlocked |
| ≈90 | oblique | perspective at horizon | 🔒 locked |

Facts already in code:

- 55°/60° caps removed. `pitchRadians`/`clampPitchDeg` clamp 0–90°
  (`cameraRig.ts`, `PITCH_MAX_DEG = 90`).
- Plan↔3D spring target derived from **live pitch** each frame (`FusedCamera.tsx`)
  — pitch is the single axis.
- Editing lock = `viewBlendTarget > 0.5 && !elevationActive` (`StudioScene.tsx`,
  the `tiltLocked` prop).
- CAD linework (boundary, setbacks, dims, tape) is 3D scene geometry + camera
  billboards — already persists at every pitch. No work.

## Matrix math (as implemented)

```
tiltRad = φ · π / 180

blendTarget = locked ?? (φ > 0.5° ? 1 : 0)      // spring-integrated → blend
P            = lerp(P_ortho(z), P_persp(fov=30°, z), blend)
               // persp frustum sized to match ortho at blend=0 → no pop

eff          = tiltRad · easeInOutCubic(blend)
height       = d · cos(eff)
south        = d · sin(eff)
pos          = rotateY( (px, height, py + south), θ )
look         = (px, 0, py)

// elevation crossfade (second spring, only when isElevationRig):
P             = lerp(P, P_ortho_facade(z), elevationBlend)
// camera at eff = π/2 → ground level, looking horizontal
```

Settle on release: `settleOrbitRig` snaps `φ→90`, `θ→nearest k·90` iff within
the 1.5° / 2° tolerances.

## Gestures

| Input | Desktop | Touch (site tablet) |
|---|---|---|
| Pan | middle-drag / space+drag | one-finger drag |
| Zoom | scroll / pinch | two-finger pinch |
| Azimuth | horizontal Cmd/Ctrl+drag | two-finger twist |
| Pitch 0–90° | vertical Cmd/Ctrl+drag | two-finger vertical drag |
| Jump to photo | click pinned thumbnail | long-press thumbnail ⬜ |
| Return to plan | tap pitch dial | two-finger double-tap ✅ |

Sensitivities: pitch `0.35°/px`, azimuth `0.4°/px` (desktop drag); twist 1:1.
Touch: pinch = distance ratio, vertical = `0.35°/px`, double-tap = 300 ms window.

## Photo as pinned camera — SHIPPED (2026-08-18)

Previously "the one open item" after PR #187; shipped in the 2026-08-18
photo-trace elevation capstone (implemented in the working tree on `main`;
commit/PR pending — see `ONBOARDING.md` status note).

Photos are **frozen, calibrated frames** — pinned camera bookmarks, not
underlay toggles:

- tap a gallery photo → fly/crossfade camera to that fixed frame (rig fly +
  the existing blend/elevation springs)
- freehand unlocks **only** on a pinned camera, locks the moment you swivel
  away (photo-trace session owns pointer capture; the ground ink layer
  stands down)

Decisions made (were open before the 2026-08-18 session):

- **Calibration model — reference-line calibration.** The photo stands as a
  vertical plane in metre-space; the operator draws one line along any
  feature with a known real length (presets: 1.8 m fence line, 2.1 m door
  height, 0.9 m fence pail, 2.4 m ceiling, or a typed value) and the plane
  rescales so that drawn length equals the reference. One known dimension
  calibrates the whole frame; existing strokes rescale with it. Uncalibrated
  planes and sheets are stamped "indicative" (no-mock-data law).
- **Boundary reconciliation.** At pin time the plane snaps onto the title
  boundary edge the camera faces — the edge's real (usually non-cardinal)
  bearing becomes the plane azimuth and the camera's elevation snap treats
  that bearing as a facade normal (`elevationFacadeAzimuth` override; the
  cardinal snap is unchanged for everything else). No boundary → the plane
  keeps the default centre and is stamped locational-indicative.
- **Which thumbnails are pinnable — a per-project site-photo gallery**
  (`survey.site_photos`, upload/list/delete at `/projects/:id/site-photos`),
  distinct from the single survey aerial. Any gallery photo pins to a facade
  look (nearest N/E/S/W of the current azimuth on first pin).
- **Trace artifact — a photo elevation sheet** in the existing
  elevation-board family: photo at true-metre scale (1 px = 1 cm grid),
  ground line, metre ticks, the trace overlaid, and the calibration stamp.
  Persisted as `DesignCanvas.photo_elevations` (reference-line calibration +
  plane-space strokes) and autosaved with the canvas.

Files: `PhotoTracePlane.tsx` (plane mesh, pointer capture, rig fly),
`PhotoTraceHud.tsx` (trace/calibrate chrome), `SitePhotoGallery.tsx`
(meta-tab gallery), `PhotoElevationSheet.tsx` (sheet artifact),
`photoTraceMath.ts` (plane geometry, raycast, calibration, pin rig — pure,
unit-tested), `apps/api/src/routes/site-photos.ts` (gallery API).

## Files

- `apps/web/src/components/canvas/webgl/FusedCamera.tsx` — fused ortho↔persp, elevation crossfade
- `apps/web/src/components/canvas/webgl/cameraAnimation.ts` — spring, projection builders, arc
- `apps/web/src/components/canvas/webgl/cameraRig.ts` — rig type, pitch/elevation/snap helpers
- `apps/web/src/components/canvas/webgl/cameraRigGesture.ts` — desktop orbit math
- `apps/web/src/components/canvas/webgl/touchOrbit.ts` — two-finger orbit math
- `apps/web/src/components/canvas/webgl/StudioControls.tsx` — gesture wiring + commit
- `apps/web/src/components/canvas/webgl/studioStore.ts` — `setPitchDeg`, `elevationActive`
- `apps/web/src/components/canvas/webgl/StudioScene.tsx` — editing-lock derivation

## Out of scope / open questions

- Facade-plane *editing tools* at φ=90 — shipped for pinned photos (the
  photo-trace plane raycasts freehand at the facade). Bare-facade editing on
  the scene's own geometry (no photo) is still not built.
- "Pitch dial" UI — referenced by the gesture table, not yet a shipped control.

## Facade raycasting gotcha (measured, 2026-08-18)

The fused camera is a `PerspectiveCamera` instance carrying an ORTHO facade
projection at the elevation snap. THREE's raycaster picks the perspective
branch (instance type), so a pointer ray = camera position → unproject(x, y,
0.5). With the ortho box at near/far ±10000, that reference point lands
~5000 m away and the ray ends up nearly parallel to the view axis: a full
0.28-NDC screen sweep hit only ~9 cm of plane surface (~120x squash) — R3F
`e.point` and manual rays both suffer it. The ortho lateral mapping is
z-independent, so the fix is to skip the ray: unproject the pointer straight
to a world point and project onto the target plane
(`PhotoTracePlane.hitFromEvent`). Ground-plane tools at the horizon inherit
the same bug — that is the real mechanism behind "ground-raycast tools
no-op at the horizon"; a general fix would unproject-to-ground the same way
instead of raycasting.
