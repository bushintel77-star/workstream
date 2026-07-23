import type { PctPoint } from "./types";

export type CanvasMetresFit = {
  points: PctPoint[];
  /**
   * Metres represented by 100% board width, implied by the letterbox fit
   * (the same isotropic scale is used on both axes). Feeding this into
   * `ui.boardWidthM` makes areas / dims / estimates read true parcel metres
   * instead of the 110 m default. Null when the ring is degenerate.
   */
  boardWidthM: number | null;
};

/**
 * Fit a canvas-metre ring (Vicmap / SiteBoundary vertices) into handoff `%`
 * board space and report the implied board scale.
 * Y is flipped (canvas metres often increase north; board y increases down).
 */
export function fitCanvasMetresRing(
  verts: Array<{ x: number; y: number }>,
  padPct = 8,
): CanvasMetresFit {
  if (verts.length < 3) return { points: [], boardWidthM: null };
  const xs = verts.map((v) => v.x);
  const ys = verts.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  const avail = 100 - 2 * padPct;
  // % per metre — isotropic, so the whole board spans 100/scale metres.
  const scale = Math.min(avail / w, avail / h);
  const points = verts.map((v) => ({
    x: (100 - w * scale) / 2 + (v.x - minX) * scale,
    y: (100 - h * scale) / 2 + (maxY - v.y) * scale,
  }));
  const boardWidthM = Number.isFinite(scale) && scale > 0 ? 100 / scale : null;
  return { points, boardWidthM };
}

/** Points-only convenience over `fitCanvasMetresRing`. */
export function canvasMetresRingToPct(
  verts: Array<{ x: number; y: number }>,
  padPct = 8,
): PctPoint[] {
  return fitCanvasMetresRing(verts, padPct).points;
}
