/**
 * Gold Standard 2026 — dimension label declutter LOD (pure, unit-tested).
 *
 * UI root-cause survey §3.2: `declutterOutsideDims` boxes are fixed in
 * board-% (halfWPct 4.2 / halfHPct 1.1) while the chips themselves are
 * constant screen px — so at zoom-out the fixed box UNDER-hides (labels
 * overlap) and at zoom-in it OVER-hides (labels vanish unnecessarily).
 *
 * This mirrors the classic studio's zoom-aware pass (CadPlanBoard passes
 * halfWPct=(58/layout.w/z)*100, clamped [1.2, 6.5], "labels reappear as
 * zoom increases"): the box scales by 1/zoom so the declutter sees the
 * chip's real screen footprint. Plan-space only by design — under 3D tilt
 * the board-% model does not map to screen at all (known limitation, not
 * silently papered over).
 */

export interface DimDeclutterBox {
  /** Half-width of the label bbox in board-% (scales with 1/zoom). */
  halfWPct: number;
  /** Half-height of the label bbox in board-% (scales with 1/zoom). */
  halfHPct: number;
}

/** Classic clamps — labels never fully disappear at overview, never crowd
 *  at close zoom. */
export const DIM_BOX_MIN_HALF_W = 1.2;
export const DIM_BOX_MAX_HALF_W = 6.5;
export const DIM_BOX_MIN_HALF_H = 0.4;
export const DIM_BOX_MAX_HALF_H = 2.2;

/** HalfWPct at zoom 1 — matches the classic (58 px / 1440 layout * 100). */
const HALF_W_AT_ZOOM_1 = 4.03;
/** HalfHPct at zoom 1 — the declutter default for a ~15 px-tall chip. */
const HALF_H_AT_ZOOM_1 = 1.1;

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/**
 * Declutter box for a given zoom. Monotonic: larger zoom → smaller box →
 * more labels kept. Degenerate/NaN zoom falls back to plan-fit (1).
 */
export function dimDeclutterBoxForZoom(zoom: number): DimDeclutterBox {
  const z = Number.isFinite(zoom) ? Math.max(0.1, zoom) : 1;
  return {
    halfWPct: clamp(HALF_W_AT_ZOOM_1 / z, DIM_BOX_MIN_HALF_W, DIM_BOX_MAX_HALF_W),
    halfHPct: clamp(HALF_H_AT_ZOOM_1 / z, DIM_BOX_MIN_HALF_H, DIM_BOX_MAX_HALF_H),
  };
}
