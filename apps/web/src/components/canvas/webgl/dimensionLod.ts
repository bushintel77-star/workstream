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

import type { AnnotationRect } from "./annotationLayout";

/**
 * Screen footprint of a dimension chip, so the callout solver can route around
 * the ring without reading the DOM every frame.
 *
 * Chips are constant screen size in a tabular-nums face, so character count
 * predicts width closely enough. Deliberately a slight over-estimate: reserving
 * a little too much costs a callout one lane, reserving too little puts a
 * callout on top of a dimension.
 */
export function estimateDimChipRect(
  text: string,
  centerX: number,
  centerY: number,
): AnnotationRect {
  const width = text.length * 6.2 + 12;
  const height = 18;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

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
 * Roughly how much wider a chip gets when the survey bearing joins the key and
 * the distance: `B7 · 48.20 m` → `B7 · S85°25'26"W · 48.20 m`. Measured off the
 * two formats' character counts in the tabular-nums technical face.
 */
export const BEARING_CHIP_WIDTH_SCALE = 2.15;

/**
 * Declutter box for a given zoom. Monotonic: larger zoom → smaller box →
 * more labels kept. Degenerate/NaN zoom falls back to plan-fit (1).
 *
 * `widthScale` stretches the box for longer chip text and is applied AFTER the
 * clamps: the clamps encode the zoom behaviour the classic studio tuned (labels
 * reappear as you zoom in, never all vanish at overview), and scaling before
 * them would let a wide chip hit DIM_BOX_MAX_HALF_W and silently under-declutter.
 */
export function dimDeclutterBoxForZoom(
  zoom: number,
  widthScale = 1,
): DimDeclutterBox {
  const z = Number.isFinite(zoom) ? Math.max(0.1, zoom) : 1;
  const scale = Number.isFinite(widthScale) && widthScale > 0 ? widthScale : 1;
  return {
    halfWPct:
      clamp(HALF_W_AT_ZOOM_1 / z, DIM_BOX_MIN_HALF_W, DIM_BOX_MAX_HALF_W) * scale,
    halfHPct: clamp(HALF_H_AT_ZOOM_1 / z, DIM_BOX_MIN_HALF_H, DIM_BOX_MAX_HALF_H),
  };
}
