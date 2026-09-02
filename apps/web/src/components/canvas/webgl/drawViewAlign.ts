/**
 * Phase G — Draw Mode camera alignment.
 *
 * Pure math for computing the face-on camera rig that locks the view
 * parallel to a SketchCanvas plane. In Draw Mode, the camera looks
 * directly at the canvas plane with the plane's normal as the view
 * direction — the operator draws on a flat surface, not an oblique one.
 *
 * Convention: the camera rig's tiltDeg (0 = top-down plan, 90 = horizon)
 * maps to the canvas fold angle, and rotateDeg (plan rotation) maps to
 * the bearing. The ground plane (canvas_id = null) is the trivial case:
 * tiltDeg = 0, rotateDeg = 0 (pure plan view).
 */

import type { StudioCameraRig } from "./cameraRig";
import { DEFAULT_CAMERA_RIG } from "./cameraRig";
import { decomposeFoldQuaternion } from "./canvasPlacement";
import * as THREE from "three";

/**
 * Compute the face-on camera rig for a canvas with the given rotation
 * quaternion. Returns a rig with tiltDeg + rotateDeg set to look directly
 * at the plane, preserving the current pan/zoom/focus.
 */
export function alignRigToCanvas(
  rotation: [number, number, number, number],
  currentRig: StudioCameraRig,
): StudioCameraRig {
  const q = new THREE.Quaternion(
    rotation[0],
    rotation[1],
    rotation[2],
    rotation[3],
  );
  const { angleDeg, bearingDeg } = decomposeFoldQuaternion(q);
  // tiltDeg = fold angle (0 = plan, 90 = horizon — same as the canvas).
  // rotateDeg = bearing (which way the plane faces).
  return {
    ...currentRig,
    tiltDeg: angleDeg,
    rotateDeg: bearingDeg,
  };
}

/**
 * The ground plane (canvas_id = null) face-on rig is pure plan view.
 */
export function alignRigToGround(
  currentRig: StudioCameraRig,
): StudioCameraRig {
  return {
    ...currentRig,
    tiltDeg: 0,
    rotateDeg: 0,
  };
}

/**
 * Decide which alignment to use based on the active canvas id.
 * Returns the rig that locks the camera face-on to the active plane.
 */
export function alignRigToActiveCanvas(
  activeCanvasId: string | null,
  canvases: Array<{ id: string; rotation: [number, number, number, number] }>,
  currentRig: StudioCameraRig,
): StudioCameraRig {
  if (activeCanvasId === null) {
    return alignRigToGround(currentRig);
  }
  const canvas = canvases.find((c) => c.id === activeCanvasId);
  if (!canvas) {
    return alignRigToGround(currentRig);
  }
  return alignRigToCanvas(canvas.rotation, currentRig);
}

export { DEFAULT_CAMERA_RIG };
