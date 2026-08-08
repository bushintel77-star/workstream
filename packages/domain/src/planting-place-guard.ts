/**
 * Pre-place planting honesty — TPZ + mature canopy collision (Workflow 1).
 * Indicative only; never silently invents survey-grade root zones.
 */

import { tpzRadiusFromDbhCm } from "./tpz-geometry";

export type PlantingGuardItem = {
  id: string;
  t: string;
  x: number;
  y: number;
  scale: number;
  ghost?: boolean;
  /** DBH in metres when authored. */
  dbhM?: number;
  canopyM?: number;
};

export type PlantingConflict = {
  kind: "tpz" | "canopy";
  severity: "block" | "warn";
  message: string;
  otherId: string;
};

export type AssessPlantingInput = {
  xPct: number;
  yPct: number;
  /** Proposed mature canopy diameter (m). */
  canopySpreadM: number;
  items: PlantingGuardItem[];
  /** Board width in metres (default 110). */
  scaleM?: number;
  /**
   * Fraction of proposed+existing canopy radii that must clear.
   * 1 = edges may touch; 0.85 = soft overlap allowed as warn.
   */
  canopyClearance?: number;
};

function pctDistToM(dxPct: number, dyPct: number, scaleM: number): number {
  return (Math.hypot(dxPct, dyPct) / 100) * scaleM;
}

function itemCanopyRadiusM(it: PlantingGuardItem): number {
  const d = (it.canopyM ?? 0) * (it.scale > 0 ? it.scale : 1);
  return d > 0 ? d / 2 : 0;
}

function itemTpzRadiusM(it: PlantingGuardItem): number {
  if (it.t !== "exist") return 0;
  const dbhM = it.dbhM ?? 0.45;
  return tpzRadiusFromDbhCm(dbhM * 100);
}

/**
 * Assess a proposed plant at (xPct,yPct) against existing trees / canopies.
 * TPZ centre-in-ring → block; canopy overlap → warn (or block if deep).
 */
export function assessPlantingPlacement(
  input: AssessPlantingInput,
): PlantingConflict[] {
  const scaleM = input.scaleM ?? 110;
  const clear = input.canopyClearance ?? 0.9;
  const proposedR = Math.max(0.4, input.canopySpreadM / 2);
  const out: PlantingConflict[] = [];

  for (const it of input.items) {
    if (it.ghost) continue;
    if (it.t !== "exist" && it.t !== "canopy" && it.t !== "feature") continue;

    const distM = pctDistToM(it.x - input.xPct, it.y - input.yPct, scaleM);

    const tpzR = itemTpzRadiusM(it);
    if (tpzR > 0 && distM < tpzR) {
      out.push({
        kind: "tpz",
        severity: "block",
        otherId: it.id,
        message: `Inside existing-tree TPZ (~${tpzR.toFixed(1)} m AS 4970) — shift clear or accept TRP mitigation`,
      });
      continue;
    }

    const otherR = itemCanopyRadiusM(it);
    if (otherR <= 0) continue;
    const need = (proposedR + otherR) * clear;
    if (distM >= need) continue;
    const deep = distM < (proposedR + otherR) * 0.55;
    out.push({
      kind: "canopy",
      severity: deep ? "block" : "warn",
      otherId: it.id,
      message: deep
        ? `Mature canopy would collide with existing ${it.t} — leave clearance`
        : `Tight mature canopy spacing (~${distM.toFixed(1)} m) — check spread at maturity`,
    });
  }

  // Prefer unique otherId; keep strongest severity.
  const byId = new Map<string, PlantingConflict>();
  for (const c of out) {
    const prev = byId.get(c.otherId);
    if (!prev || (prev.severity === "warn" && c.severity === "block")) {
      byId.set(c.otherId, c);
    }
  }
  return [...byId.values()];
}

export function plantingConflictSummary(
  conflicts: PlantingConflict[],
): { blocked: boolean; tip: string | null } {
  if (conflicts.length === 0) return { blocked: false, tip: null };
  const block = conflicts.find((c) => c.severity === "block");
  if (block) return { blocked: true, tip: block.message };
  return { blocked: false, tip: conflicts[0]!.message };
}
