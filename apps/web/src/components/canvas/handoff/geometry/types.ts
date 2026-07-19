export type PctPoint = { x: number; y: number };

export type PaperSize = "a3" | "a4";

export type SheetBox = {
  boxW: number;
  boxH: number;
  boxLeft: number;
  boxTop: number;
};

export type EdgeSegment = {
  /** B1… or F1… */
  key: string;
  lengthM: number;
  mid: PctPoint;
  /** Label rotation degrees for plan dim text */
  rotDeg: number;
  a: PctPoint;
  b: PctPoint;
};

export type SiteSchedule = {
  lotAreaM2: number;
  buildingAreaM2: number;
  outdoorAreaM2: number;
  siteCoveragePct: number;
  boundaryPerimeterM: number;
};
