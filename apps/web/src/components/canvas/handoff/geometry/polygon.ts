import { workableCanvasM2 } from "@workstream/domain";
import type { EdgeSegment, PctPoint, SiteSchedule } from "./types";

/** Shoelace area in percent-space squared (not metres). */
export function polygonAreaPct2(pts: PctPoint[]): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeterPct(pts: PctPoint[]): number {
  if (pts.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/**
 * Convert % board deltas to metres using a site scale:
 * `scaleM` = metres represented by 100% of the shorter board axis
 * (handoff uses ~110 m across the full board width for Wrights).
 */
export function pctToMetres(
  dxPct: number,
  dyPct: number,
  scaleM: number,
  boardAspect = 1,
): number {
  const mx = (dxPct / 100) * scaleM;
  const my = (dyPct / 100) * (scaleM / boardAspect);
  return Math.hypot(mx, my);
}

export function edgeLengthM(
  a: PctPoint,
  b: PctPoint,
  scaleM: number,
  boardAspect = 1,
): number {
  return pctToMetres(b.x - a.x, b.y - a.y, scaleM, boardAspect);
}

export function polygonAreaM2(
  pts: PctPoint[],
  scaleM: number,
  boardAspect = 1,
): number {
  // Scale %² → m²: area_pct2 * (scaleM/100)^2 / boardAspect
  const aPct2 = polygonAreaPct2(pts);
  return aPct2 * (scaleM / 100) ** 2 / boardAspect;
}

export function polygonPerimeterM(
  pts: PctPoint[],
  scaleM: number,
  boardAspect = 1,
): number {
  if (pts.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    sum += edgeLengthM(pts[i]!, pts[(i + 1) % pts.length]!, scaleM, boardAspect);
  }
  return sum;
}

/** Map board-% vertices into planar metres for Turf boolean ops. */
export function pctRingToPlanarM(
  pts: PctPoint[],
  scaleM: number,
  boardAspect = 1,
): [number, number][] {
  return pts.map((p) => [
    (p.x / 100) * scaleM,
    (p.y / 100) * (scaleM / boardAspect),
  ]);
}

/**
 * Site schedule via Turf boolean difference in local metres.
 * Outdoor / workable = lot − building − optional exclude rings
 * (easements, closed service corridors, accepted hardscape footprints).
 */
export function buildSiteSchedule(
  boundary: PctPoint[],
  building: PctPoint[],
  scaleM: number,
  boardAspect = 1,
  excludeRings: PctPoint[][] = [],
): SiteSchedule {
  const lotAreaM2 = polygonAreaM2(boundary, scaleM, boardAspect);
  const buildingAreaM2 = polygonAreaM2(building, scaleM, boardAspect);
  const outdoorNaiveM2 = Math.max(0, lotAreaM2 - buildingAreaM2);

  const buildings =
    building.length >= 3
      ? [pctRingToPlanarM(building, scaleM, boardAspect)]
      : [];
  const exclude = excludeRings
    .filter((r) => r.length >= 3)
    .map((r) => pctRingToPlanarM(r, scaleM, boardAspect));
  const diff = workableCanvasM2(
    pctRingToPlanarM(boundary, scaleM, boardAspect),
    { buildings, exclude },
  );
  const outdoorAreaM2 =
    boundary.length >= 3 ? Math.max(0, diff.areaM2) : outdoorNaiveM2;

  const siteCoveragePct =
    lotAreaM2 > 0 ? Math.round((buildingAreaM2 / lotAreaM2) * 100) : 0;
  return {
    lotAreaM2,
    buildingAreaM2,
    outdoorAreaM2,
    outdoorNaiveM2,
    outdoorDiffersFromNaive: diff.differsFromNaive,
    siteCoveragePct,
    boundaryPerimeterM: polygonPerimeterM(boundary, scaleM, boardAspect),
  };
}

/** Closed rings only — open service polylines are ignored for boolean subtract. */
export function closedExcludeRings(rings: PctPoint[][]): PctPoint[][] {
  return rings.filter((r) => r.length >= 3);
}

/** Labelled edge table B1… / F1… for the Fit sheet dim panel. */
export function edgeSegments(
  pts: PctPoint[],
  prefix: "B" | "F",
  scaleM: number,
  boardAspect = 1,
): EdgeSegment[] {
  if (pts.length < 2) return [];
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const rotDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      key: `${prefix}${i + 1}`,
      lengthM: edgeLengthM(a, b, scaleM, boardAspect),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      rotDeg,
      a,
      b,
    };
  });
}

/**
 * AS 4970 indicative TPZ radius in metres from DBH (m): R = 12 × DBH, min 2 m.
 * Return radius as % of board width for ellipse rx (ry adjusted by aspect).
 */
export function tpzRadiusPct(
  dbhM: number,
  scaleM: number,
): { rxPct: number; radiusM: number } {
  const radiusM = Math.max(2, 12 * dbhM);
  return {
    radiusM,
    rxPct: (radiusM / scaleM) * 100,
  };
}

export function ptsAttr(pts: PctPoint[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

/** Point-in-polygon (ray cast) for easement / conflict checks. */
export function pointInPolygon(p: PctPoint, poly: PctPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
