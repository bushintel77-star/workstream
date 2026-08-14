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
 *   4. viewBlend is ANIMATED toward viewBlendTarget (in the store) each frame
 *      via exponential decay — ~600ms for a full 0→1 transition. The user
 *      toggles or slides the target; the camera glides.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §1.3 (Fused Rendering Context)
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { StudioCameraRig } from "./cameraRig";
import {
  buildOrthoMatrix,
  buildPerspMatrix,
  fusedCameraPosition,
  lerpProjectionMatrix,
  approachEased,
} from "./cameraAnimation";
import { useStudioStore } from "./studioStore";

export interface FusedCameraProps {
  rig: StudioCameraRig;
  scaleM: number;
  boardAspect: number;
}

/**
 * Base view size — the world-space height visible at zoom=1 in the ortho view.
 * Derived from the lot scale, with padding so the lot isn't edge-to-edge.
 */
const VIEW_PADDING = 1.3;

export function FusedCamera({ rig, scaleM, boardAspect }: FusedCameraProps) {
  const { camera, size } = useThree();

  // The actual animated blend value — kept in a ref, mutated per-frame.
  // Starts at 0 (plan view). The store holds the TARGET; we ease toward it.
  const blendRef = useRef(0);

  // Reusable temp objects (avoid per-frame allocation).
  const orthoMatrixRef = useRef(new THREE.Matrix4());
  const perspMatrixRef = useRef(new THREE.Matrix4());
  const tempMatrixRef = useRef(new THREE.Matrix4());
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    // Read the target blend from the store (transient — zero re-renders).
    const { viewBlendTarget } = useStudioStore.getState();

    // Ease the actual blend toward the target.
    blendRef.current = approachEased(blendRef.current, viewBlendTarget, delta);
    const blend = blendRef.current;

    // Viewport aspect ratio.
    const viewportAspect = size.width / size.height || 1;

    // View size — the world-space extent visible at zoom=1.
    const viewSize = Math.max(scaleM, scaleM * boardAspect) * VIEW_PADDING;

    // Tilt from the rig (degrees → radians). Max 55° = natural architectural.
    const tiltRad = Math.min((rig.tiltDeg * Math.PI) / 180, (55 * Math.PI) / 180);

    // Build both projection matrices.
    orthoMatrixRef.current = buildOrthoMatrix(
      rig.zoom,
      viewportAspect,
      scaleM,
      boardAspect,
      viewSize,
    );

    const { matrix: perspMatrix, distance } = buildPerspMatrix(
      rig.zoom,
      viewportAspect,
      scaleM,
      boardAspect,
      viewSize,
      tiltRad,
    );
    perspMatrixRef.current = perspMatrix;

    // Lerp the projection matrix between ortho and persp by blend.
    lerpProjectionMatrix(
      tempMatrixRef.current,
      orthoMatrixRef.current,
      perspMatrixRef.current,
      blend,
    );

    // Apply the fused projection matrix to the camera.
    camera.projectionMatrix.copy(tempMatrixRef.current);
    // Also update the inverse (needed for raycasting / unprojection).
    camera.projectionMatrixInverse.copy(tempMatrixRef.current).invert();

    // Compute camera position along the arc.
    const rotateRad = (rig.rotateDeg * Math.PI) / 180;
    const { position, lookAt } = fusedCameraPosition(
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
      const x = position.x;
      const z = position.z;
      position.x = x * cos - z * sin;
      position.z = x * sin + z * cos;
    }

    camera.position.copy(position);

    // Smoothly approach the look-at target (avoids jerk on pan).
    currentLookAtRef.current.lerp(lookAt, Math.min(1, delta * 10));
    camera.lookAt(currentLookAtRef.current);

    camera.updateMatrixWorld(true);
  });

  return null;
}
