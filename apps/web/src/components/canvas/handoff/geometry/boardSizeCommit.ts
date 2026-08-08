/**
 * Board layout size commit — CSS pixels only.
 *
 * ResizeObserver contentRect / element.clientWidth are CSS px, not device px.
 * devicePixelRatio > 1 does not multiply these values, so integer rounding is
 * safe on high-DPI displays: a 960 CSS-px board is still 960 at DPR 2.
 *
 * Used to keep Fit-sheet re-seed keys (`paper:denom:WxH`) stable under
 * sub-pixel RO noise without swallowing real layout changes (≥0.5 CSS px).
 */

export type BoardSizePx = { w: number; h: number };

/** Round a measured board size to integer CSS pixels. */
export function roundBoardSizeCssPx(w: number, h: number): BoardSizePx {
  return {
    w: Math.max(0, Math.round(w)),
    h: Math.max(0, Math.round(h)),
  };
}

/**
 * Next board size, or `null` when the rounded size is unchanged
 * (skip React state + Fit-seed key churn).
 */
export function nextBoardSize(
  prev: BoardSizePx,
  w: number,
  h: number,
): BoardSizePx | null {
  const next = roundBoardSizeCssPx(w, h);
  if (prev.w === next.w && prev.h === next.h) return null;
  return next;
}

/** Same key shape as HandoffDesignStudio fit-seed effect. */
export function fitSeedBoardKey(
  paper: string,
  sheetScaleDenom: number,
  size: BoardSizePx,
): string {
  return `${paper}:${sheetScaleDenom}:${size.w}x${size.h}`;
}
