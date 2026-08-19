/**
 * Gold Standard 2026 — Sun-aware hatching (inverse sun angle snapping).
 *
 * The sketch palette's hatch fills snap their parallel lines to the site's
 * INVERSE sun angle — the bearing the sun's rays travel on the ground plane
 * (the shadow direction, azimuth + 180°). Because the studio's solar layer
 * (`sunPositionAt`, Melbourne convention: 0° = north, 90° = east) is the
 * single sun truth, hatching and shadow studies always agree.
 *
 * Angle conventions here: hatch line angles are measured in board-% space
 * from the +X board axis (east) toward the +Y board axis (screen-down,
 * south). A compass bearing B maps to θ = (90 − B) mod 180 — so a due-north
 * sun (azimuth 0, shadows falling due south) produces vertical hatch lines.
 *
 * Pure functions — unit-tested; no Three.js or React dependencies.
 */

import type { PctPoint } from "./coordTransform";

/**
 * The inverse sun angle (undirected line angle in board-% space) for a solar
 * azimuth. Solar azimuth 0° = north, 90° = east (sunPositionAt).
 *  - shadow bearing B = azimuth + 180
 *  - board angle θ = (90 − B) mod 180 = (−azimuth − 90) mod 180
 */
export function sunHatchAngleDeg(sunAzimuthDeg: number): number {
  return ((((-sunAzimuthDeg - 90) % 180) + 180) % 180 + 180) % 180;
}

/**
 * Snap a drawn/typed hatch angle to the inverse sun angle when it falls
 * within the tolerance window; otherwise pass the angle through untouched.
 */
export function snapHatchToSun(
  angleDeg: number,
  sunAzimuthDeg: number,
  tolDeg = 7.5,
): number {
  const target = sunHatchAngleDeg(sunAzimuthDeg);
  const delta = Math.abs(((angleDeg - target + 90) % 180 + 180) % 180 - 90);
  return delta <= tolDeg ? target : angleDeg;
}

/** A hatch line segment in board-% space. */
export interface HatchLine {
  a: PctPoint;
  b: PctPoint;
}

/** Default hatch spacing in board-% units (≈0.5% of the lot width). */
export const DEFAULT_HATCH_SPACING_PCT = 0.5;

/**
 * Generate parallel hatch lines clipped to a polygon (board-% space).
 * Works for concave polygons: every candidate line is intersected with all
 * polygon edges, the crossings are sorted along the line, and paired
 * even-odd (crossing 0→1, 2→3, …) to emit interior segments.
 */
export function hatchLinesForPolygon(
  points: readonly PctPoint[],
  angleDeg: number,
  spacingPct: number = DEFAULT_HATCH_SPACING_PCT,
): HatchLine[] {
  const n = points.length;
  if (n < 3 || spacingPct <= 0) return [];

  const rad = (angleDeg * Math.PI) / 180;
  const dX = Math.cos(rad);
  const dY = Math.sin(rad);
  const nX = -dY;
  const nY = dX;

  // Project every vertex onto the hatch normal to find the sweep range.
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const p of points) {
    const t = p.x * nX + p.y * nY;
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }

  const lines: HatchLine[] = [];
  // Half-spacing offset so the first/last lines sit inside the region.
  for (let t = tMin + spacingPct / 2; t <= tMax; t += spacingPct) {
    const crossings: Array<{ along: number; x: number; y: number }> = [];
    for (let i = 0; i < n; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % n]!;
      const denom = nX * (b.x - a.x) + nY * (b.y - a.y);
      if (Math.abs(denom) < 1e-9) continue; // edge parallel to the hatch
      const u = (t - (a.x * nX + a.y * nY)) / denom;
      if (u < 0 || u > 1) continue;
      const x = a.x + u * (b.x - a.x);
      const y = a.y + u * (b.y - a.y);
      crossings.push({ along: x * dX + y * dY, x, y });
    }
    crossings.sort((p, q) => p.along - q.along);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const p = crossings[k]!;
      const q = crossings[k + 1]!;
      lines.push({ a: { x: p.x, y: p.y }, b: { x: q.x, y: q.y } });
    }
  }
  return lines;
}

/** Is the stroke a closed ring (first point near the last, board-%)? */
export function isClosedRing(points: readonly PctPoint[], tolPct = 1.5): boolean {
  if (points.length < 4) return false;
  const a = points[0]!;
  const b = points[points.length - 1]!;
  return Math.hypot(b.x - a.x, b.y - a.y) <= tolPct;
}
