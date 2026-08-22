import { toBoardPctPoint } from "./boardPct";
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
    (Math.atan2((to.y - from.y) / boardAspect, to.x - from.x) * 180) /
    Math.PI;
  const bearing = ((angleDeg % 360) + 360) % 360;
  return {
    lengthM,
    angleDeg: bearing,
    text: `${lengthM.toFixed(2)} m · ${bearing.toFixed(0)}°`,
  };
}

/** Resolve a typed metre length / bearing back into calibrated board space. */
export function pointFromSegmentInput(
  from: PctPoint,
  pointer: PctPoint,
  scaleM: number,
  boardAspect: number,
  lengthM?: number | null,
  angleDeg?: number | null,
): PctPoint {
  const live = formatSegmentTip(from, pointer, scaleM, boardAspect);
  const length =
    lengthM != null && Number.isFinite(lengthM) && lengthM > 0
      ? lengthM
      : live.lengthM;
  const bearing =
    angleDeg != null && Number.isFinite(angleDeg) ? angleDeg : live.angleDeg;
  const radians = (bearing * Math.PI) / 180;
  return toBoardPctPoint({
    x: from.x + ((length * Math.cos(radians)) / scaleM) * 100,
    y: from.y + ((length * Math.sin(radians)) / (scaleM / boardAspect)) * 100,
  });
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

/** Project a pointer onto an edge using screen-space geometry. */
export function projectPointOnSegment(
  point: PctPoint,
  a: PctPoint,
  b: PctPoint,
  boardW: number,
  boardH: number,
): PctPoint {
  const px = (point.x / 100) * boardW;
  const py = (point.y / 100) * boardH;
  const ax = (a.x / 100) * boardW;
  const ay = (a.y / 100) * boardH;
  const bx = (b.x / 100) * boardW;
  const by = (b.y / 100) * boardH;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-8) return { ...a };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return {
    x: ((ax + t * dx) / boardW) * 100,
    y: ((ay + t * dy) / boardH) * 100,
  };
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
