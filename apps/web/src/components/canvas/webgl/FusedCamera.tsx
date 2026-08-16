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
import type { StudioCameraRig } from "./cameraRig";
import {
  FusedCameraScratch,
  springStep,
  CAMERA_SPRING,
  type SpringState,
} from "./cameraAnimation";
import { useStudioStore } from "./studioStore";
import { useReducedMotion } from "./useReducedMotion";

export interface FusedCameraProps {
  rig: StudioCameraRig;
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
  rig,
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

  // Pre-allocated scratch context — created ONCE, reused every frame.
  // This is the 60FPS optimization: zero allocations in the hot loop.
  const scratch = useMemo(() => new FusedCameraScratch(), []);

  // Reusable temp matrices (avoid per-frame allocation).
  const orthoMatrixRef = useRef(new THREE.Matrix4());
  const perspMatrixRef = useRef(new THREE.Matrix4());
  const tempMatrixRef = useRef(new THREE.Matrix4());
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    // Locked instances (split view's pinned half) spring toward their pin
    // and leave the store's viewBlend to the free instance.
    const target =
      viewBlendLocked != null ? viewBlendLocked : useStudioStore.getState().viewBlendTarget;

    // Spring physics — the camera has physical weight. When the user toggles
    // mid-transition, the spring's velocity carries into the new direction
    // seamlessly (no snap, no reset). Semi-implicit Euler with sub-stepping.
    const blend = reducedMotion
      ? target
      : springStep(springRef.current, target, CAMERA_SPRING, delta);
    if (reducedMotion) {
      springRef.current.position = target;
      springRef.current.velocity = 0;
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

    // Tilt from the rig (degrees → radians). Max 55° = natural architectural.
    const tiltRad = Math.min((rig.tiltDeg * Math.PI) / 180, (55 * Math.PI) / 180);

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

    // Apply the fused projection matrix to the camera.
    camera.projectionMatrix.copy(tempMatrixRef.current);
    // Also update the inverse (needed for raycasting / unprojection).
    camera.projectionMatrixInverse.copy(tempMatrixRef.current).invert();

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
    camera.lookAt(currentLookAtRef.current);

    camera.updateMatrixWorld(true);
  });

  return null;
}
