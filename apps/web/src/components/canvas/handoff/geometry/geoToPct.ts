import type { PctPoint } from "./types";
import { bufferPolylineToRing, clipPolylineToBbox } from "./bufferPolyline";

type MetreVert = { x: number; y: number };

/**
 * Fit transform from canvas-metre space into handoff `%` board space.
 * Derived from one ring (the title boundary) and shared by everything that
 * must land in the same frame (easements, service corridors).
 */
export type CanvasMetresFit = {
  minX: number;
  maxY: number;
  scale: number;
  ox: number;
  oy: number;
};

/** Compute the bbox-fit for a ring of canvas metres. Null when degenerate. */
export function canvasMetresFit(
  verts: MetreVert[],
  padPct = 8,
): CanvasMetresFit | null {
  if (verts.length < 3) return null;
  const xs = verts.map((v) => v.x);
  const ys = verts.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  const avail = 100 - 2 * padPct;
  const scale = Math.min(avail / w, avail / h);
  const usedW = w * scale;
  const usedH = h * scale;
  return {
    minX,
    maxY,
    scale,
    ox: (100 - usedW) / 2,
    oy: (100 - usedH) / 2,
  };
}

/** Project one canvas-metre point through a fit (Y flips to board-down). */
export function applyCanvasMetresFit(
  fit: CanvasMetresFit,
  v: MetreVert,
): PctPoint {
  return {
    x: fit.ox + (v.x - fit.minX) * fit.scale,
    y: fit.oy + (fit.maxY - v.y) * fit.scale,
  };
}

/**
 * Fit a canvas-metre ring (Vicmap / SiteBoundary vertices) into handoff `%` board space.
 * Y is flipped (canvas metres often increase north; board y increases down).
 */
export function canvasMetresRingToPct(
  verts: MetreVert[],
  padPct = 8,
): PctPoint[] {
  const fit = canvasMetresFit(verts, padPct);
  if (!fit) return [];
  return verts.map((v) => applyCanvasMetresFit(fit, v));
}

/** Half-width of the indicative easement corridor (0.9 m each side → 1.8 m). */
export const EASEMENT_HALF_WIDTH_M = 0.9;

/**
 * Project Vicmap easement centrelines into `%` board space using the
 * boundary's own fit transform, buffering each line into a thin corridor
 * ring so the CAD easement hatch can render it. Centrelines are clipped to
 * the lot frame first — WFS returns whole street-block lines.
 */
export function easementRingsToPct(
  boundaryVerts: MetreVert[],
  easements: Array<{ points: MetreVert[] }>,
  halfWidthM = EASEMENT_HALF_WIDTH_M,
  padPct = 8,
): PctPoint[][] {
  const fit = canvasMetresFit(boundaryVerts, padPct);
  if (!fit || easements.length === 0) return [];
  const xs = boundaryVerts.map((v) => v.x);
  const ys = boundaryVerts.map((v) => v.y);
  const margin = Math.max(2, halfWidthM * 2);
  const lotBox = {
    minX: Math.min(...xs) - margin,
    maxX: Math.max(...xs) + margin,
    minY: Math.min(...ys) - margin,
    maxY: Math.max(...ys) + margin,
  };
  const rings: PctPoint[][] = [];
  for (const easement of easements) {
    for (const run of clipPolylineToBbox(easement.points, lotBox)) {
      const ring = bufferPolylineToRing(run, halfWidthM);
      if (ring.length < 3) continue;
      rings.push(
        ring.map((p) => {
          const q = applyCanvasMetresFit(fit, p);
          return {
            x: Math.max(0, Math.min(100, q.x)),
            y: Math.max(0, Math.min(100, q.y)),
          };
        }),
      );
    }
  }
  return rings;
}
