export type StaleGhostPoint = {
  id: string;
  x_pct: number;
  y_pct: number;
  stale?: boolean;
};

export type EditPoint = {
  x_pct: number;
  y_pct: number;
};

/**
 * Flag pending ghosts near an accepted-item edit (move/delete/scale).
 * Distance is in canvas percent units (~6% matches the v4 prototype).
 */
export function markStaleGhostsNearEdit<T extends StaleGhostPoint>(
  ghosts: T[],
  editPoints: EditPoint[],
  radiusPct = 6,
): T[] {
  if (ghosts.length === 0 || editPoints.length === 0) return ghosts;
  const r2 = radiusPct * radiusPct;
  return ghosts.map((g) => {
    if (g.stale) return g;
    const near = editPoints.some((p) => {
      const dx = g.x_pct - p.x_pct;
      const dy = g.y_pct - p.y_pct;
      return dx * dx + dy * dy <= r2;
    });
    return near ? { ...g, stale: true } : g;
  });
}
