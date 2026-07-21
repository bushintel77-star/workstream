import { outdoorRemnantRingsPct } from "./outdoorClamp";
import type { SheetBox } from "./types";
import type { PctPoint } from "./types";

/** Architectural reference — sheet content scale is relative to 1:100. */
export const SHEET_REF_DENOM = 100;

export type SheetContentView = {
  /** Transform origin on the board (%). */
  focusX: number;
  focusY: number;
  /**
   * CSS scale for plan content inside a fixed plot clip.
   * Paper frame stays put; only the drawing resizes.
   */
  zoom: number;
};

/**
 * Fit outdoor remnant into the drawable plot box, then apply 1:N print scale.
 *
 * Critical: this scale is applied on a child under a *fixed* plot clip — never
 * on the same node as clip-path (that locked the frame to the drawing).
 */
export function sheetContentView(args: {
  boundary: PctPoint[];
  building: PctPoint[];
  scaleM?: number;
  boardW: number;
  boardH: number;
  plot: SheetBox;
  scaleDenom: number;
  /** Padding fraction of the plot used by the remnant at 1:100. */
  pad?: number;
}): SheetContentView {
  const {
    boundary,
    building,
    scaleM = 110,
    boardW,
    boardH,
    plot,
    scaleDenom,
    pad = 0.88,
  } = args;

  const bw = Math.max(1, boardW);
  const bh = Math.max(1, boardH);
  const plotWPct = (plot.boxW / bw) * 100;
  const plotHPct = (plot.boxH / bh) * 100;
  const plotCx = ((plot.boxLeft + plot.boxW / 2) / bw) * 100;
  const plotCy = ((plot.boxTop + plot.boxH / 2) / bh) * 100;

  const rings = outdoorRemnantRingsPct(boundary, building, scaleM);
  const pts = rings.flat();
  const use = pts.length >= 2 ? pts : boundary;

  if (use.length < 2 || plotWPct < 1 || plotHPct < 1) {
    const denom = Math.max(1, scaleDenom);
    return {
      focusX: Number(plotCx.toFixed(2)),
      focusY: Number(plotCy.toFixed(2)),
      zoom: Number(((SHEET_REF_DENOM / denom) * pad).toFixed(4)),
    };
  }

  const xs = use.map((p) => p.x);
  const ys = use.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const spanX = Math.max(maxX - minX, 4);
  const spanY = Math.max(maxY - minY, 4);

  // Fit remnant into plot at 1:100, then scale by ref/denom (1:50 → larger).
  const fitX = (plotWPct * pad) / spanX;
  const fitY = (plotHPct * pad) / spanY;
  const fitAtRef = Math.min(fitX, fitY);
  const denom = Math.max(1, scaleDenom);
  const zoom = fitAtRef * (SHEET_REF_DENOM / denom);

  // Prefer remnant centre when it sits inside the plot; else plot centre.
  const inPlotX =
    midX >= (plot.boxLeft / bw) * 100 &&
    midX <= ((plot.boxLeft + plot.boxW) / bw) * 100;
  const inPlotY =
    midY >= (plot.boxTop / bh) * 100 &&
    midY <= ((plot.boxTop + plot.boxH) / bh) * 100;

  return {
    focusX: Number((inPlotX ? midX : plotCx).toFixed(2)),
    focusY: Number((inPlotY ? midY : plotCy).toFixed(2)),
    zoom: Number(Math.max(0.05, Math.min(64, zoom)).toFixed(4)),
  };
}
