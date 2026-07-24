/**
 * Timed plan-space sun cast — Workflow 1 indicative shadows in board %.
 * Not EnergyPlus / neighbour solar rights.
 */

export type PctXY = { x: number; y: number };

function openRing(ring: PctXY[]): PctXY[] {
  if (ring.length < 2) return ring;
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (a.x === b.x && a.y === b.y) return ring.slice(0, -1);
  return ring;
}

function closeRing(ring: PctXY[]): PctXY[] {
  const open = openRing(ring);
  if (open.length < 3) return open;
  return [...open, open[0]!];
}

/**
 * Ground shadow length (m) for a vertical of heightM at solar altitude.
 * Returns 0 when sun is below / near horizon or length is absurd.
 */
export function shadowLengthMetres(
  heightM: number,
  altitudeDeg: number,
  maxLenM = 80,
): number {
  if (!(heightM > 0) || !(altitudeDeg > 2.5)) return 0;
  const altRad = (altitudeDeg * Math.PI) / 180;
  const len = heightM / Math.tan(altRad);
  if (!Number.isFinite(len) || len <= 0 || len > maxLenM) return 0;
  return len;
}

/**
 * Shadow fall offset in board % (x east, y south).
 * Azimuth: 0° = north, 90° = east (same as sunPositionAt).
 * Shadow falls opposite the sun.
 */
export function shadowOffsetPct(
  lengthM: number,
  azimuthDeg: number,
  boardWidthM: number,
): { dx: number; dy: number } {
  if (!(lengthM > 0) || !(boardWidthM > 0)) return { dx: 0, dy: 0 };
  const lenPct = (lengthM / boardWidthM) * 100;
  const rad = (azimuthDeg * Math.PI) / 180;
  // Opposite sun: marker uses +sin/−cos toward sun → shadow −sin/+cos.
  return {
    dx: -Math.sin(rad) * lenPct,
    dy: Math.cos(rad) * lenPct,
  };
}

/**
 * Extruded silhouette of a footprint ring under the current sun.
 * Returns a closed % polygon or null when cast is off.
 */
export function castRingShadowPct(
  ring: PctXY[],
  heightM: number,
  altitudeDeg: number,
  azimuthDeg: number,
  boardWidthM: number,
): PctXY[] | null {
  const open = openRing(ring);
  if (open.length < 3) return null;
  const lenM = shadowLengthMetres(heightM, altitudeDeg);
  if (lenM <= 0) return null;
  const { dx, dy } = shadowOffsetPct(lenM, azimuthDeg, boardWidthM);
  if (dx === 0 && dy === 0) return null;
  const tip = open.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return closeRing([...open, ...tip.slice().reverse()]);
}

/** Circular canopy approx → square footprint for cast (glyph centre + radius %). */
export function canopyFootprintPct(
  cx: number,
  cy: number,
  radiusPct: number,
  sides = 8,
): PctXY[] {
  const r = Math.max(0.4, radiusPct);
  const pts: PctXY[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export type GrowthStageCast = "plant" | "5yr" | "mature";

export function growthHeightFactor(growth: GrowthStageCast): number {
  if (growth === "plant") return 0.45;
  if (growth === "5yr") return 0.75;
  return 1;
}
