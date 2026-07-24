import type { PctPoint } from "./types";
import { bufferPolylineToRing, clipPolylineToBbox } from "./bufferPolyline";

type MetreVert = { x: number; y: number };

/**
 * Letterbox transform that mapped a title ring into board `%`.
 * Apply the same transform to house / easement canvas-metre verts so they
 * co-register with the parcel instead of getting their own fit.
 */
export type CanvasMetresTransform = {
  minX: number;
  maxY: number;
  /** Percent of board per canvas metre (isotropic). */
  scale: number;
  w: number;
  h: number;
  padPct: number;
};

export type CanvasMetresFit = {
  points: PctPoint[];
  /**
   * Metres represented by 100% board width, implied by the letterbox fit
   * (the same isotropic scale is used on both axes). Feeding this into
   * `ui.boardWidthM` makes areas / dims / estimates read true parcel metres
   * instead of the 110 m default. Null when the ring is degenerate.
   */
  boardWidthM: number | null;
  /** Null when the ring is degenerate. */
  transform: CanvasMetresTransform | null;
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
  if (verts.length < 3) {
    return { points: [], boardWidthM: null, transform: null };
  }
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
  const transform: CanvasMetresTransform = {
    minX,
    maxY,
    scale,
    w,
    h,
    padPct,
  };
  const points = applyCanvasMetresTransform(verts, transform);
  const boardWidthM = Number.isFinite(scale) && scale > 0 ? 100 / scale : null;
  return { points, boardWidthM, transform };
}

/** Project canvas-metre verts with an existing title-fit transform. */
export function applyCanvasMetresTransform(
  verts: Array<{ x: number; y: number }>,
  t: CanvasMetresTransform,
): PctPoint[] {
  return verts.map((v) => ({
    x: (100 - t.w * t.scale) / 2 + (v.x - t.minX) * t.scale,
    y: (100 - t.h * t.scale) / 2 + (t.maxY - v.y) * t.scale,
  }));
}

/** Points-only convenience over `fitCanvasMetresRing`. */
export function canvasMetresRingToPct(
  verts: Array<{ x: number; y: number }>,
  padPct = 8,
): PctPoint[] {
  return fitCanvasMetresRing(verts, padPct).points;
}
