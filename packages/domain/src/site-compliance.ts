import type { RiskFinding, SpatialObject } from "@workstream/contracts";

/** Indicative minimum permeable surface (AU residential gardens). */
export const PERMEABLE_MIN_PCT = 30;

/** Target canopy cover at maturity for softening (indicative). */
export const CANOPY_TARGET_PCT = 25;

export type SiteComplianceStats = {
  pass: boolean;
  outdoorAreaM2: number;
  permeablePct: number;
  permeableMinPct: number;
  canopyMaturityPct: number;
  canopyTargetPct: number;
  breachCount: number;
  verdict: string;
};

function layerArea(facts: SpatialObject[], layers: Set<string>): number {
  return facts
    .filter((f) => layers.has(f.layer))
    .reduce((s, f) => s + (f.area_m2 ?? 0), 0);
}

function canopyArea(facts: SpatialObject[]): number {
  return facts
    .filter(
      (f) =>
        f.layer === "softscape" &&
        (f.mature_canopy_m != null ||
          f.symbol_id?.includes("tree") ||
          f.label.toLowerCase().includes("tree") ||
          f.label.toLowerCase().includes("canopy")),
    )
    .reduce((s, f) => {
      const r = f.mature_canopy_m ?? f.root_radius_m ?? 2;
      return s + Math.PI * r * r;
    }, 0);
}

/** Council-style indicative compliance readout — stats never gated by layer opacity. */
export function computeSiteCompliance(args: {
  outdoorAreaM2: number;
  spatialFacts: SpatialObject[];
  risks: RiskFinding[];
}): SiteComplianceStats {
  const { outdoorAreaM2, spatialFacts, risks } = args;
  const outdoor = Math.max(outdoorAreaM2, 1);
  const hardscape = layerArea(
    spatialFacts,
    new Set(["hardscape", "structure", "water"]),
  );
  const permeable = layerArea(
    spatialFacts,
    new Set(["softscape", "planting"]),
  );
  const permeablePct = Math.round((permeable / outdoor) * 100);
  const canopyM2 = canopyArea(spatialFacts);
  const canopyMaturityPct = Math.round((canopyM2 / outdoor) * 100);

  const critical = risks.filter((r) => r.severity === "critical").length;
  const permeableFail = permeablePct < PERMEABLE_MIN_PCT;
  const canopyLow =
    canopyM2 > 0 && canopyMaturityPct < CANOPY_TARGET_PCT * 0.5;
  const breachCount = critical + (permeableFail ? 1 : 0) + (canopyLow ? 1 : 0);
  const pass = breachCount === 0;

  return {
    pass,
    outdoorAreaM2: Math.round(outdoor),
    permeablePct,
    permeableMinPct: PERMEABLE_MIN_PCT,
    canopyMaturityPct,
    canopyTargetPct: CANOPY_TARGET_PCT,
    breachCount,
    verdict: pass
      ? "Indicative pass"
      : `${breachCount} item${breachCount === 1 ? "" : "s"} to review`,
  };
}
