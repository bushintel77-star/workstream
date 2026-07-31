import type { PctPoint } from "./types";

/**
 * CAD street-context neighbour lots for Stage 1 foundation board only
 * (`foundationCleanse`). Indicative fabric — not Vicmap neighbours. Stroke
 * outlines only in the plan (no fill) so locked-title Sketch/CAD never grows
 * a dark skin beside the lot.
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

  return lots.filter((ring) => {
    if (!ring.every((p) => p.x >= -5 && p.x <= 105 && p.y >= -5 && p.y <= 105)) {
      return false;
    }
    /* Reject collapsed verge bands (clamp-to-0 turns a band into a line /
       zero-area poly — same unclipped-fill family as board-spanning washes). */
    const xs = ring.map((p) => p.x);
    const ys = ring.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    return w >= 0.5 && h >= 0.5;
  });
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

/**
 * Board bearing from edge (y-down canvas). Returns quadrant string e.g. N12°E.
 * Indicative Workflow 1 — not survey grid bearing.
 */
export function formatCadBearing(rotDeg: number): string {
  // rotDeg is atan2(dy, dx) with y-down; convert to compass-ish from +x east
  let deg = ((90 - rotDeg) % 360 + 360) % 360;
  const card = ["N", "E", "S", "W"] as const;
  const sector = Math.floor(((deg + 45) % 360) / 90);
  const primary = card[sector]!;
  const next = card[(sector + 1) % 4]!;
  const within = ((deg + 45) % 90) - 45;
  if (Math.abs(within) < 2) return primary;
  const abs = Math.abs(Math.round(within));
  if (within >= 0) return `${primary}${abs}°${next}`;
  return `${next}${abs}°${primary}`;
}
