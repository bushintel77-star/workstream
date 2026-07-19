import type { PctPoint } from "./types";

/**
 * CAD street-context neighbour lots for Stage 1 foundation board.
 * Indicative fabric only — not Vicmap neighbours. Inspired by REA property-
 * boundary concept, drawn as charcoal drafting lines (never purple map chrome).
 */
export function neighbourLotContext(boundary: PctPoint[]): PctPoint[][] {
  if (boundary.length < 3) return [];
  const xs = boundary.map((p) => p.x);
  const ys = boundary.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(2, maxX - minX);
  const h = Math.max(2, maxY - minY);
  const streetAlongX = w < h * 0.85;

  const lots: PctPoint[][] = [];
  if (streetAlongX) {
    // Terrace lots along X — left/right of title
    for (const side of [-1, 1] as const) {
      for (let i = 1; i <= 3; i++) {
        const ox = side * (w + 1.2) * i;
        lots.push([
          { x: minX + ox, y: minY },
          { x: maxX + ox, y: minY },
          { x: maxX + ox, y: maxY },
          { x: minX + ox, y: maxY },
        ]);
      }
    }
  } else {
    for (const side of [-1, 1] as const) {
      for (let i = 1; i <= 3; i++) {
        const oy = side * (h + 1.2) * i;
        lots.push([
          { x: minX, y: minY + oy },
          { x: maxX, y: minY + oy },
          { x: maxX, y: maxY + oy },
          { x: minX, y: maxY + oy },
        ]);
      }
    }
  }

  // Road verge band (street edge)
  if (streetAlongX) {
    lots.push([
      { x: Math.max(0, minX - w * 3.5), y: Math.max(0, minY - h * 0.55) },
      { x: Math.min(100, maxX + w * 3.5), y: Math.max(0, minY - h * 0.55) },
      { x: Math.min(100, maxX + w * 3.5), y: Math.max(0, minY - h * 0.12) },
      { x: Math.max(0, minX - w * 3.5), y: Math.max(0, minY - h * 0.12) },
    ]);
  } else {
    lots.push([
      { x: Math.max(0, minX - w * 0.55), y: Math.max(0, minY - h * 3.5) },
      { x: Math.max(0, minX - w * 0.12), y: Math.max(0, minY - h * 3.5) },
      { x: Math.max(0, minX - w * 0.12), y: Math.min(100, maxY + h * 3.5) },
      { x: Math.max(0, minX - w * 0.55), y: Math.min(100, maxY + h * 3.5) },
    ]);
  }

  return lots.filter((ring) =>
    ring.every((p) => p.x >= -5 && p.x <= 105 && p.y >= -5 && p.y <= 105),
  );
}

export function polygonCentroid(pts: PctPoint[]): PctPoint {
  if (pts.length === 0) return { x: 50, y: 50 };
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/** Format metres for CAD title dims — millimetre truth. */
export function formatCadMetres(m: number): string {
  return `${m.toFixed(3)} m`;
}

export function formatCadAreaM2(m2: number): string {
  if (m2 >= 100) return `${m2.toFixed(0)} m²`;
  return `${m2.toFixed(1)} m²`;
}
