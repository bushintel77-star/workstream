/**
 * Infinite canvas zoom — multiplicative, pointer-anchored.
 * Zoom IN and OUT freely (soft IEEE floor/ceiling only) on free plan and on
 * A3/A4 Fit sheet (paper-fit × user zoom). Zoom-out on the free board is paired
 * with a full-bleed paper underlay so the board never collapses into a
 * postage stamp with empty chrome borders.
 */

/** Soft floor — whole-site / beyond-lot context. */
export const ZOOM_MIN = 0.05;

/** Soft ceiling — detail drafting (effectively unlimited for operators). */
export const ZOOM_MAX = 64;

/** Ribbon In/Out geometric step. */
export const ZOOM_BUTTON_FACTOR = 1.18;

export function clampZoom(z: number): number {
  if (!Number.isFinite(z) || z <= 0) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * Fit sheet camera helper — paper-fit × relative user zoom, clamped.
 * Prefer absolute `ui.zoom` on the board (seeded to paper-fit on Fit enter).
 */
export function composeSheetZoom(paperFit: number, userZoom: number): number {
  const fit = Number.isFinite(paperFit) && paperFit > 0 ? paperFit : 1;
  const u = Number.isFinite(userZoom) && userZoom > 0 ? userZoom : 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((fit * u).toFixed(4))));
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
