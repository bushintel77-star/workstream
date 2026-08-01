/**
 * Multi-touch camera — two-finger pan + pinch zoom.
 * Pure helpers for the board capture listener; desktop Space/wheel paths stay
 * in canvasPan / canvasZoom.
 */

import { clampPan } from "./canvasPan";
import { clampZoom } from "./canvasZoom";

export type TouchPoint = { x: number; y: number };

/** Midpoint between two screen points (pinch focus / pan anchor). */
export function touchMidpoint(a: TouchPoint, b: TouchPoint): TouchPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Euclidean distance between two screen points. */
export function touchDistance(a: TouchPoint, b: TouchPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/**
 * Next zoom from a pinch distance change. Ignores degenerate spans so a
 * near-zero previous distance cannot explode the scale.
 */
export function zoomFromPinch(
  z: number,
  prevDist: number,
  nextDist: number,
): number {
  if (!(prevDist > 8) || !(nextDist > 0) || !Number.isFinite(nextDist)) {
    return clampZoom(z);
  }
  const factor = nextDist / prevDist;
  if (!Number.isFinite(factor) || factor <= 0) return clampZoom(z);
  return clampZoom(Number((z * factor).toFixed(4)));
}

/** Pan delta from midpoint movement (screen px → pan offset). */
export function panFromTouchMidpoint(
  base: { x: number; y: number },
  startMid: TouchPoint,
  currentMid: TouchPoint,
): { x: number; y: number } {
  return {
    x: clampPan(base.x + (currentMid.x - startMid.x)),
    y: clampPan(base.y + (currentMid.y - startMid.y)),
  };
}

/** True when the board should treat this as a two-finger camera gesture. */
export function isTwoFingerCameraGesture(pointerCount: number): boolean {
  return pointerCount >= 2;
}
