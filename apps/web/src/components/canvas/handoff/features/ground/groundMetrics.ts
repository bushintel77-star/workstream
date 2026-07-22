import { ZOOM_MIN } from "../../geometry/canvasZoom";

/** Indicative board width in metres at architectural scale 1:100. */
export const BOARD_WIDTH_M_AT_100 = 110;

export type SheetScaleDenom = 50 | 100 | 200 | 250 | 500;

/**
 * Metres across the board.
 *
 * Free-plan world metres stay at {@link BOARD_WIDTH_M_AT_100} (or a calibrated
 * `boardWidthM`) — print 1:N must NOT mutate live CAD metres. Pass `100` for
 * free plan; Fit sheet may still pass the print denom only for HUD copy.
 */
export function boardScaleM(sheetScaleDenom: SheetScaleDenom = 100): number {
  return (BOARD_WIDTH_M_AT_100 * sheetScaleDenom) / 100;
}

/** Visible metres across the viewport after zoom. */
export function visibleMetres(
  sheetScaleDenom: SheetScaleDenom,
  zoom: number,
): number {
  return boardScaleM(sheetScaleDenom) / Math.max(ZOOM_MIN, zoom);
}

export function pickMetricStepM(visibleM: number): number {
  if (visibleM < 35) return 1;
  if (visibleM < 70) return 5;
  if (visibleM < 160) return 10;
  if (visibleM < 320) return 25;
  if (visibleM < 700) return 50;
  return 100;
}

export type GroundPhase = "parchment" | "cadastral" | "aerial";

/**
 * Intent-driven ground phase: clean parchment → ghost cadastral on address
 * → aerial soft-stack when imagery lands (parchment remains underlay).
 */
export function resolveGroundPhase(args: {
  hasAerial: boolean;
  hasBoundary: boolean;
  address?: string | null;
}): GroundPhase {
  if (args.hasAerial) return "aerial";
  if (args.hasBoundary || (args.address && args.address.trim().length > 8)) {
    return "cadastral";
  }
  return "parchment";
}
