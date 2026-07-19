import type { PctPoint } from "./types";

/**
 * Fit a canvas-metre ring (Vicmap / SiteBoundary vertices) into handoff `%` board space.
 * Y is flipped (canvas metres often increase north; board y increases down).
 */
export function canvasMetresRingToPct(
  verts: Array<{ x: number; y: number }>,
  padPct = 8,
): PctPoint[] {
  if (verts.length < 3) return [];
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
  const ox = (100 - usedW) / 2;
  const oy = (100 - usedH) / 2;
  return verts.map((v) => ({
    x: ox + (v.x - minX) * scale,
    y: oy + (maxY - v.y) * scale,
  }));
}
