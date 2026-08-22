import { clampBoardPct } from "@workstream/contracts";

/** Snap canvas percent coordinates to an indicative grid (Workflow 1 sketch). */
export function snapPctToGrid(
  value: number,
  gridPct = 2.5,
  enabled = true,
): number {
  if (!enabled || gridPct <= 0) return value;
  return clampBoardPct(Math.round(value / gridPct) * gridPct);
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

export type SnapGuide = {
  axis: "x" | "y";
  pct: number;
  sourceId: string;
};

export type SnapDragResult = {
  x_pct: number;
  y_pct: number;
  guides: SnapGuide[];
};

/**
 * Align a dragged placement to other placements' x/y when within tolerance.
 */
export function snapDragPct(
  xPct: number,
  yPct: number,
  others: Array<{ id: string; x_pct: number; y_pct: number }>,
  tolerancePct = 1.25,
): SnapDragResult {
  let x = clampBoardPct(xPct);
  let y = clampBoardPct(yPct);
  const guides: SnapGuide[] = [];
  let bestDx = tolerancePct;
  let bestDy = tolerancePct;

  for (const o of others) {
    const dx = Math.abs(o.x_pct - x);
    if (dx < bestDx) {
      bestDx = dx;
      x = o.x_pct;
      const existing = guides.find((g) => g.axis === "x");
      if (existing) {
        existing.pct = o.x_pct;
        existing.sourceId = o.id;
      } else {
        guides.push({ axis: "x", pct: o.x_pct, sourceId: o.id });
      }
    }
    const dy = Math.abs(o.y_pct - y);
    if (dy < bestDy) {
      bestDy = dy;
      y = o.y_pct;
      const existing = guides.find((g) => g.axis === "y");
      if (existing) {
        existing.pct = o.y_pct;
        existing.sourceId = o.id;
      } else {
        guides.push({ axis: "y", pct: o.y_pct, sourceId: o.id });
      }
    }
  }

  return { x_pct: x, y_pct: y, guides };
}
