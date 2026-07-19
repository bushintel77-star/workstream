export type ElevationItem = {
  id: string;
  label: string;
  xPct: number;
  widthPct: number;
  heightM: number;
  ghost: boolean;
  stale?: boolean;
};

export type ElevationAxis = "front" | "side";

/** Project plan items onto a 1D elevation axis (indicative). */
export function projectElevationItems(
  items: Array<{
    id: string;
    label: string;
    x_pct: number;
    y_pct: number;
    scale?: number;
    height_m?: number;
    ghost?: boolean;
    stale?: boolean;
  }>,
  axis: ElevationAxis,
  buildingHeightM = 2.7,
): { groundY: number; buildingH: number; items: ElevationItem[] } {
  const sorted = [...items].sort((a, b) =>
    axis === "front" ? a.x_pct - b.x_pct : a.y_pct - b.y_pct,
  );
  return {
    groundY: 0,
    buildingH: buildingHeightM,
    items: sorted.map((it) => ({
      id: it.id,
      label: it.label,
      xPct: axis === "front" ? it.x_pct : it.y_pct,
      widthPct: Math.max(2, (it.scale ?? 1) * 4),
      heightM: it.height_m ?? (it.label.toLowerCase().includes("tree") ? 4 : 1.2),
      ghost: Boolean(it.ghost),
      stale: it.stale,
    })),
  };
}
