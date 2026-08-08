import type { SpatialObject } from "@workstream/contracts";

export type StructuredStrokeConflict = {
  severity: "watch" | "critical";
  title: string;
  detail: string;
};

const PCT_TO_M = 0.35;

/** Live conflict check for an in-progress structured stroke vs trees / TRP. */
export function assessStructuredStrokeConflicts(
  draft: Array<{ x_pct: number; y_pct: number }>,
  facts: SpatialObject[],
  kind: "ditch" | "path" | "wall" | "bed",
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

  if (kind === "wall") {
    const height = 0.9;
    if (height > 1.2) {
      out.push({
        severity: "critical",
        title: "Retaining height",
        detail: "Wall profile exceeds 1.2 m engineer threshold.",
      });
    }
  }

  return out;
}
