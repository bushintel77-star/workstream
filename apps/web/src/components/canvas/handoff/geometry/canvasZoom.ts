/**
 * Infinite-feel canvas zoom — multiplicative, pointer-anchored.
 * Practical IEEE floors/ceilings only; no CAD 0.6–2.2 hard stop.
 */

/** Soft floor — whole-site context. */
export const ZOOM_MIN = 0.05;

/** Soft ceiling — detail drafting (effectively unlimited for operators). */
export const ZOOM_MAX = 64;

/** Ribbon In/Out geometric step. */
export const ZOOM_BUTTON_FACTOR = 1.18;

export function clampZoom(z: number): number {
  if (!Number.isFinite(z) || z <= 0) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** Ambient ribbon still passes ±0.1 — treat any non-zero as one geometric step. */
export function zoomByRibbonDelta(z: number, delta: number): number {
  if (delta === 0) return clampZoom(z);
  const factor = delta > 0 ? ZOOM_BUTTON_FACTOR : 1 / ZOOM_BUTTON_FACTOR;
  return clampZoom(Number((z * factor).toFixed(4)));
}

/** Trackpad / mouse wheel / pinch (ctrl+wheel) — exponential. */
export function zoomFromWheel(z: number, deltaY: number): number {
  const factor = Math.exp(-deltaY * 0.0018);
  return clampZoom(Number((z * factor).toFixed(4)));
}

/** Keyboard + / - geometric step. */
export function zoomByKeyStep(z: number, dir: 1 | -1): number {
  return zoomByRibbonDelta(z, dir);
}
