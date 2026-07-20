import { edgeLengthM } from "./polygon";
import type { PctPoint } from "./types";

/** Live rubber-band readout while tracing or measuring. */
export function formatSegmentTip(
  from: PctPoint,
  to: PctPoint,
  scaleM: number,
  boardAspect = 1,
): { text: string; lengthM: number; angleDeg: number } {
  const lengthM = edgeLengthM(from, to, scaleM, boardAspect);
  const angleDeg =
    (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  let rot = angleDeg;
  if (rot > 90) rot -= 180;
  if (rot < -90) rot += 180;
  const bearing = ((angleDeg % 360) + 360) % 360;
  return {
    lengthM,
    angleDeg: bearing,
    text: `${lengthM.toFixed(2)} m · ${bearing.toFixed(0)}°`,
  };
}

export function deleteVertex(
  pts: PctPoint[],
  index: number,
): PctPoint[] | null {
  if (pts.length <= 3) return null;
  if (index < 0 || index >= pts.length) return pts;
  return pts.filter((_, i) => i !== index);
}

export function insertVertexAfter(
  pts: PctPoint[],
  after: number,
  point?: PctPoint,
): PctPoint[] {
  if (pts.length < 2) return pts;
  const a = pts[after]!;
  const b = pts[(after + 1) % pts.length]!;
  const mid = point ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return [...pts.slice(0, after + 1), mid, ...pts.slice(after + 1)];
}

/** Replace a vertex, returning a new array (immutable). */
export function replaceVertex(
  pts: PctPoint[],
  index: number,
  point: PctPoint,
): PctPoint[] {
  if (index < 0 || index >= pts.length) return pts;
  return pts.map((p, i) => (i === index ? { ...point } : p));
}
