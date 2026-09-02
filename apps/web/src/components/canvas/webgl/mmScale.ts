/**
 * Weight-at-scale conversion (spec 3.5) — ported verbatim from the design
 * package `code/tokens.ts`.
 *
 * Weights are expressed in mm at issued scale. Convert only at render, never
 * store px: a 0.5mm line must measure 0.5mm on an issued A1 at 1:200.
 */

export const mmToPx = (
  mm: number,
  scaleDenominator: number,
  dpi = 96,
): number => (mm / 25.4) * dpi * (200 / scaleDenominator);

/** The issued-scale denominator this studio draws at (spec §8). */
export const ISSUED_SCALE_DENOMINATOR = 200;

/** Convenience: px for a weight in mm at the studio's 1:200 issued scale. */
export const mmAtScaleToPx = (mm: number, dpi = 96): number =>
  mmToPx(mm, ISSUED_SCALE_DENOMINATOR, dpi);
