import type { SheetBox } from "./types";
import type { PctPoint } from "./types";

/** Architectural reference — sheet content scale is relative to 1:100. */
export const SHEET_REF_DENOM = 100;

export type SheetContentView = {
  /** Transform origin on the board (%). Lot centre. */
  focusX: number;
  focusY: number;
  /**
   * CSS scale for plan content inside a fixed plot clip.
   * Paper frame stays put; only the drawing resizes.
   */
  zoom: number;
  /**
   * px translation applied *after* scale (with origin on the lot centre)
   * so the title boundary lands centred in the A3/A4 plot — not stranded
   * under the schedule column or outside the paper.
   */
  panX: number;
  panY: number;
};

function bboxOf(pts: PctPoint[]): {
  midX: number;
  midY: number;
  spanX: number;
  spanY: number;
} | null {
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    midX: (minX + maxX) / 2,
    midY: (minY + maxY) / 2,
    spanX: Math.max(maxX - minX, 4),
    spanY: Math.max(maxY - minY, 4),
  };
}

/**
 * Fit the title boundary into the drawable A3/A4 plot, then apply 1:N print scale.
 *
 * Critical:
 * - Fit the **lot** (title boundary), not the outdoor remnant — otherwise the
 *   cadastral outline overflows the paper while the garden fills the plot.
 * - Return a pan offset that centres the lot on the plot. Scale alone (with
 *   pan forced to 0) left the drawing stranded on the board and clipped out
 *   of the sheet.
 * - Scale is applied on a child under a *fixed* plot clip — never on the
 *   same node as clip-path.
 */
export function sheetContentView(args: {
  boundary: PctPoint[];
  building: PctPoint[];
  scaleM?: number;
  boardW: number;
  boardH: number;
  plot: SheetBox;
  scaleDenom: number;
  /** Padding fraction of the plot used by the lot at 1:100 (room for outside dims). */
  pad?: number;
}): SheetContentView {
  const {
    boundary,
    building,
    boardW,
    boardH,
    plot,
    scaleDenom,
    pad = 0.8,
  } = args;

  const bw = Math.max(1, boardW);
  const bh = Math.max(1, boardH);
  const plotWPct = (plot.boxW / bw) * 100;
  const plotHPct = (plot.boxH / bh) * 100;
  const plotCx = ((plot.boxLeft + plot.boxW / 2) / bw) * 100;
  const plotCy = ((plot.boxTop + plot.boxH / 2) / bh) * 100;

  // Title boundary is what must sit on the working drawing. Fall back to the
  // building envelope only when the lot ring is missing.
  const lot =
    bboxOf(boundary) ??
    bboxOf(building) ??
    null;

  const denom = Math.max(1, scaleDenom);
  const printFactor = SHEET_REF_DENOM / denom;

  if (!lot || plotWPct < 1 || plotHPct < 1) {
    return {
      focusX: Number(plotCx.toFixed(2)),
      focusY: Number(plotCy.toFixed(2)),
      zoom: Number((printFactor * pad).toFixed(4)),
      panX: 0,
      panY: 0,
    };
  }

  // Fit lot into plot at 1:100, then scale by ref/denom (1:50 → larger on paper).
  const fitX = (plotWPct * pad) / lot.spanX;
  const fitY = (plotHPct * pad) / lot.spanY;
  const fitAtRef = Math.min(fitX, fitY);
  const zoom = Number(
    Math.max(0.05, Math.min(64, fitAtRef * printFactor)).toFixed(4),
  );

  // After scale-around-lot-centre, translate so the lot centre lands on plot centre.
  const panX = Number((((plotCx - lot.midX) / 100) * bw).toFixed(2));
  const panY = Number((((plotCy - lot.midY) / 100) * bh).toFixed(2));

  return {
    focusX: Number(lot.midX.toFixed(2)),
    focusY: Number(lot.midY.toFixed(2)),
    zoom,
    panX,
    panY,
  };
}
