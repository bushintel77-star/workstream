/**
 * Single source of truth for ruler stationing (spec §8 / 2.1).
 *
 * Chainage is metres along the board edge (0..scaleM). The minor interval
 * snaps to a 1/2/5×10^n ladder so tick labels read cleanly for any board
 * width. Every consumer (the ruler, and in future the crosshair/snap markers)
 * derives from `buildStationTicks` — there is no second implementation of the
 * ruler math.
 */

export interface StationTick {
  /** Board position, 0..100. */
  pct: number;
  /** Chainage in metres along the edge. */
  metres: number;
  /** Full-band tick (gets a label); false = minor band tick. */
  major: boolean;
  /** Metre label (rendered for major ticks only). */
  label: string;
}

export function stationAtPct(pct: number, scaleM: number): number {
  return (pct / 100) * scaleM;
}

/** Snap a target interval to the nearest 1/2/5×10^n ladder step. */
export function niceStep(target: number): number {
  if (target <= 0) return 1;
  const exp = Math.floor(Math.log10(target));
  const base = Math.pow(10, exp);
  const m = target / base;
  let best = 10;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const f of [1, 2, 5, 10]) {
    const d = Math.abs(f - m);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best * base;
}

export function formatMetres(m: number): string {
  return Math.abs(m - Math.round(m)) < 0.05 ? `${Math.round(m)}` : m.toFixed(1);
}

/** Default working-drawing grid snap (spec 2.7): 1.0 m, origin-aligned. */
export const DEFAULT_STATIONING_STEP_M = 1.0;

/** Snap a world point to the origin-aligned stationing lattice (both axes). */
export function snapToStationingGrid(
  x: number,
  z: number,
  stepM: number = DEFAULT_STATIONING_STEP_M,
): { x: number; z: number } {
  return {
    x: Math.round(x / stepM) * stepM,
    z: Math.round(z / stepM) * stepM,
  };
}

export function buildStationTicks(scaleM: number): StationTick[] {
  const minorM = niceStep(scaleM / 5);
  const ticks: StationTick[] = [];
  for (let m = 0; m <= scaleM + 1e-6; m += minorM) {
    const major =
      Math.abs(m) < 1e-6 ||
      m >= scaleM - 1e-6 ||
      Math.round(m / minorM) % 5 === 0;
    ticks.push({
      pct: (m / scaleM) * 100,
      metres: m,
      major,
      label: formatMetres(m),
    });
  }
  return ticks;
}
