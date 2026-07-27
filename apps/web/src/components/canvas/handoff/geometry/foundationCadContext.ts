import type { PctPoint } from "./types";

/** CAD title / dim helpers for the foundation board (Workflow 1, %-coords). */

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
