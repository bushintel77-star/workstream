import type { PctPoint } from "../../geometry";
import { nearestPointOnRing } from "../../geometry/outdoorClamp";

/** Screen-px proximity for paint / place air-lock to hard CAD vectors. */
export const AIR_LOCK_PX = 15;

/**
 * If `p` is within ~15px of a boundary or building ring, snap to that vector
 * so paint / place does not bleed across structural limits.
 */
export function airLockSnapToHardscape(
  p: PctPoint,
  rings: PctPoint[][],
  boardW: number,
  boardH: number,
): PctPoint {
  if (boardW <= 0 || boardH <= 0) return p;
  const thresh = Math.min(
    (AIR_LOCK_PX / boardW) * 100,
    (AIR_LOCK_PX / boardH) * 100,
  );

  let best = p;
  let bestD = Infinity;
  for (const ring of rings) {
    if (ring.length < 2) continue;
    const q = nearestPointOnRing(p, ring);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return bestD <= thresh ? best : p;
}
