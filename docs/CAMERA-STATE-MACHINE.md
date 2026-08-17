# Camera state machine — ROUGH DRAFT

> **Not binding.** Rough narration of what shipped in PR #187 + the one open
> item. Code is the source of truth; this is just a map. Correct/extend freely.

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

- 55°/60° caps removed. `pitchRadians` clamps 0–90°.
- Plan↔3D spring target derived from **live pitch** each frame (`FusedCamera.tsx`)
  — pitch is the single axis.
- Editing lock = `viewBlend > 0.5 && !elevationActive` (`StudioScene.tsx`).
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

## The one open item: photo as pinned camera

Photos must NOT sit on the orbit. A birdseye / on-site photo is a **frozen,
calibrated frame** — a pinned camera bookmark:

- tap → fly/crossfade camera to that fixed frame (spring already exists)
- freehand unlocks **only** on a pinned camera, locks the moment you swivel away

Undefined (needs a decision before build):

- photo calibration model — how a photo maps to a camera rig (position/FOV/roll).
  Garden N/E/S/W presets exist; photo layers are still underlay toggles, not
  rigs.
- which thumbnails are "pinned" (birdseye? on-site capture? both?).
- long-press-thumbnail depends on the above — don't bolt a gesture onto a
  missing feature.

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

- Facade-plane *editing tools* at φ=90 (only the lock + projection exist today;
  ground-raycast tools no-op at the horizon).
- "Pitch dial" UI — referenced by the gesture table, not yet a shipped control.
