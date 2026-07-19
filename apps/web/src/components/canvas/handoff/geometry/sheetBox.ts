import type { PaperSize, SheetBox } from "./types";

/** Outer board → paper padding (tighter — less dead margin around the sheet). */
export const SHEET_OUTER_PAD = 20;
/** Inner printable margin inside the paper frame. */
export const SHEET_INNER_MARGIN = 8;
/** Gap between plot and title/elevation panels. */
export const SHEET_PANEL_GAP = 12;
/** Max schedule column width on wide A3 sheets. */
export const TITLE_PANEL_MAX = 240;

/**
 * Fit a landscape A3 (420×297) or portrait A4 (210×297) sheet into the board,
 * centred with equal outer padding.
 */
export function sheetBoxFor(
  boardW: number,
  boardH: number,
  paper: PaperSize,
): SheetBox {
  const aspect = paper === "a4" ? 210 / 297 : 420 / 297;
  const availW = Math.max(80, boardW - SHEET_OUTER_PAD);
  const availH = Math.max(80, boardH - SHEET_OUTER_PAD);
  let boxW: number;
  let boxH: number;
  if (availW / availH > aspect) {
    boxH = availH;
    boxW = boxH * aspect;
  } else {
    boxW = availW;
    boxH = boxW / aspect;
  }
  return {
    boxW,
    boxH,
    boxLeft: (boardW - boxW) / 2,
    boxTop: (boardH - boxH) / 2,
  };
}

/**
 * Responsive schedule column — always present when the sheet is wide enough.
 * A4 no longer drops the title block at the old 420 px hard cut-off.
 */
export function titlePanelWidth(boxW: number): number {
  if (boxW < 260) return 0;
  if (boxW >= 720) return TITLE_PANEL_MAX;
  if (boxW >= 520) return 220;
  return Math.round(Math.min(200, Math.max(148, boxW * 0.42)));
}

export type PlotBoxOpts = {
  titleW?: number;
  elevH?: number;
  margin?: number;
};

/**
 * Drawable plot rect inside the paper — reserves title column + elevations
 * so CAD vectors never sit under opaque schedule chrome.
 */
export function plotBoxFor(sheet: SheetBox, opts: PlotBoxOpts = {}): SheetBox {
  const margin = opts.margin ?? SHEET_INNER_MARGIN;
  const titleW = opts.titleW ?? 0;
  const elevH = opts.elevH ?? 0;
  const gapR = titleW > 0 ? SHEET_PANEL_GAP : 0;
  const gapB = elevH > 0 ? SHEET_PANEL_GAP : 0;
  const left = sheet.boxLeft + margin;
  const top = sheet.boxTop + margin;
  const right =
    sheet.boxLeft + sheet.boxW - margin - (titleW > 0 ? titleW + gapR : 0);
  const bottom =
    sheet.boxTop + sheet.boxH - margin - (elevH > 0 ? elevH + gapB : 0);
  return {
    boxLeft: left,
    boxTop: top,
    boxW: Math.max(48, right - left),
    boxH: Math.max(48, bottom - top),
  };
}

/** ISO paper aspect for CSS `aspect-ratio` when rendering a fixed sheet card. */
export function paperAspect(paper: PaperSize): number {
  return paper === "a4" ? 210 / 297 : 420 / 297;
}
