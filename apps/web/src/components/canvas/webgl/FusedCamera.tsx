/**
 * Gold Standard 2026 — Fused Camera (Ortho↔Perspective Matrix Interpolation).
 *
 * THE CORE OF THE FUSED RENDERING CONTEXT.
 *
 * This component replaces the old CameraController (which used a parallax trick
 * on an orthographic camera). Instead, it runs a single PerspectiveCamera and
 * interpolates its projection matrix between orthographic and perspective every
 * frame — a true continuous transition with no hard cut.
 *
 * How it works:
 *
 *   1. Two projection matrices are built per frame from the current rig state:
 *      - orthoMatrix: matches the old orthographic plan view exactly.
 *      - perspMatrix: a perspective frustum sized to agree with ortho at blend=0.
 *
 *   2. camera.projectionMatrix is set to a lerp between them by viewBlend.
 *      At blend=0: pure orthographic (CAD-accurate, no distortion).
 *      At blend=1: full perspective (3D spatial depth).
 *      Between: smooth interpolation — no pop, no cut.
 *
 *   3. The camera POSITION arcs from directly overhead (blend=0, looking
 *      straight down — identical to ortho) to the oblique angle (blend=1,
 *      perspective tilt). The lot centre stays as the fixed look-at target.
 *
 *   4. viewBlend is driven by a SPRING (mass-spring-damper) toward
 *      viewBlendTarget. The spring is 100% interruptible — toggling back
 *      mid-transition preserves velocity and redirects smoothly.
 *
 * 60FPS FRAME BUDGET (Cinematic & Polish Pass):
 *   All per-frame matrix operations use a pre-allocated FusedCameraScratch
 *   context — zero object allocations in the hot loop. The two scratch cameras
 *   (ortho + persp) are reused by updating their frustum params + calling
 *   updateProjectionMatrix(). Temp vectors are reused. This eliminates GC
 *   pressure on tablet hardware during rapid view toggling.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §1.3 (Fused Rendering Context)
 */

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  FusedCameraScratch,
  springStep,
  CAMERA_SPRING,
  type SpringState,
} from "./cameraAnimation";
import { easeInOutCubic, useStudioStore } from "./studioStore";
import { blendTargetForPitch, isElevationRig, pitchRadians } from "./cameraRig";
import { useReducedMotion } from "./useReducedMotion";

export interface FusedCameraProps {
  scaleM: number;
  boardAspect: number;
  /**
   * Pin the blend (0 = locked ortho plan, 1 = locked persp). Used by the
   * split view's locked half: when set, this instance springs toward the
   * pinned value and does NOT write the store's viewBlend (two instances
   * must not fight over the singleton field).
   */
  viewBlendLocked?: number;
}

/**
 * Base view size — the world-space height visible at zoom=1 in the ortho view.
 * Derived from the lot scale, with padding so the lot isn't edge-to-edge.
 */
const VIEW_PADDING = 1.3;

export function FusedCamera({
  scaleM,
  boardAspect,
  viewBlendLocked,
}: FusedCameraProps) {
  const { camera, size } = useThree();
  const reducedMotion = useReducedMotion();

  // The spring state — persists velocity across frames so the camera motion is
  // 100% interruptible. When the target changes mid-flight, the existing
  // velocity carries into the new trajectory (no reset, no jump, no snap).
  // Starts at rest at position 0 (plan view).
  const springRef = useRef<SpringState>({ position: 0, velocity: 0 });

  // Second, dedicated spring for the persp → orthographic-elevation crossfade.
  const elevationSpringRef = useRef<SpringState>({ position: 0, velocity: 0 });

  // Pre-allocated scratch context — created ONCE, reused every frame.
  // This is the 60FPS optimization: zero allocations in the hot loop.
  const scratch = useMemo(() => new FusedCameraScratch(), []);

  // Reusable temp matrices (avoid per-frame allocation).
  const orthoMatrixRef = useRef(new THREE.Matrix4());
  const perspMatrixRef = useRef(new THREE.Matrix4());
  const tempMatrixRef = useRef(new THREE.Matrix4());
  const elevationMatrixRef = useRef(new THREE.Matrix4());
  const projectionRef = useRef(new THREE.Matrix4());
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    // Read the LIVE rig from the store each frame (transient — StudioControls
    // writes it during a pan/zoom drag with zero React re-renders). The rig
    // prop was removed: the store is the single source of truth for the camera.
    const rig = useStudioStore.getState().liveRig;

    // Locked instances (split view's pinned half) spring toward their pin and
    // leave the store's viewBlend to the free instance. Otherwise the spring
    // target is DERIVED from the live pitch every frame — pitch is the single
    // camera axis, so orbit gestures (which write only liveRig, zero React
    // writes per move) drive the ortho↔persp crossfade directly.
    const target =
      viewBlendLocked != null
        ? viewBlendLocked
        : blendTargetForPitch(rig.tiltDeg);

    // Spring physics — the camera has physical weight. When the user toggles
    // mid-transition, the spring's velocity carries into the new direction
    // seamlessly (no snap, no reset). Semi-implicit Euler with sub-stepping.
    // Clamped to [0,1]: a blend outside the segment is meaningless and a
    // stray overshoot once parked the camera at a garbage pitch.
    const blend = reducedMotion
      ? target
      : Math.min(
          1,
          Math.max(0, springStep(springRef.current, target, CAMERA_SPRING, delta)),
        );
    if (reducedMotion) {
      springRef.current.position = target;
      springRef.current.velocity = 0;
    }

    // Elevation crossfade — when the live rig sits at the exact φ=90° +
    // facade-normal snap, spring a second weight that crossfades the fused
    // projection into the orthographic facade frustum. Driven per-frame from
    // the live rig, so it needs no React writes and no store round-trip.
    // Locked split-view halves (viewBlendLocked) never enter elevation —
    // their camera stays overhead, where a facade frustum would be garbage.
    const elevationOn = viewBlendLocked == null && isElevationRig(rig);
    const elevationBlend = reducedMotion
      ? (elevationOn ? 1 : 0)
      : Math.min(
          1,
          Math.max(
            0,
            springStep(
              elevationSpringRef.current,
              elevationOn ? 1 : 0,
              CAMERA_SPRING,
              delta,
            ),
          ),
        );
    if (reducedMotion) {
      elevationSpringRef.current.position = elevationOn ? 1 : 0;
      elevationSpringRef.current.velocity = 0;
    }

    // Publish the animated blend so in-lockstep consumers (stroke drape) can
    // read it via getState() in their own useFrame without re-subscribing.
    if (viewBlendLocked == null) {
      useStudioStore.getState().setViewBlend(blend);
    }

    // Viewport aspect ratio.
    const viewportAspect = size.width / size.height || 1;

    // View size — the world-space extent visible at zoom=1.
    const viewSize = Math.max(scaleM, scaleM * boardAspect) * VIEW_PADDING;

    // Pitch from the rig (degrees → radians). Full orbit: 0° = overhead plan,
    // 90° = ground-level horizon (elevation when azimuth snaps to a facade).
    const tiltRad = pitchRadians(rig.tiltDeg);

    // Build both projection matrices IN-PLACE (zero allocation).
    scratch.updateOrtho(
      orthoMatrixRef.current,
      rig.zoom,
      viewportAspect,
      boardAspect,
      viewSize,
    );

    const distance = scratch.updatePersp(
      perspMatrixRef.current,
      rig.zoom,
      viewportAspect,
      boardAspect,
      viewSize,
    );

    // Lerp the projection matrix between ortho and persp by blend (in-place).
    scratch.lerpProjection(
      tempMatrixRef.current,
      orthoMatrixRef.current,
      perspMatrixRef.current,
      blend,
    );

    // In the elevation state, crossfade the fused projection into the
    // orthographic facade frustum (the same matrix builder — the horizontal
    // camera orientation is what turns it into an elevation projection).
    if (elevationBlend > 0.001) {
      scratch.updateOrtho(
        elevationMatrixRef.current,
        rig.zoom,
        viewportAspect,
        boardAspect,
        viewSize,
      );
      scratch.lerpProjection(
        projectionRef.current,
        tempMatrixRef.current,
        elevationMatrixRef.current,
        elevationBlend,
      );
    } else {
      projectionRef.current.copy(tempMatrixRef.current);
    }

    // Apply the fused projection matrix to the camera.
    camera.projectionMatrix.copy(projectionRef.current);
    // Also update the inverse (needed for raycasting / unprojection).
    camera.projectionMatrixInverse.copy(projectionRef.current).invert();

    // Compute camera position along the arc (in-place, zero allocation).
    const rotateRad = (rig.rotateDeg * Math.PI) / 180;
    scratch.computePosition(
      scratch.tempPos,
      scratch.tempLook,
      blend,
      tiltRad,
      distance,
      rig.panX,
      rig.panY,
    );

    // Apply rotation around the Y axis (plan rotation — north bearing).
    if (Math.abs(rotateRad) > 0.001) {
      const cos = Math.cos(rotateRad);
      const sin = Math.sin(rotateRad);
      const x = scratch.tempPos.x;
      const z = scratch.tempPos.z;
      scratch.tempPos.x = x * cos - z * sin;
      scratch.tempPos.z = x * sin + z * cos;
    }

    camera.position.copy(scratch.tempPos);

    // Smoothly approach the look-at target (avoids jerk on pan).
    if (reducedMotion) {
      currentLookAtRef.current.copy(scratch.tempLook);
    } else {
      currentLookAtRef.current.lerp(scratch.tempLook, Math.min(1, delta * 10));
    }
    // Deterministic orbit frame: lookAt's fixed (0,1,0) up is degenerate at
    // the plan view (view axis parallel to up), so the azimuth became
    // arbitrary numeric noise and the drawing rotated run-to-run. The
    // arc-tangent up is non-degenerate at every pitch, continuous through
    // the overhead pass, and matches the (0,1,0) convention at oblique
    // angles (camera X = -world X) — no visual flip for existing views.
    const effTilt = tiltRad * easeInOutCubic(blend);
    camera.up.set(
      -Math.cos(effTilt) * Math.sin(rotateRad),
      Math.sin(effTilt),
      -Math.cos(effTilt) * Math.cos(rotateRad),
    );
    camera.lookAt(currentLookAtRef.current);

    camera.updateMatrixWorld(true);
  });

  return null;
}
