/**
 * Infinite-feel canvas zoom — multiplicative, pointer-anchored.
 * Zoom IN past the old 2.2 CAD ceiling; never shrink the parchment below
 * filling the board (the % world is already the full board at 1× — zoom-out
 * below that only creates empty borders, not more site).
 */

/**
 * Floor = fill the board. Below 1 the whole parchment scales into a postage
 * stamp with a huge empty border — there is no world beyond 0–100%.
 */
export const ZOOM_MIN = 1;

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
