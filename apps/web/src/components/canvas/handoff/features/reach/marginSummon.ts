/**
 * Keep summoned chrome (instruments / inventory) in the canvas margin —
 * never parked over the central drafting zone.
 */

/** Centre band of the lot (board %). Summon chrome is pushed out of this. */
const LOT_CORE_MIN = 24;
const LOT_CORE_MAX = 76;

/** Outer gutter clamps (board %). */
const GUTTER_MIN = 10;
const GUTTER_MAX = 90;

/**
 * Push a summon point into the left/right (or top/bottom) gutter so
 * AmbientRibbon / AssetPanel never hover the drawing core.
 */
export function clampToCanvasMargin(
  x: number,
  y: number,
): { x: number; y: number } {
  let nx = x;
  let ny = y;

  if (nx > LOT_CORE_MIN && nx < LOT_CORE_MAX) {
    nx = nx < 50 ? GUTTER_MIN + 4 : GUTTER_MAX - 4;
  }
  if (ny > LOT_CORE_MIN && ny < LOT_CORE_MAX && nx > 20 && nx < 80) {
    /* If still mid-board on Y after X push (rare), park in vertical gutter. */
    ny = ny < 50 ? GUTTER_MIN + 6 : GUTTER_MAX - 6;
  }

  return {
    x: Math.max(GUTTER_MIN, Math.min(GUTTER_MAX, nx)),
    y: Math.max(GUTTER_MIN + 4, Math.min(GUTTER_MAX - 4, ny)),
  };
}
