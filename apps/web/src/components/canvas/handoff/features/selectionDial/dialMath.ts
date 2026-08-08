import type { StudioItem } from "../../studioCatalog";

export type DialSide = "left" | "right" | "top" | "bottom";

/**
 * Pick the emptiest half-plane around the selection for dial placement.
 * Counts neighbouring plan items in each direction; prefers the sparsest.
 */
export function emptiestDialSide(
  centre: { x: number; y: number },
  items: StudioItem[],
  selfId: string,
): DialSide {
  const counts = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const it of items) {
    if (it.id === selfId || it.ghost) continue;
    const dx = it.x - centre.x;
    const dy = it.y - centre.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx < 0) counts.left += 1;
      else counts.right += 1;
    } else if (dy < 0) counts.top += 1;
    else counts.bottom += 1;
  }
  let best: DialSide = "right";
  let bestN = Infinity;
  for (const side of ["right", "left", "top", "bottom"] as DialSide[]) {
    if (counts[side] < bestN) {
      bestN = counts[side];
      best = side;
    }
  }
  return best;
}

/** Screen-px offset from item centre for a dial of given radius. */
export function dialOffsetPx(
  side: DialSide,
  radiusPx: number,
): { ox: number; oy: number } {
  const r = Math.max(96, radiusPx);
  switch (side) {
    case "left":
      return { ox: -r, oy: 0 };
    case "right":
      return { ox: r, oy: 0 };
    case "top":
      return { ox: 0, oy: -r };
    case "bottom":
      return { ox: 0, oy: r };
  }
}

/** Arc start angle (deg, CSS: 0 = east, CW) for a 180° sweep facing outward. */
export function dialArcAngles(side: DialSide): { startDeg: number; sweepDeg: number } {
  switch (side) {
    case "right":
      return { startDeg: -90, sweepDeg: 180 };
    case "left":
      return { startDeg: 90, sweepDeg: 180 };
    case "top":
      return { startDeg: 180, sweepDeg: 180 };
    case "bottom":
      return { startDeg: 0, sweepDeg: 180 };
  }
}

export function snapRotDetent(deg: number, detent = 15): number {
  const n = Math.round(deg / detent) * detent;
  let r = n % 360;
  if (r < 0) r += 360;
  return r;
}
