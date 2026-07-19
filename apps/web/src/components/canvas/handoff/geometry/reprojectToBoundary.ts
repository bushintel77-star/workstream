import type { PctPoint } from "./types";
import type { SketchStroke, StudioItem } from "../studioCatalog";

type RingBBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function ringBBox(ring: PctPoint[]): RingBBox | null {
  if (ring.length < 3) return null;
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * Map a point from the old title bbox into the new Vicmap/title bbox so
 * building + assets stay locked inside the parcel after cadastral snap.
 */
export function reprojectPointFromRing(
  p: PctPoint,
  from: PctPoint[],
  to: PctPoint[],
): PctPoint {
  const a = ringBBox(from);
  const b = ringBBox(to);
  if (!a || !b) return p;
  const aw = Math.max(1e-6, a.maxX - a.minX);
  const ah = Math.max(1e-6, a.maxY - a.minY);
  const bw = Math.max(1e-6, b.maxX - b.minX);
  const bh = Math.max(1e-6, b.maxY - b.minY);
  const nx = (p.x - a.minX) / aw;
  const ny = (p.y - a.minY) / ah;
  return {
    x: Math.max(0, Math.min(100, b.minX + nx * bw)),
    y: Math.max(0, Math.min(100, b.minY + ny * bh)),
  };
}

export function reprojectRingFromRing(
  ring: PctPoint[],
  from: PctPoint[],
  to: PctPoint[],
): PctPoint[] {
  return ring.map((p) => reprojectPointFromRing(p, from, to));
}

export type ReprojectableDoc = {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  strokes: SketchStroke[];
};

/**
 * After Vicmap title snap — rebind building, items, and strokes into the
 * new parcel frame so geometry does not float left of the lot.
 */
export function reprojectDocToBoundary(
  snap: ReprojectableDoc,
  nextBoundary: PctPoint[],
): ReprojectableDoc {
  if (nextBoundary.length < 3) {
    return { ...snap, boundary: nextBoundary };
  }
  const from = snap.boundary;
  if (from.length < 3) {
    return { ...snap, boundary: nextBoundary };
  }
  return {
    boundary: nextBoundary,
    building: reprojectRingFromRing(snap.building, from, nextBoundary),
    items: snap.items.map((it) => {
      const p = reprojectPointFromRing({ x: it.x, y: it.y }, from, nextBoundary);
      return { ...it, x: p.x, y: p.y };
    }),
    strokes: snap.strokes.map((s) => ({
      ...s,
      points: s.points.map((p) => reprojectPointFromRing(p, from, nextBoundary)),
    })),
  };
}
