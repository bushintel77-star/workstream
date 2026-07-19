export type GhostLike = {
  id: string;
  x_pct: number;
  y_pct: number;
  stale?: boolean;
};

export type PlacementLike = {
  id: string;
  x_pct: number;
  y_pct: number;
};

/** Mark ghosts stale when a nearby placement moved or was removed. */
export function markStaleGhostsNearEdit<T extends GhostLike>(
  ghosts: T[],
  affected: PlacementLike[],
  thresholdPct = 6,
): T[] {
  if (!affected.length || !ghosts.length) return ghosts;
  return ghosts.map((g) => {
    if (g.stale) return g;
    const near = affected.some(
      (p) => Math.hypot(p.x_pct - g.x_pct, p.y_pct - g.y_pct) <= thresholdPct,
    );
    return near ? { ...g, stale: true } : g;
  });
}

export function diffRemovedPlacements(
  before: PlacementLike[],
  after: PlacementLike[],
): PlacementLike[] {
  const afterIds = new Set(after.map((p) => p.id));
  return before.filter((p) => !afterIds.has(p.id));
}

export function diffMovedPlacements(
  before: PlacementLike[],
  after: PlacementLike[],
  moveThresholdPct = 0.5,
): PlacementLike[] {
  const afterById = new Map(after.map((p) => [p.id, p]));
  const moved: PlacementLike[] = [];
  for (const p of before) {
    const next = afterById.get(p.id);
    if (!next) continue;
    if (
      Math.hypot(next.x_pct - p.x_pct, next.y_pct - p.y_pct) > moveThresholdPct
    ) {
      moved.push(next);
    }
  }
  return moved;
}
