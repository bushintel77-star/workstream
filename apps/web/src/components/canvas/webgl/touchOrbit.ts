/**
 * Multi-touch orbit — two-finger pinch zoom, twist azimuth, vertical-drag
 * pitch. Pure math for the WebGL studio's StudioControls touch wiring; the
 * desktop Cmd/Ctrl+drag orbit lives in cameraRigGesture.ts. Pitch shares the
 * desktop drag's sensitivity constant (deg per px), while twist maps 1:1 —
 * fingers rotating 90° rotate the view 90°.
 */
import { clampPitchDeg, type StudioCameraRig } from "./cameraRig";
import { ORBIT_TILT_SENSITIVITY } from "./cameraRigGesture";

export type TouchPoint = { x: number; y: number };

/** Wrap a heading into [0, 360). */
function wrap360(deg: number): number {
  const w = deg % 360;
  return w < 0 ? w + 360 : w;
}

/** Euclidean distance between two touch points (screen px). */
export function touchDistance(a: TouchPoint, b: TouchPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Angle of the vector a→b in degrees (0 = +x axis, screen CCW positive). */
export function touchAngleDeg(a: TouchPoint, b: TouchPoint): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** True when this is a two-finger camera gesture (not a single-finger pan). */
export function isTwoFingerGesture(pointerCount: number): boolean {
  return pointerCount >= 2;
}

export interface TouchOrbitState {
  active: boolean;
  startZoom: number;
  startTilt: number;
  startAzimuth: number;
  startDist: number;
  startAngle: number;
  startMidY: number;
}

/** Open a two-finger orbit gesture, anchored to the current (live) rig. */
export function beginTouchOrbit(
  rig: StudioCameraRig,
  a: TouchPoint,
  b: TouchPoint,
): TouchOrbitState {
  return {
    active: true,
    startZoom: rig.zoom,
    startTilt: clampPitchDeg(rig.tiltDeg),
    startAzimuth: rig.rotateDeg,
    startDist: touchDistance(a, b),
    startAngle: touchAngleDeg(a, b),
    startMidY: (a.y + b.y) / 2,
  };
}

export interface TouchOrbitMoveResult {
  /** Next live rig combining pinch zoom + twist azimuth + vertical pitch. */
  nextRig: StudioCameraRig;
}

/**
 * Advance a two-finger orbit in one pure step:
 *   - pinch → zoom (distance ratio; degenerate spans guarded like the board)
 *   - twist → azimuth (angle delta, drag CW = rotate CW)
 *   - vertical midpoint movement → pitch (drag down = steeper, the same sign
 *     as the desktop orbit's vertical drag)
 * Never writes state — the caller hands the result to setLiveRig.
 */
export function touchOrbitMove(
  state: TouchOrbitState,
  rig: StudioCameraRig,
  a: TouchPoint,
  b: TouchPoint,
): TouchOrbitMoveResult {
  const dist = touchDistance(a, b);
  const angle = touchAngleDeg(a, b);
  const midY = (a.y + b.y) / 2;

  let zoom = state.startZoom;
  if (state.startDist > 8 && dist > 8 && Number.isFinite(dist)) {
    zoom = Math.min(Math.max(state.startZoom * (dist / state.startDist), 0.1), 50);
  }

  const azimuth = wrap360(state.startAzimuth + (angle - state.startAngle));
  const tilt = clampPitchDeg(
    state.startTilt + (midY - state.startMidY) * ORBIT_TILT_SENSITIVITY,
  );

  return { nextRig: { ...rig, zoom, rotateDeg: azimuth, tiltDeg: tilt } };
}

/** Two-finger double-tap window (ms) — two two-finger taps within this return to plan. */
export const TOUCH_DOUBLE_TAP_MS = 300;

/**
 * True when a second two-finger touch-start lands within the double-tap
 * window (the brief's "return to plan: two-finger double-tap").
 */
export function isTwoFingerDoubleTap(
  previousStartMs: number | null,
  nowMs: number,
): boolean {
  return (
    previousStartMs != null && nowMs - previousStartMs <= TOUCH_DOUBLE_TAP_MS
  );
}
