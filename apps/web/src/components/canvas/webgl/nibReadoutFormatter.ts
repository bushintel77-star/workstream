/**
 * Nib readout formatter — lightweight string interpolation for the
 * cursor-adjacent live readout.
 *
 * Runs immediately before the DOM mutation (`ref.current.textContent = ...`)
 * to keep the main thread unblocked. No React state, no re-renders.
 *
 * Format: `TOOL · E {x} · N {z} · Z {label} · STA {chainage} · {grade}p · {angle}°`
 * Only includes fields that have values — absent fields are omitted.
 */

import type { ToolId } from "./studioStore";

const TOOL_LABELS: Partial<Record<ToolId, string>> = {
  pen: "PEN",
  line: "LINE",
  spline: "SPLINE",
  straightedge: "RULE",
  contour: "CONTOUR",
  slope: "SLOPE",
  cutfill: "CUT/FILL",
  tree: "TREE",
  bed: "BED",
  mass: "MASS",
  path: "PATH",
  dim: "DIM",
  section: "SECTION",
  layers: "LAYERS",
  history: "HISTORY",
};

export interface NibReadoutData {
  tool: ToolId;
  x: number;
  z: number;
  chainage?: number;
  /** Straightedge channel — metres along the placed ruler edge (or of the
   *  edge being dragged). Appended as `RULER {m} m`. */
  rulerM?: number;
  zLabel: string;
  /** Grade percentage between origin and current point (rise/run × 100). */
  gradePct?: number;
  /** Vector bearing from origin to current point, degrees clockwise from north. */
  bearingDeg?: number;
}

export function formatNibReadout(data: NibReadoutData): string {
  const parts: string[] = [];
  const toolLabel = TOOL_LABELS[data.tool] ?? data.tool.toUpperCase();
  parts.push(toolLabel);
  parts.push(`E ${data.x.toFixed(1)}`);
  parts.push(`N ${data.z.toFixed(1)}`);
  parts.push(`Z ${data.zLabel}`);
  if (data.chainage !== undefined) {
    parts.push(`STA ${data.chainage.toFixed(1)}`);
  }
  if (data.rulerM !== undefined) {
    parts.push(`RULER ${data.rulerM.toFixed(1)} m`);
  }
  if (data.gradePct !== undefined && isFinite(data.gradePct)) {
    parts.push(`${data.gradePct.toFixed(2)}p`);
  }
  if (data.bearingDeg !== undefined && isFinite(data.bearingDeg)) {
    parts.push(`${Math.round(data.bearingDeg)}°`);
  }
  return parts.join(" · ");
}

/**
 * Compute grade percentage and bearing from an origin point to the current
 * nib position. Grade = rise/run × 100 (z-delta / horizontal-distance × 100).
 * Bearing = atan2(dx, dz) converted to degrees clockwise from north.
 *
 * Returns nulls if the horizontal distance is below epsilon (no direction).
 */
export function computeGradeAndBearing(
  originX: number,
  originZ: number,
  originY: number,
  currentX: number,
  currentZ: number,
  currentY: number,
): { gradePct: number; bearingDeg: number } | null {
  const dx = currentX - originX;
  const dz = currentZ - originZ;
  const dy = currentY - originY;
  const horizontal = Math.sqrt(dx * dx + dz * dz);
  if (horizontal < 0.01) return null;
  const gradePct = (dy / horizontal) * 100;
  // Bearing: 0° = north (+z), clockwise. atan2(east, north) = atan2(dx, dz)
  const bearingRad = Math.atan2(dx, dz);
  const bearingDeg = ((bearingRad * 180) / Math.PI + 360) % 360;
  return { gradePct, bearingDeg };
}
