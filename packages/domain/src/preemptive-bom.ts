import type {
  BomLine,
  RateCard,
  SiteMultipliers,
  SpatialObject,
} from "@workstream/contracts";
import {
  DEFAULT_PAVING_ASSEMBLY,
  layerDepthM,
  totalDepthM,
} from "./assembly-recipe";
import { calculateGST, calculateLineTotal, calculateTotal } from "./costing";

const DEFAULT_PAVING_DEPTH_M = totalDepthM(DEFAULT_PAVING_ASSEMBLY);
const DEFAULT_BASE_DEPTH_M = layerDepthM(DEFAULT_PAVING_ASSEMBLY, "base");
const DEFAULT_BEDDING_DEPTH_M = layerDepthM(DEFAULT_PAVING_ASSEMBLY, "bedding");

export const DEFAULT_SITE_MULTIPLIERS: SiteMultipliers = {
  soil: "standard",
  slope: "flat",
  access: "easy",
  soil_factor: 1,
  slope_factor: 1,
  access_factor: 1,
};

export function siteMultipliersFromSurvey(gardenAreaM2?: number): SiteMultipliers {
  const m = { ...DEFAULT_SITE_MULTIPLIERS };
  if (gardenAreaM2 != null && gardenAreaM2 > 400) {
    m.access = "constrained";
    m.access_factor = 1.15;
  }
  return m;
}

type RateIndex = Map<string, RateCard>;

function findRate(rates: RateIndex, ...candidates: string[]): RateCard | null {
  for (const sku of candidates) {
    const hit = rates.get(sku);
    if (hit) return hit;
  }
  for (const [, row] of rates) {
    const label = row.label.toLowerCase();
    if (candidates.some((c) => label.includes(c.toLowerCase()))) return row;
  }
  return null;
}

function line(
  id: string,
  tier: BomLine["tier"],
  label: string,
  unit: string,
  qty: number,
  rate: number,
  sku: string | null,
  source_object_ids: string[],
  notes?: string,
  is_provisional = true,
): BomLine {
  const q = Math.round(qty * 100) / 100;
  const r = Math.round(rate * 100) / 100;
  return {
    id,
    tier,
    sku,
    label,
    unit,
    qty: q,
    rate: r,
    total: calculateLineTotal(q, r),
    source_object_ids,
    notes,
    is_provisional,
  };
}

function applyMult(rate: number, m: SiteMultipliers): number {
  return rate * m.soil_factor * m.slope_factor * m.access_factor;
}

/** Expand primary spatial objects into secondary/tertiary/labour/logistics BOM. */
export function expandPreemptiveBom(
  facts: SpatialObject[],
  rates: RateCard[],
  multipliers: SiteMultipliers = DEFAULT_SITE_MULTIPLIERS,
): BomLine[] {
  const rateIndex = new Map(rates.map((r) => [r.sku, r]));
  const lines: BomLine[] = [];
  let hardscapeM2 = 0;

  for (const obj of facts) {
    if (obj.layer === "hardscape" || obj.layer === "structure") {
      const area = obj.area_m2 > 0 ? obj.area_m2 : 0;
      hardscapeM2 += area;

      if (area > 0) {
        const pav = findRate(rateIndex, "PAV", "paving", "paver");
        lines.push(
          line(
            `prim-${obj.id}`,
            "primary",
            pav?.label ?? `${obj.label} - surface`,
            pav?.unit ?? "m2",
            area,
            applyMult(pav?.rate ?? 95, multipliers),
            pav?.sku ?? null,
            [obj.id],
            "Primary hardscape surface",
          ),
        );

        const excavateM3 = obj.volume_m3 ?? area * DEFAULT_PAVING_DEPTH_M;
        const excav = findRate(rateIndex, "EXC", "excavat");
        lines.push(
          line(
            `sec-exc-${obj.id}`,
            "secondary",
            excav?.label ?? "Excavation - subgrade",
            excav?.unit ?? "m3",
            excavateM3,
            applyMult(excav?.rate ?? 85, multipliers),
            excav?.sku ?? null,
            [obj.id],
            "Preemptive: remove for assembly depth",
          ),
        );

        const baseM3 = area * DEFAULT_BASE_DEPTH_M;
        const baseT = baseM3 * 1.8;
        const base = findRate(rateIndex, "CR6", "crushed", "base");
        lines.push(
          line(
            `sec-base-${obj.id}`,
            "secondary",
            base?.label ?? "Crushed rock base (CR)",
            base?.unit ?? "t",
            baseT,
            applyMult(base?.rate ?? 65, multipliers),
            base?.sku ?? null,
            [obj.id],
            `Preemptive: ~${Math.round(DEFAULT_BASE_DEPTH_M * 1000)} mm compacted base`,
          ),
        );

        const sandM3 = area * DEFAULT_BEDDING_DEPTH_M;
        const sand = findRate(rateIndex, "SAND", "bedding");
        lines.push(
          line(
            `ter-sand-${obj.id}`,
            "tertiary",
            sand?.label ?? "Bedding sand",
            sand?.unit ?? "m3",
            sandM3,
            applyMult(sand?.rate ?? 90, multipliers),
            sand?.sku ?? null,
            [obj.id],
            `Preemptive: ~${Math.round(DEFAULT_BEDDING_DEPTH_M * 1000)} mm setting bed`,
          ),
        );

        const jointKg = area * 4;
        const joint = findRate(rateIndex, "JOINT", "polymeric", "joint sand");
        lines.push(
          line(
            `ter-joint-${obj.id}`,
            "tertiary",
            joint?.label ?? "Polymeric joint sand",
            joint?.unit ?? "kg",
            jointKg,
            applyMult(joint?.rate ?? 2.4, multipliers),
            joint?.sku ?? null,
            [obj.id],
          ),
        );

        const edgeLm = obj.length_m > 0 ? obj.length_m : Math.sqrt(area) * 4;
        const edge = findRate(rateIndex, "EDGE", "restraint", "edging");
        lines.push(
          line(
            `ter-edge-${obj.id}`,
            "tertiary",
            edge?.label ?? "Edge restraint",
            edge?.unit ?? "lm",
            edgeLm,
            applyMult(edge?.rate ?? 28, multipliers),
            edge?.sku ?? null,
            [obj.id],
          ),
        );

        const labourHrs = area * 0.35 * multipliers.access_factor;
        const labour = findRate(rateIndex, "LAB", "labour", "labor");
        lines.push(
          line(
            `lab-${obj.id}`,
            "labour",
            labour?.label ?? "Hardscape install labour",
            labour?.unit ?? "hr",
            labourHrs,
            applyMult(labour?.rate ?? 85, multipliers),
            labour?.sku ?? null,
            [obj.id],
            "Preemptive labour allowance",
          ),
        );
      }

      if (obj.height_m != null && obj.height_m > 1.2) {
        const eng = findRate(rateIndex, "ENG", "engineer", "structural");
        lines.push(
          line(
            `fee-eng-${obj.id}`,
            "fee",
            eng?.label ?? "Structural engineer - retaining >1.2 m",
            eng?.unit ?? "ea",
            1,
            eng?.rate ?? 1800,
            eng?.sku ?? null,
            [obj.id],
            "AU threshold ~1.2 m - engineer + permit likely",
          ),
        );
        const permit = findRate(rateIndex, "PERMIT", "council");
        lines.push(
          line(
            `fee-permit-${obj.id}`,
            "fee",
            permit?.label ?? "Council / building permit allowance",
            permit?.unit ?? "ea",
            1,
            permit?.rate ?? 650,
            permit?.sku ?? null,
            [obj.id],
            "Preemptive fee - confirm with council",
          ),
        );
      }
    }

    if (obj.layer === "softscape") {
      const plant = findRate(rateIndex, "PLT", "plant", "tree");
      lines.push(
        line(
          `prim-plant-${obj.id}`,
          "primary",
          plant?.label ?? obj.label,
          plant?.unit ?? "ea",
          obj.count,
          applyMult(plant?.rate ?? 120, multipliers),
          plant?.sku ?? null,
          [obj.id],
        ),
      );
      const plantLabour = findRate(rateIndex, "LAB-PLT", "plant labour");
      lines.push(
        line(
          `lab-plant-${obj.id}`,
          "labour",
          plantLabour?.label ?? "Planting labour",
          plantLabour?.unit ?? "ea",
          obj.count,
          applyMult(plantLabour?.rate ?? 45, multipliers),
          plantLabour?.sku ?? null,
          [obj.id],
        ),
      );
    }

    if (obj.layer === "irrigation" && obj.length_m > 0) {
      const drip = findRate(rateIndex, "IRR", "drip", "irrigation");
      lines.push(
        line(
          `prim-irr-${obj.id}`,
          "primary",
          drip?.label ?? "Drip irrigation line",
          drip?.unit ?? "lm",
          obj.length_m,
          applyMult(drip?.rate ?? 18, multipliers),
          drip?.sku ?? null,
          [obj.id],
        ),
      );
    }
  }

  if (hardscapeM2 >= 25) {
    const drain = findRate(rateIndex, "DRAIN", "french", "ag pipe");
    lines.push(
      line(
        "sec-drain-global",
        "secondary",
        drain?.label ?? "Drainage - ag line / pit allowance",
        drain?.unit ?? "lm",
        Math.max(6, Math.round(Math.sqrt(hardscapeM2) * 2)),
        applyMult(drain?.rate ?? 55, multipliers),
        drain?.sku ?? null,
        facts.filter((f) => f.layer === "hardscape").map((f) => f.id),
        "Preemptive: hardscape runoff intervention",
      ),
    );
  }

  if (hardscapeM2 >= 40 || multipliers.access !== "easy") {
    const bobcat = findRate(rateIndex, "BOBCAT", "excavator", "machine");
    lines.push(
      line(
        "log-equip",
        "logistics",
        bobcat?.label ?? "Mini excavator / bobcat hire",
        bobcat?.unit ?? "day",
        multipliers.access === "crane" ? 2 : 1,
        applyMult(bobcat?.rate ?? 450, multipliers),
        bobcat?.sku ?? null,
        [],
        "Preemptive equipment - access / volume",
      ),
    );
  }

  return lines;
}

export function bomTotals(lines: BomLine[]): {
  subtotal: number;
  gst: number;
  total: number;
} {
  const subtotal =
    Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
  const gst = calculateGST(subtotal);
  const total = calculateTotal(subtotal, gst);
  return { subtotal, gst, total };
}
