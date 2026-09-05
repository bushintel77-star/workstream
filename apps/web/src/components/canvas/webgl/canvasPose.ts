/**
 * Sketch canvas pose math — board-% ⇄ world on a placed canvas plane.
 *
 * Extracted from SketchCanvasGroup.tsx (2026-09-05, bundle ratchet): the
 * functions are pure and tiny, but living beside the scene-graph component
 * meant any chrome module importing them (e.g. wallSeam) pulled THREE and
 * the whole R3F group into the first-load bundle. Import from here.
 */

import * as THREE from "three";
import type { SketchCanvas } from "@workstream/contracts";
import { pctToWorld, worldToPct, type PctPoint } from "./coordTransform";

/** Board-% on a canvas plane → world metres, through the plane's pose. */
export function canvasPctToWorld(
  pct: PctPoint,
  canvas: SketchCanvas,
  scaleM: number,
  boardAspect: number,
): THREE.Vector3 {
  const [x, z] = pctToWorld(pct, scaleM, boardAspect);
  const local = new THREE.Vector3(x, 0, z);
  const planePos = new THREE.Vector3(
    canvas.position[0],
    canvas.position[1],
    canvas.position[2],
  );
  const planeQuat = new THREE.Quaternion(
    canvas.rotation[0],
    canvas.rotation[1],
    canvas.rotation[2],
    canvas.rotation[3],
  );
  return local.applyQuaternion(planeQuat).add(planePos);
}

/** World point → board-% on a canvas plane: the world point expressed in the
 *  plane's local frame, then local metres → board-% (z is discarded — the
 *  caller projects onto the plane's plane first). */
export function worldToCanvasPct(
  world: THREE.Vector3,
  canvas: SketchCanvas,
  scaleM: number,
  boardAspect: number,
): PctPoint {
  const planePos = new THREE.Vector3(
    canvas.position[0],
    canvas.position[1],
    canvas.position[2],
  );
  const planeQuat = new THREE.Quaternion(
    canvas.rotation[0],
    canvas.rotation[1],
    canvas.rotation[2],
    canvas.rotation[3],
  );
  const local = world.clone().sub(planePos).applyQuaternion(planeQuat.clone().invert());
  // Local X → board X%, local Z → board Y% (matching the ground-plane
  // convention where world Z = board Y).
  return worldToPct(local.x, local.z, scaleM, boardAspect);
}

export type { PctPoint };
