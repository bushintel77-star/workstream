import { sunPositionAt } from "./site-environment";

export type ShadeGridCell = {
  col: number;
  row: number;
  sunHours: number;
};

const GRID = 8;

/** Coarse indicative sun-hours grid from solar position (Phase 1 — not EnergyPlus). */
export function buildIndicativeShadeGrid(
  lat: number,
  lng: number,
  when: Date,
): ShadeGridCell[] {
  const sun = sunPositionAt(lat, lng, when);
  const cells: ShadeGridCell[] = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const northBias = (GRID - row) / GRID;
      const eastBias = col / GRID;
      const base =
        Math.max(0, sun.altitude_deg) / 90 +
        northBias * 0.25 +
        eastBias * 0.1;
      const sunHours = Math.min(12, Math.max(0, base * 10));
      cells.push({ col, row, sunHours });
    }
  }
  return cells;
}

export const SHADE_GRID_SIZE = GRID;
