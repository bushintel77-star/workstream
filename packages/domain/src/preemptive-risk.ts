import type {
  OverlayProposal,
  RiskFinding,
  SpatialObject,
} from "@workstream/contracts";

/** AU retaining wall engineer threshold (~4 ft / 1.2 m). */
export const RETAINING_ENGINEER_HEIGHT_M = 1.2;

/** Hardscape area that triggers drainage preempt (square metres). */
export const DRAINAGE_HARDSCAPE_M2 = 25;

/** Rough percent-to-metre scale for conflict checks on aerial pins. */
const PCT_TO_M = 0.35;

function distPct(
  a: { x_pct?: number; y_pct?: number },
  b: { x_pct?: number; y_pct?: number },
): number {
  if (
    a.x_pct == null ||
    a.y_pct == null ||
    b.x_pct == null ||
    b.y_pct == null
  ) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(a.x_pct - b.x_pct, a.y_pct - b.y_pct) * PCT_TO_M;
}

export type PreemptiveRiskResult = {
  risks: RiskFinding[];
  overlays: OverlayProposal[];
};

/** Predictive structural and ecological risks + mitigation overlay proposals. */
export function assessPreemptiveRisks(
  facts: SpatialObject[],
  dismissedIds: Set<string> = new Set(),
): PreemptiveRiskResult {
  const risks: RiskFinding[] = [];
  const overlays: OverlayProposal[] = [];

  const hardscape = facts.filter(
    (f) => f.layer === "hardscape" || f.layer === "structure",
  );
  const trees = facts.filter(
    (f) =>
      f.layer === "softscape" &&
      (f.root_radius_m != null ||
        f.symbol_id?.includes("tree") ||
        f.label.toLowerCase().includes("tree")),
  );

  for (const wall of facts) {
    if (wall.height_m == null || wall.height_m <= RETAINING_ENGINEER_HEIGHT_M) {
      continue;
    }
    const overlayId = `ov-eng-${wall.id}`;
    if (dismissedIds.has(overlayId)) continue;
    risks.push({
      id: `risk-eng-${wall.id}`,
      kind: "retaining_height",
      severity: "critical",
      title: "Retaining wall exceeds 1.2 m",
      detail: `${wall.label} at ~${wall.height_m.toFixed(1)} m - structural engineer and permit fees preempted in live BOM.`,
      source_object_ids: [wall.id],
      overlay_id: overlayId,
    });
    overlays.push({
      id: overlayId,
      kind: "engineer_hold",
      status: "ready",
      title: "Engineer hold - retaining >1.2 m",
      detail:
        "Accept to keep fee lines; mitigation is documentation, not geometry.",
      source_object_ids: [wall.id],
      bom_line_ids: [`fee-eng-${wall.id}`, `fee-permit-${wall.id}`],
      x_pct: wall.x_pct,
      y_pct: wall.y_pct,
    });
  }

  for (const tree of trees) {
    const rootR = tree.root_radius_m ?? 3;
    for (const hard of hardscape) {
      const d = distPct(tree, hard);
      if (d > rootR) continue;
      const overlayId = `ov-trp-${tree.id}-${hard.id}`;
      if (dismissedIds.has(overlayId)) continue;
      risks.push({
        id: `risk-trp-${tree.id}-${hard.id}`,
        kind: "trp_conflict",
        severity: "watch",
        title: "Root / hardscape conflict",
        detail: `${tree.label} mature root ~${rootR} m intersects ${hard.label}. Preemptive TRP ring suggested (AS 4970).`,
        source_object_ids: [tree.id, hard.id],
        overlay_id: overlayId,
      });
      overlays.push({
        id: overlayId,
        kind: "trp_ring",
        status: "ready",
        title: "TRP ring overlay",
        detail: "Accept to place tree-root-protection symbol on sketch.",
        suggest_symbol_id: "tree-root-protection",
        x_pct: tree.x_pct ?? 50,
        y_pct: tree.y_pct ?? 50,
        radius_m: rootR,
        source_object_ids: [tree.id, hard.id],
        bom_line_ids: [],
      });
    }
  }

  const hardscapeM2 = hardscape.reduce((s, f) => s + f.area_m2, 0);
  if (hardscapeM2 >= DRAINAGE_HARDSCAPE_M2) {
    const overlayId = "ov-drain-global";
    if (!dismissedIds.has(overlayId)) {
      const anchor = hardscape[0];
      risks.push({
        id: "risk-drain-global",
        kind: "drainage",
        severity: hardscapeM2 >= 60 ? "critical" : "watch",
        title: "Stormwater from hardscape",
        detail: `${hardscapeM2.toFixed(0)} m2 hardscape - preempt French drain / pit allowance and overlay.`,
        source_object_ids: hardscape.map((h) => h.id),
        overlay_id: overlayId,
      });
      overlays.push({
        id: overlayId,
        kind: "drainage",
        status: "ready",
        title: "Drainage intervention overlay",
        detail: "Accept to place a drainage/water symbol near hardscape.",
        suggest_symbol_id: "gravel-mulch",
        x_pct: Math.min(95, (anchor?.x_pct ?? 40) + 5),
        y_pct: Math.min(95, (anchor?.y_pct ?? 40) + 5),
        source_object_ids: hardscape.map((h) => h.id),
        bom_line_ids: ["sec-drain-global"],
      });
    }
  }

  // Utility stub - reserved when survey utilities land.
  return { risks, overlays };
}
