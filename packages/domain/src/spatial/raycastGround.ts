/**
 * Plane-to-Ground Raycasting — project photo-space stroke points through a
 * calibrated pinhole camera onto the ground plane.
 *
 * P2 photogrammetric engine (directive §2). For a calibrated camera
 * (`photoCalibrator.PhotoCalibration`), a 2D image point (px) defines a ray;
 * intersecting that ray with the ground plane y = 0 yields a true metric
 * ground position in the camera frame, then mapped through the camera pose
 * into board space. Stroke points above the horizon (rays that never reach
 * the ground) are rejected — never projected into nonsense.
 *
 * The board-% convention mirrors the WebGL coordTransform (lot centred,
 * `scaleM` across the board width, Y divided by boardAspect), so unwarped
 * strokes drop straight into the plan pipeline: `classifySpatialEntity`
 * (user_stroke → draft.user_draft) and `interpretSketchStrokesToCad`
 * (`SketchStrokeInput.points` are exactly `{ x, y }` board-%).
 */

import type { LayerID } from "../layers/layerRegistry";
import { classifySpatialEntity } from "./classifySpatialEntity";
import type { PhotoCalibration } from "./photoCalibrator";

export interface PhotoPoint2D {
  xPx: number;
  yPx: number;
}

export interface GroundPoint {
  xM: number;
  zM: number;
}

/** A board-% point ({x, y} ∈ 0–100) — the plan-space shape CAD consumes. */
export interface PhotoBoardPctPoint {
  x: number;
  y: number;
}

const DEG = Math.PI / 180;

/**
 * Project one image point to the ground plane. Null when the ray points at
 * or above the horizon (tan of the elevation angle ≤ 0) — the caller should
 * drop such points rather than fabricate a position.
 */
export function photoPointToGround(
  p: PhotoPoint2D,
  calib: PhotoCalibration,
): GroundPoint | null {
  const phi = calib.pitchDeg * DEG;
  const tanElev = Math.tan(phi + Math.atan((p.yPx - calib.principalYPx) / calib.focalPx));
  if (!Number.isFinite(tanElev) || tanElev <= 1e-9) return null;
  const depthM = calib.cameraHeightM / tanElev;
  const lateralM = ((p.xPx - calib.principalXPx) / calib.focalPx) * depthM;

  // Apply the camera-frame pose: rotate by yaw, then translate.
  const yaw = calib.pose.yawDeg * DEG;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    xM: calib.pose.originXm + lateralM * cos - depthM * sin,
    zM: calib.pose.originZm + lateralM * sin + depthM * cos,
  };
}

/**
 * Project a photo-space stroke to ground points. Above-horizon points are
 * skipped (a stroke that runs off the top simply loses those vertices).
 */
export function raycastPhotoStrokeToGround(
  stroke: PhotoPoint2D[],
  calib: PhotoCalibration,
): GroundPoint[] {
  const out: GroundPoint[] = [];
  for (const p of stroke) {
    const g = photoPointToGround(p, calib);
    if (g) out.push(g);
  }
  return out;
}

/**
 * Metre-space ground point → board-% (lot-centred; the WebGL coordTransform
 * convention: x = (xM + scaleM/2)/scaleM·100, y = (zM + scaleM·aspect/2)/
 * (scaleM·aspect)·100).
 */
export function metresToBoardPct(
  g: GroundPoint,
  scaleM: number,
  boardAspect: number,
): PhotoBoardPctPoint {
  const lotWidthM = scaleM;
  const lotHeightM = scaleM * boardAspect;
  return {
    x: ((g.xM + lotWidthM / 2) / lotWidthM) * 100,
    y: ((g.zM + lotHeightM / 2) / lotHeightM) * 100,
  };
}

/**
 * Project a photo-space stroke straight to board-% plan coordinates —
 * the shape `interpretSketchStrokesToCad` consumes (`SketchStrokeInput.points`).
 */
export function photoStrokeToBoardPct(
  stroke: PhotoPoint2D[],
  calib: PhotoCalibration,
  scaleM: number,
  boardAspect: number,
): PhotoBoardPctPoint[] {
  return raycastPhotoStrokeToGround(stroke, calib).map((g) =>
    metresToBoardPct(g, scaleM, boardAspect),
  );
}

/**
 * CAD classification integration (directive §3): unwarp a photo stroke to
 * board-% plan coordinates and classify it through the Spatial Classifier.
 * Returns the plan stroke plus its registry layer id — the stroke is now a
 * native plan entity (user stroke → draft.user_draft) and can be fed to
 * `interpretSketchStrokesToCad` for CAD geometry. The elevation-space
 * scoped-out stamp no longer applies to unwarped strokes.
 */
export function classifyUnwarpedStroke(
  stroke: PhotoPoint2D[],
  calib: PhotoCalibration,
  scaleM: number,
  boardAspect: number,
): { points: PhotoBoardPctPoint[]; layerId: LayerID } {
  const points = photoStrokeToBoardPct(stroke, calib, scaleM, boardAspect);
  const classified = classifySpatialEntity({ id: "", source: "user_stroke" });
  return { points, layerId: classified.layerId };
}
