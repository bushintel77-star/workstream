import type { SpatialObject } from "@workstream/contracts";

export type StructuredStrokeConflict = {
  severity: "watch" | "critical";
  title: string;
  detail: string;
};

const PCT_TO_M = 0.35;

/** Indicative underground service corridors in % canvas space (not DBYD). */
export type IndicativeUtilityCorridor = {
  id: string;
  label: string;
  /** Axis-aligned band: y from y0..y1 across x 8..92 */
  y0: number;
  y1: number;
};

export function buildIndicativeUtilityCorridorsPct(): IndicativeUtilityCorridor[] {
  return [
    {
      id: "util-gas",
      label: "Indicative gas / service corridor",
      y0: 46,
      y1: 54,
    },
  ];
}

function pointInUtilityBand(
  pt: { x_pct: number; y_pct: number },
  band: IndicativeUtilityCorridor,
): boolean {
  return pt.x_pct >= 8 && pt.x_pct <= 92 && pt.y_pct >= band.y0 && pt.y_pct <= band.y1;
}

/** Live conflict check for an in-progress structured stroke vs trees / TRP / utilities. */
export function assessStructuredStrokeConflicts(
  draft: Array<{ x_pct: number; y_pct: number }>,
  facts: SpatialObject[],
  kind: "ditch" | "path" | "wall" | "bed",
  utilities: IndicativeUtilityCorridor[] = buildIndicativeUtilityCorridorsPct(),
): StructuredStrokeConflict[] {
  if (draft.length === 0) return [];
  const out: StructuredStrokeConflict[] = [];
  const trees = facts.filter(
    (f) =>
      f.layer === "softscape" &&
      (f.root_radius_m != null ||
        f.symbol_id?.includes("tree") ||
        f.label.toLowerCase().includes("tree")),
  );

  for (const pt of draft) {
    for (const tree of trees) {
      if (tree.x_pct == null || tree.y_pct == null) continue;
      const d =
        Math.hypot(pt.x_pct - tree.x_pct, pt.y_pct - tree.y_pct) * PCT_TO_M;
      const rootR = tree.root_radius_m ?? 3;
      if (d <= rootR) {
        out.push({
          severity: kind === "ditch" || kind === "wall" ? "critical" : "watch",
          title: "Root zone conflict",
          detail: `${kind} stroke intersects ${tree.label} TRP (~${rootR.toFixed(1)} m).`,
        });
        break;
      }
    }
    if (out.length > 0) break;
  }

  if (kind === "ditch" || kind === "wall") {
    for (const pt of draft) {
      for (const u of utilities) {
        if (pointInUtilityBand(pt, u)) {
          out.push({
            severity: "critical",
            title: "Underground service",
            detail: `${u.label} — confirm locate before excavating (indicative only).`,
          });
          break;
        }
      }
      if (out.some((c) => c.title === "Underground service")) break;
    }
  }

  return out;
}
