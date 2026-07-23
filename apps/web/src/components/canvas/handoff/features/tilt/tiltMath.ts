/**
 * Tilt lens math — view-only 2.5D axonometric preview.
 * Strictly camera presentation; never inverted into board pointer maths.
 */

/** Default settle angle for Cmd+K / client-view flourish (deg). */
export const TILT_DEG = 55;

/** Continuous Ctrl/Cmd+drag ceiling (deg). */
export const TILT_MAX = 60;

/** Release below this angle snaps flat (deg). */
export const TILT_SNAP_FLAT = 15;

/** Dwelling eave height — same constant Fit sheet elevation profile uses. */
export const TILT_EAVE_M = 5;

/**
 * Safety clears for the temporary transform transition class.
 * Slightly above the CSS durations (420ms / 2000ms) so a missed
 * transitionend / transitioncancel cannot leave the class stuck.
 */
export const TILT_ANIM_MS_FAST = 700;
export const TILT_ANIM_MS_SLOW = 2500;

/** Board px represented by one metre at the current camera zoom. */
export function pxPerMetre(
  boardW: number,
  scaleM: number,
  zoom: number,
): number {
  const w = Math.max(1, boardW);
  const m = Math.max(1e-6, scaleM);
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return (w / m) * z;
}

/** Standing billboard CSS for a planted item of known height. */
export function billboardStyle(
  heightM: number,
  ppm: number,
  tiltDeg: number,
): {
  transform: string;
  transformOrigin: string;
  height: string;
} {
  const h = Math.max(0, heightM) * Math.max(0, ppm);
  return {
    transform: `rotateX(${-tiltDeg}deg)`,
    transformOrigin: "bottom center",
    height: `${h}px`,
  };
}

/** True when the lens is active enough to lock editing. */
export function isTiltActive(tiltDeg: number): boolean {
  return Number.isFinite(tiltDeg) && tiltDeg > 0.5;
}

/**
 * Clamp a continuous drag delta into the 0…TILT_MAX window.
 * Positive dy (drag down) increases tilt — maps-app convention.
 */
export function tiltFromDragDelta(
  startDeg: number,
  dyPx: number,
  sensitivity = 0.18,
): number {
  const next = startDeg + dyPx * sensitivity;
  return Math.max(0, Math.min(TILT_MAX, next));
}

/** Snap policy on gesture release. */
export function settleTiltDeg(deg: number): number {
  if (!Number.isFinite(deg) || deg < TILT_SNAP_FLAT) return 0;
  return Math.min(TILT_MAX, deg);
}
