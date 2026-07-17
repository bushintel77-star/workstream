/** Snap canvas percent coordinates to an indicative grid (Workflow 1 sketch). */
export function snapPctToGrid(
  value: number,
  gridPct = 2.5,
  enabled = true,
): number {
  if (!enabled || gridPct <= 0) return value;
  const snapped = Math.round(value / gridPct) * gridPct;
  return Math.min(100, Math.max(0, snapped));
}

export function snapPointPctToGrid(
  xPct: number,
  yPct: number,
  gridPct = 2.5,
  enabled = true,
): { x_pct: number; y_pct: number } {
  return {
    x_pct: snapPctToGrid(xPct, gridPct, enabled),
    y_pct: snapPctToGrid(yPct, gridPct, enabled),
  };
}
