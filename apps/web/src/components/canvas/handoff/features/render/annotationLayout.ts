import type { PctPoint } from "../../geometry";

/**
 * Place annotation note toward plan margins — outside title boundary bbox + 4%.
 * Readable-up; never rotates with camera.
 */
export function clampNotePos(
  preferred: { x: number; y: number },
  boundary: PctPoint[],
): { x: number; y: number } {
  const pad = 4;
  let x = Math.min(96, Math.max(4, preferred.x));
  let y = Math.min(96, Math.max(4, preferred.y));
  if (boundary.length < 3) return { x, y };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of boundary) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const left = minX - pad;
  const right = maxX + pad;
  const top = minY - pad;
  const bottom = maxY + pad;

  const inside =
    x >= left && x <= right && y >= top && y <= bottom;
  if (!inside) return { x, y };

  // Push to nearest margin outside the padded bbox.
  const dL = x - left;
  const dR = right - x;
  const dT = y - top;
  const dB = bottom - y;
  const m = Math.min(dL, dR, dT, dB);
  if (m === dL) x = Math.max(4, left - 0.5);
  else if (m === dR) x = Math.min(96, right + 0.5);
  else if (m === dT) y = Math.max(4, top - 0.5);
  else y = Math.min(96, bottom + 0.5);
  return { x, y };
}

/** Default note park — left of anchor, outside boundary when possible. */
export function defaultNotePos(
  anchorX: number,
  anchorY: number,
  boundary: PctPoint[],
): { x: number; y: number } {
  return clampNotePos({ x: anchorX - 8, y: anchorY - 6 }, boundary);
}
