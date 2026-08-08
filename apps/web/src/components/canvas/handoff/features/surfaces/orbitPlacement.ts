/**
 * Half-orbit placement engine — "the moons face away from the drawing."
 *
 * Pure geometry, no DOM. The orbit around a selected item occupies the
 * emptiest contiguous 180° window; these helpers score the surroundings,
 * pick the window, and apply hysteresis so the arc never flips sides
 * mid-gesture.
 *
 * Angle convention: SCREEN space, degrees, y-down — 0° = right (+x),
 * 90° = down (+y), 180° = left, 270° = up. Eight 45° sectors indexed 0–7,
 * sector k spanning [k*45 − 22.5, k*45 + 22.5).
 */

export const SECTOR_COUNT = 8;
export const SECTOR_DEG = 360 / SECTOR_COUNT;

export type PctPointLike = { x: number; y: number };

/** Weighted obstacle primitives, all in board % coordinates. */
export type PlacementObstacles = {
  /** Point-ish content (items). Radius in % inflates the weight falloff. */
  points?: Array<{ x: number; y: number; radiusPct?: number; weight?: number }>;
  /** Polyline content (boundary, building) — pass vertices; segments are sampled. */
  polylines?: Array<{ points: PctPointLike[]; weight?: number }>;
  /** Rect content (labels, cards) as bboxes. */
  rects?: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    weight?: number;
  }>;
};

export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** Screen-space angle from `from` toward `to` (y-down convention). */
export function angleDeg(from: PctPointLike, to: PctPointLike): number {
  return normalizeDeg((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
}

export function sectorOf(deg: number): number {
  return Math.floor(normalizeDeg(deg + SECTOR_DEG / 2) / SECTOR_DEG) % SECTOR_COUNT;
}

/**
 * Distance falloff: nearby content matters, far content barely counts.
 * Linear falloff to zero at `horizonPct` (default 28% of the board).
 */
function falloff(distPct: number, horizonPct: number): number {
  if (distPct >= horizonPct) return 0;
  return 1 - distPct / horizonPct;
}

/**
 * Score the eight sectors around `centre`. Higher score = more content =
 * worse place for controls. Deterministic; obstacles at the exact centre
 * are ignored (that's the selection itself).
 */
export function scoreSectors(
  centre: PctPointLike,
  obstacles: PlacementObstacles,
  opts?: { horizonPct?: number; sampleStepPct?: number },
): number[] {
  const horizon = opts?.horizonPct ?? 28;
  const step = Math.max(0.5, opts?.sampleStepPct ?? 2);
  const scores = new Array<number>(SECTOR_COUNT).fill(0);

  const addPoint = (x: number, y: number, weight: number, radiusPct = 0) => {
    const dx = x - centre.x;
    const dy = y - centre.y;
    const dist = Math.max(0, Math.hypot(dx, dy) - radiusPct);
    if (dist < 1e-6 && Math.hypot(dx, dy) < 1e-6) return; // the selection itself
    const f = falloff(dist, horizon);
    if (f <= 0) return;
    scores[sectorOf(angleDeg(centre, { x, y }))]! += weight * f;
  };

  for (const p of obstacles.points ?? []) {
    addPoint(p.x, p.y, p.weight ?? 1, p.radiusPct ?? 0);
  }

  for (const line of obstacles.polylines ?? []) {
    const w = line.weight ?? 0.35; // per sample — lines are long, keep them light
    const pts = line.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(len / step));
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        addPoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, w);
      }
    }
  }

  for (const r of obstacles.rects ?? []) {
    // Sample the rect centre + corners; rects are usually small labels.
    const w = (r.weight ?? 1) / 5;
    addPoint(r.x + r.w / 2, r.y + r.h / 2, w);
    addPoint(r.x, r.y, w);
    addPoint(r.x + r.w, r.y, w);
    addPoint(r.x, r.y + r.h, w);
    addPoint(r.x + r.w, r.y + r.h, w);
  }

  return scores;
}

export type HalfWindow = {
  /** Centre angle of the chosen 180° window (deg, screen convention). */
  centerDeg: number;
  /** Sum of sector scores inside the window (lower = emptier). */
  score: number;
};

/**
 * Choose the emptiest contiguous 180° window (4 consecutive sectors).
 * Window centres land on the 45° lattice (22.5°, 67.5°, …), so "down" is
 * approached, never hit exactly; ties resolve toward the centre nearest
 * 90° — below the object is the least surprising default on an empty board.
 */
export function bestHalfWindow(scores: number[]): HalfWindow {
  const half = SECTOR_COUNT / 2;
  let best: HalfWindow | null = null;
  for (let start = 0; start < SECTOR_COUNT; start++) {
    let sum = 0;
    for (let k = 0; k < half; k++) sum += scores[(start + k) % SECTOR_COUNT]!;
    const centerDeg = normalizeDeg(start * SECTOR_DEG + ((half - 1) * SECTOR_DEG) / 2);
    if (
      best === null ||
      sum < best.score - 1e-9 ||
      (Math.abs(sum - best.score) <= 1e-9 &&
        angularDistanceDeg(centerDeg, 90) < angularDistanceDeg(best.centerDeg, 90))
    ) {
      best = { centerDeg, score: sum };
    }
  }
  return best!;
}

export function angularDistanceDeg(a: number, b: number): number {
  const d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(d, 360 - d);
}

/**
 * Hysteresis — the arc must not flip sides under the cursor. Relocate only
 * when the candidate window is BOTH meaningfully emptier (default: 30%
 * better) AND meaningfully elsewhere (> 45°). Call on selection change and
 * after a move gesture ENDS — never mid-drag.
 */
export function shouldRelocate(
  current: HalfWindow,
  candidate: HalfWindow,
  opts?: { improvement?: number; minShiftDeg?: number },
): boolean {
  const improvement = opts?.improvement ?? 0.3;
  const minShift = opts?.minShiftDeg ?? 45;
  if (angularDistanceDeg(current.centerDeg, candidate.centerDeg) <= minShift) {
    return false;
  }
  if (current.score <= 1e-9) return false; // current side is already empty
  return candidate.score <= current.score * (1 - improvement);
}

/**
 * Viewport clearance beats drawing clearance: if the arc at `radiusPx`
 * around the selection's SCREEN position would overflow the viewport on the
 * chosen side, bias the window centre back toward the viewport centre.
 * Returns a possibly-adjusted centre angle.
 */
export function clampWindowToViewport(args: {
  centerDeg: number;
  selectionPx: { x: number; y: number };
  radiusPx: number;
  viewport: { w: number; h: number };
  marginPx?: number;
}): number {
  const { centerDeg, selectionPx, radiusPx, viewport } = args;
  const margin = args.marginPx ?? 12;
  const rad = (centerDeg * Math.PI) / 180;
  const tip = {
    x: selectionPx.x + Math.cos(rad) * radiusPx,
    y: selectionPx.y + Math.sin(rad) * radiusPx,
  };
  const inside =
    tip.x >= margin &&
    tip.x <= viewport.w - margin &&
    tip.y >= margin &&
    tip.y <= viewport.h - margin;
  if (inside) return centerDeg;
  // Point the window at the viewport centre instead — always on-screen.
  return angleDeg(selectionPx, { x: viewport.w / 2, y: viewport.h / 2 });
}
