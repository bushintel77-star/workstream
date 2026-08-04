/**
 * Contour-derived spot levels — interpolate elevation from Vicmap contour lines.
 *
 * Vicmap ships 1 m / 5 m / 10 m contour polylines as WFS features with an
 * elevation attribute. This module turns those lines into point elevations at
 * locations where the operator needs a spot level but has no survey figure.
 *
 * The interpolation is inverse-distance-weighted (IDW) over the nearest contour
 * vertices to the query point. It is indicative, not survey-grade: 1 m contour
 * data gives ±0.5–1 m typical accuracy, which is enough for preliminary grading
 * and drainage design but not for construction setout.
 *
 * Domain-pure: no server imports. Consumers feed it contour rings in board `%`
 * coords with elevations in metres AHD.
 */

export type ContourPoint = { x: number; y: number };

export type ContourLine = {
  /** Polyline vertices in board `%` coords. */
  points: ContourPoint[];
  /** Elevation in metres AHD. */
  elevationM: number;
};

export type DerivedLevel = {
  /** Interpolated elevation in metres AHD. */
  z_m: number;
  /**
   * Indicative accuracy in metres — half the contour interval when known,
   * otherwise a conservative 1 m. Surfaced on the plan so the operator
   * and client see the figure is indicative.
   */
  accuracy_m: number;
  /** Source label for provenance. */
  source: "vicmap_contour";
};

/**
 * Interpolate elevation at a query point from contour lines using IDW.
 *
 * Returns `null` when no contour vertices are within `maxDistPct` of the
 * query point — never a guess from distant data. The power parameter controls
 * how sharply influence falls off with distance; 2 is the standard IDW choice.
 *
 * @param contours  Contour lines in board `%` coords with elevations.
 * @param query     Point to interpolate at, in board `%` coords.
 * @param maxDistPct  Max search radius in board `%` units (default 15).
 * @param power     IDW power (default 2).
 */
export function interpolateContourLevel(
  contours: ContourLine[],
  query: ContourPoint,
  maxDistPct = 15,
  power = 2,
): DerivedLevel | null {
  if (contours.length === 0) return null;

  // Collect all contour vertices within range with their distances.
  const samples: { dist: number; elev: number }[] = [];
  let minInterval = Infinity;
  const elevations = new Set<number>();
  for (const line of contours) {
    elevations.add(line.elevationM);
    for (const p of line.points) {
      const dx = p.x - query.x;
      const dy = p.y - query.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= maxDistPct) {
        samples.push({ dist, elev: line.elevationM });
      }
    }
  }

  if (samples.length === 0) return null;

  // Estimate contour interval from the unique elevations.
  const sortedElev = [...elevations].sort((a, b) => a - b);
  for (let i = 1; i < sortedElev.length; i++) {
    const interval = sortedElev[i]! - sortedElev[i - 1]!;
    if (interval > 0 && interval < minInterval) minInterval = interval;
  }
  const accuracyM = minInterval !== Infinity ? minInterval / 2 : 1;

  // IDW: weight = 1 / dist^power. Zero-distance (query on a contour) → exact.
  let weightSum = 0;
  let elevSum = 0;
  for (const s of samples) {
    if (s.dist === 0) {
      return {
        z_m: s.elev,
        accuracy_m: accuracyM,
        source: "vicmap_contour",
      };
    }
    const w = 1 / Math.pow(s.dist, power);
    weightSum += w;
    elevSum += w * s.elev;
  }

  if (weightSum === 0) return null;

  return {
    z_m: Math.round((elevSum / weightSum) * 100) / 100,
    accuracy_m: Math.round(accuracyM * 100) / 100,
    source: "vicmap_contour",
  };
}

/**
 * Derive spot levels at boundary corners from contour lines.
 *
 * This is the typical use case: the operator has contour coverage but no
 * survey levels. We interpolate at each boundary corner to give a preliminary
 * grading picture. Existing authored levels are never overwritten — this
 * function only produces new levels at points where none exist.
 *
 * @param contours    Contour lines in board `%` coords.
 * @param boundary    Boundary ring in board `%` coords.
 * @param existing    Already-authored levels (to avoid duplicating).
 * @param maxDistPct  Max search radius.
 */
export function deriveCornerLevels(
  contours: ContourLine[],
  boundary: ContourPoint[],
  existing: Array<{ x_pct: number; y_pct: number; z_m: number }>,
  maxDistPct = 15,
): Array<{ x_pct: number; y_pct: number; z_m: number; source: "vicmap_contour"; accuracy_m: number }> {
  if (contours.length === 0 || boundary.length < 3) return [];
  const derived: Array<{
    x_pct: number;
    y_pct: number;
    z_m: number;
    source: "vicmap_contour";
    accuracy_m: number;
  }> = [];

  for (const corner of boundary) {
    // Skip if an authored level is within 2% of this corner.
    const hasAuthored = existing.some(
      (lv) => Math.hypot(lv.x_pct - corner.x, lv.y_pct - corner.y) < 2,
    );
    if (hasAuthored) continue;
    const result = interpolateContourLevel(contours, corner, maxDistPct);
    if (result) {
      derived.push({
        x_pct: corner.x,
        y_pct: corner.y,
        z_m: result.z_m,
        source: "vicmap_contour",
        accuracy_m: result.accuracy_m,
      });
    }
  }
  return derived;
}
