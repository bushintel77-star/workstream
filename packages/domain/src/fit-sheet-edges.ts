export type FitEdgeInput = {
  id: string;
  kind: "boundary" | "footprint" | "hardscape";
  points: Array<{ x: number; y: number }>;
  /** Sheet Y is top-down; pass heightM to flip from Y-up metres. */
};

export type FitSheetEdgeOut = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  kind: FitEdgeInput["kind"];
  lenM: number;
};

/**
 * Build labelled Fit-sheet edge dimensions from rings in lot-metre space
 * (SW origin, Y-up). Prefers longer edges; caps per kind.
 */
export function buildFitSheetEdges(
  rings: FitEdgeInput[],
  heightM: number,
  caps: { boundary?: number; footprint?: number; hardscape?: number } = {},
): FitSheetEdgeOut[] {
  const limit = {
    boundary: caps.boundary ?? 8,
    footprint: caps.footprint ?? 6,
    hardscape: caps.hardscape ?? 4,
  };
  const byKind: Record<FitEdgeInput["kind"], FitSheetEdgeOut[]> = {
    boundary: [],
    footprint: [],
    hardscape: [],
  };
  const prefix: Record<FitEdgeInput["kind"], string> = {
    boundary: "B",
    footprint: "F",
    hardscape: "H",
  };

  for (const ring of rings) {
    if (ring.points.length < 2) continue;
    const n = ring.points.length;
    const closed =
      n >= 3 &&
      Math.hypot(
        ring.points[0]!.x - ring.points[n - 1]!.x,
        ring.points[0]!.y - ring.points[n - 1]!.y,
      ) < 0.05;
    const count = closed ? n - 1 : n - 1;
    for (let i = 0; i < count; i++) {
      const a = ring.points[i]!;
      const b = ring.points[(i + 1) % n]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.8) continue;
      byKind[ring.kind].push({
        x1: a.x,
        y1: heightM - a.y,
        x2: b.x,
        y2: heightM - b.y,
        label: "",
        kind: ring.kind,
        lenM: len,
      });
    }
  }

  const out: FitSheetEdgeOut[] = [];
  for (const kind of ["boundary", "footprint", "hardscape"] as const) {
    const sorted = byKind[kind].sort((a, b) => b.lenM - a.lenM).slice(0, limit[kind]);
    sorted.sort((a, b) => a.y1 + a.x1 - (b.y1 + b.x1));
    sorted.forEach((e, i) => {
      const lenLabel = `${e.lenM.toFixed(e.lenM >= 10 ? 1 : 2)} m`;
      out.push({
        ...e,
        label: `${prefix[kind]}${i + 1} · ${lenLabel}`,
      });
    });
  }
  return out;
}
