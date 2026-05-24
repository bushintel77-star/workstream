import type { CanvasPointPct } from "@workstream/contracts";

/** Ground metres per canvas pixel — from static aerial span. */
export type CanvasGroundScale = {
  metresPerXPx: number;
  metresPerYPx: number;
  canvasWidthPx: number;
  canvasHeightPx: number;
};

export function pctToGroundMeters(
  p: CanvasPointPct,
  scale: CanvasGroundScale,
): { x: number; y: number } {
  return {
    x: (p.x_pct / 100) * scale.canvasWidthPx * scale.metresPerXPx,
    y: (p.y_pct / 100) * scale.canvasHeightPx * scale.metresPerYPx,
  };
}

export function groundMetersToPct(
  x: number,
  y: number,
  scale: CanvasGroundScale,
): CanvasPointPct {
  return {
    x_pct: (x / (scale.canvasWidthPx * scale.metresPerXPx)) * 100,
    y_pct: (y / (scale.canvasHeightPx * scale.metresPerYPx)) * 100,
  };
}

/** Shoelace area in m² for a closed polygon on the canvas. */
export function polygonAreaFromCanvasPercent(
  points: CanvasPointPct[],
  scale: CanvasGroundScale,
): number {
  if (points.length < 3) return 0;
  const projected = points.map((p) => pctToGroundMeters(p, scale));
  let sum = 0;
  const n = projected.length;
  for (let i = 0; i < n; i++) {
    const a = projected[i]!;
    const b = projected[(i + 1) % n]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Open polyline length in metres. */
export function polylineLengthFromCanvasPercent(
  points: CanvasPointPct[],
  scale: CanvasGroundScale,
): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = pctToGroundMeters(points[i - 1]!, scale);
    const b = pctToGroundMeters(points[i]!, scale);
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Ray-casting point-in-polygon in ground metres. */
export function pointInPolygonGround(
  x: number,
  y: number,
  polygon: CanvasPointPct[],
  scale: CanvasGroundScale,
): boolean {
  const pts = polygon.map((p) => pctToGroundMeters(p, scale));
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]!.x;
    const yi = pts[i]!.y;
    const xj = pts[j]!.x;
    const yj = pts[j]!.y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
