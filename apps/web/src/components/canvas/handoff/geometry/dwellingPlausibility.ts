import { polygonAreaPct2 } from "./polygon";
import { MAX_FOOTPRINT_COVERAGE_FRAC } from "./siteScheduleDisplay";
import type { PctPoint } from "./types";

/**
 * Board-% coverage of dwelling vs title. Scale-invariant (same ratio as m²).
 * Vicmap INTERSECTS can attach a neighbour / complex that is larger than the
 * lot — metrics already clamp that case; geometry must reject it too.
 */
export function dwellingCoverageFrac(
  boundary: PctPoint[],
  building: PctPoint[],
): number {
  if (boundary.length < 3 || building.length < 3) return 0;
  const lot = polygonAreaPct2(boundary);
  if (lot <= 1e-9) return 0;
  return polygonAreaPct2(building) / lot;
}

/** True when the dwelling ring is empty or a plausible fraction of the lot. */
export function isDwellingPlausibleOnLot(
  boundary: PctPoint[],
  building: PctPoint[],
  maxFrac = MAX_FOOTPRINT_COVERAGE_FRAC,
): boolean {
  if (building.length < 3) return true;
  return dwellingCoverageFrac(boundary, building) <= maxFrac + 0.01;
}

/**
 * Drop absurd dwelling rings so CAD / tilt never extrude a massing larger
 * than the title. Returns the same ring when plausible.
 */
export function rejectOversizedDwelling(
  boundary: PctPoint[],
  building: PctPoint[],
  maxFrac = MAX_FOOTPRINT_COVERAGE_FRAC,
): PctPoint[] {
  if (isDwellingPlausibleOnLot(boundary, building, maxFrac)) return building;
  return [];
}
