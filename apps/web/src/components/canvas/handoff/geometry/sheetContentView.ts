import type { PaperSize, SheetBox } from "./types";
import type { PctPoint } from "./types";

/** Architectural reference — sheet content scale is relative to 1:100. */
export const SHEET_REF_DENOM = 100;

/**
 * Discrete print-scale ladder (AU working-drawing standards). Ascending —
 * `snapDenomUp` walks it in order. Single source of truth; FitSheetOverlay
 * re-exports for its Alt+wheel stepper. Includes the 150/300/400
 * intermediates — without them a lot needing 1:260 snapped to 1:500 and
 * printed at half the possible size.
 */
export const SHEET_SCALE_STEPS = [50, 100, 150, 200, 250, 300, 400, 500] as const;
export type SheetScaleDenom = (typeof SHEET_SCALE_STEPS)[number];

/** ISO paper widths (mm) for the two supported sheet formats. */
export const SHEET_PAPER_WIDTH_MM: Record<PaperSize, number> = {
  a3: 420,
  a4: 210,
};

/** Printed millimetres represented by one screen px of the sheet frame. */
export function sheetMmPerPx(paper: PaperSize, sheetBoxW: number): number {
  return SHEET_PAPER_WIDTH_MM[paper] / Math.max(1, sheetBoxW);
}

/**
 * The camera zoom that renders the plan at a TRUE 1:denom on the printed
 * sheet. Derived purely from calibration — board metres (`scaleM` across
 * `boardW` px) against printed mm per screen px — never from "what fits".
 * This is what makes the title-block scale stamp honest: the drawing is
 * at the labelled scale, not fit-to-plot relabelled as 1:100.
 */
export function trueZoomForDenom(args: {
  scaleM: number;
  boardW: number;
  mmPerPx: number;
  denom: number;
}): number {
  const mPerPx = args.scaleM / Math.max(1, args.boardW);
  const denom = Math.max(1, args.denom);
  const mmPerPx = Math.max(1e-6, args.mmPerPx);
  return (mPerPx * 1000) / (denom * mmPerPx);
}

/** Smallest ladder step that fits (ladder ascending); clamps to the coarsest. */
export function snapDenomUp(rawDenom: number): SheetScaleDenom {
  for (const d of SHEET_SCALE_STEPS) if (d + 1e-9 >= rawDenom) return d;
  return SHEET_SCALE_STEPS[SHEET_SCALE_STEPS.length - 1]!;
}

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
  /** Exact denominator at which the lot fills `pad` of the plot. */
  rawDenom: number;
  /** `rawDenom` snapped up the standard ladder — the honest default 1:N. */
  autoDenom: SheetScaleDenom;
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
 * Position the title boundary in the drawable A3/A4 plot at a TRUE 1:N.
 *
 * Critical:
 * - Zoom derives from `trueZoomForDenom` (calibration), never from fit —
 *   the old fit-then-relabel path printed "1:100" on drawings that were
 *   nothing of the sort (A4 especially). `autoDenom` is returned so the
 *   caller can seed an honest default that actually fits the plot.
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
  /** Paper format + sheet frame width px — the print-scale calibration. */
  paper: PaperSize;
  sheetW: number;
  scaleDenom: number;
  /** Padding fraction of the plot used by the lot (room for outside dims). */
  pad?: number;
}): SheetContentView {
  const {
    boundary,
    building,
    scaleM = 110,
    boardW,
    boardH,
    plot,
    paper,
    sheetW,
    scaleDenom,
    pad = 0.8,
  } = args;

  const bw = Math.max(1, boardW);
  const bh = Math.max(1, boardH);
  const plotCx = ((plot.boxLeft + plot.boxW / 2) / bw) * 100;
  const plotCy = ((plot.boxTop + plot.boxH / 2) / bh) * 100;

  // Title boundary is what must sit on the working drawing. Fall back to the
  // building envelope only when the lot ring is missing.
  const lot =
    bboxOf(boundary) ??
    bboxOf(building) ??
    null;

  const denom = Math.max(1, scaleDenom);
  const mmPerPx = sheetMmPerPx(paper, sheetW);
  /** Board px → metres is isotropic (scaleM spans boardW px in both axes). */
  const mPerPx = scaleM / bw;
  const zoom = Number(
    Math.max(
      0.05,
      Math.min(64, trueZoomForDenom({ scaleM, boardW: bw, mmPerPx, denom })),
    ).toFixed(4),
  );

  if (!lot || plot.boxW < 8 || plot.boxH < 8) {
    return {
      focusX: Number(plotCx.toFixed(2)),
      focusY: Number(plotCy.toFixed(2)),
      zoom,
      panX: 0,
      panY: 0,
      rawDenom: denom,
      autoDenom: snapDenomUp(denom),
    };
  }

  // Exact denominator at which the lot spans `pad` of the plot (both axes).
  const spanXm = (lot.spanX / 100) * bw * mPerPx;
  const spanYm = (lot.spanY / 100) * bh * mPerPx;
  const denomX = (spanXm * 1000) / (plot.boxW * pad * mmPerPx);
  const denomY = (spanYm * 1000) / (plot.boxH * pad * mmPerPx);
  const rawDenom = Number(Math.max(denomX, denomY, 1).toFixed(2));
  const autoDenom = snapDenomUp(rawDenom);

  // After scale-around-lot-centre, translate so the lot centre lands on plot centre.
  const panX = Number((((plotCx - lot.midX) / 100) * bw).toFixed(2));
  const panY = Number((((plotCy - lot.midY) / 100) * bh).toFixed(2));

  return {
    focusX: Number(lot.midX.toFixed(2)),
    focusY: Number(lot.midY.toFixed(2)),
    zoom,
    panX,
    panY,
    rawDenom,
    autoDenom,
  };
}
