import type { PaperSize, SheetBox } from "./types";

/**
 * Fit a landscape A3 (420×297) or portrait A4 (210×297) sheet into the board,
 * centred with 24 px padding each side — same aspect rules as the handoff.
 */
export function sheetBoxFor(
  boardW: number,
  boardH: number,
  paper: PaperSize,
): SheetBox {
  const aspect = paper === "a4" ? 210 / 297 : 420 / 297;
  const availW = Math.max(80, boardW - 48);
  const availH = Math.max(80, boardH - 48);
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

/** ISO paper aspect for CSS `aspect-ratio` when rendering a fixed sheet card. */
export function paperAspect(paper: PaperSize): number {
  return paper === "a4" ? 210 / 297 : 420 / 297;
}
