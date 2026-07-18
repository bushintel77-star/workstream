import type { CadDocument, LineItem, RateCard } from "@workstream/contracts";
import {
  applyContingency,
  calculateGST,
  calculateLineTotal,
  calculateSubtotal,
  calculateTotal,
  type CostScenario,
} from "./costing";
import {
  cadQuantitySurvey,
  type CadQuantityRow,
  type CadQuantitySurvey,
} from "./cad-quantities";
import {
  isTier1WrightsTerrace,
  TIER1_WRIGHTS_SAVINGS,
} from "./tier1-wrights-terrace";

/** Map CAD layer (+ unit) to a preferred rate-card SKU pattern. */
const LAYER_SKU_HINTS: Array<{
  match: RegExp;
  unit: CadQuantityRow["unit"] | "*";
  skus: string[];
}> = [
  {
    match: /HARD|PAV|PATIO|PATH/i,
    unit: "m2",
    skus: ["PAV-BLU", "PAVE", "HARDSCAPE", "PAVING"],
  },
  {
    match: /LAWN|TURF/i,
    unit: "m2",
    skus: ["LAWN", "TURF"],
  },
  {
    match: /PLANT|TREE|SKETCH/i,
    unit: "ea",
    skus: ["PLANT", "TREE", "SHRUB"],
  },
  {
    match: /IRRIG|WATER/i,
    unit: "lm",
    skus: ["IRRIG", "DRIP", "PIPE"],
  },
  {
    match: /STRUCT|RETAIN|FENCE|WALL/i,
    unit: "*",
    skus: ["RETAIN", "FENCE", "WALL", "STRUCT"],
  },
];

function findRate(
  rates: RateCard[],
  row: CadQuantityRow,
): RateCard | undefined {
  const hints = LAYER_SKU_HINTS.filter(
    (h) => h.match.test(row.layer) && (h.unit === "*" || h.unit === row.unit),
  );
  for (const h of hints) {
    for (const hint of h.skus) {
      const hit = rates.find(
        (r) =>
          r.sku.toUpperCase().includes(hint) &&
          (row.unit === "m2"
            ? r.unit === "m2" || r.unit === "sqm"
            : row.unit === "lm"
              ? r.unit === "lm" || r.unit === "m"
              : r.unit === "ea" || r.unit === "each" || r.unit === "no"),
      );
      if (hit) return hit;
    }
  }
  // Fallback: first rate with matching unit
  const unitHit = rates.find((r) => {
    if (row.unit === "m2") return r.unit === "m2" || r.unit === "sqm";
    if (row.unit === "lm") return r.unit === "lm" || r.unit === "m";
    return r.unit === "ea" || r.unit === "each" || r.unit === "no";
  });
  return unitHit;
}

export type CadBuildSchedule = {
  survey: CadQuantitySurvey;
  line_items: LineItem[];
  scenario: CostScenario;
  subtotal: number;
  contingency: number;
  gst: number;
  total: number;
};

/** Itemised build from CAD geometry + rate card. */
export function buildFromCad(
  doc: CadDocument,
  rates: RateCard[],
  opts?: { committedOnly?: boolean; scenario?: CostScenario },
): CadBuildSchedule {
  const scenario = opts?.scenario ?? "standard";
  const survey = cadQuantitySurvey(doc, {
    committedOnly: opts?.committedOnly,
  });

  // Aggregate by layer+unit so one paving polyline doesn't explode SKUs
  const agg = new Map<
    string,
    { row: CadQuantityRow; qty: number; rate?: RateCard }
  >();

  for (const row of survey.rows) {
    const key = `${row.layer}|${row.unit}|${row.kind === "insert" ? row.label : ""}`;
    const existing = agg.get(key);
    if (existing) {
      existing.qty = Math.round((existing.qty + row.qty) * 100) / 100;
    } else {
      agg.set(key, {
        row,
        qty: row.qty,
        rate: findRate(rates, row),
      });
    }
  }

  const line_items: LineItem[] = [];
  for (const { row, qty, rate } of agg.values()) {
    if (!rate || qty <= 0) {
      line_items.push({
        sku: `CAD-${row.layer}`,
        label: `${row.label} (unpriced — add rate card SKU)`,
        unit: row.unit,
        qty,
        rate: 0,
        total: 0,
        notes: "CAD quantity — no matching rate card SKU",
        is_provisional: true,
      });
      continue;
    }
    const total = calculateLineTotal(qty, rate.rate);
    line_items.push({
      sku: rate.sku,
      label: `${rate.label} — ${row.layer}`,
      unit: rate.unit,
      qty,
      rate: rate.rate,
      total,
      notes: "From AI CAD quantity survey",
      is_provisional: false,
    });
  }

  const billable = line_items
    .filter((l) => !l.is_provisional)
    .map((l) => l.total);
  const subtotal = calculateSubtotal(
    billable.length > 0 ? billable : line_items.map((l) => l.total),
  );
  const contingency = applyContingency(subtotal, scenario);
  const taxable = subtotal + contingency;
  const gst = calculateGST(taxable);
  const total = calculateTotal(taxable, gst);

  return {
    survey,
    line_items,
    scenario,
    subtotal: Math.round(subtotal * 100) / 100,
    contingency: Math.round(contingency * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * One costing truth for Wrights Tier-1: lock standard CAD build to proposal
 * workbook total (same ALW-TIER1-ALIGN gate as zone costing).
 */
export function alignCadBuildToTier1Workbook(
  build: CadBuildSchedule,
  address: string,
): CadBuildSchedule {
  if (!isTier1WrightsTerrace(address)) return build;
  if (build.scenario !== "standard") return build;

  const target = TIER1_WRIGHTS_SAVINGS.target_total_inc_gst;
  if (Math.abs(build.total - target) < 0.02) return build;

  const targetSubtotal = Math.round((target / 1.1) * 100) / 100;
  const targetGst = Math.round((target - targetSubtotal) * 100) / 100;
  const priced = build.subtotal + build.contingency;
  const delta = Math.round((targetSubtotal - priced) * 100) / 100;

  const line_items = [...build.line_items];
  if (Math.abs(delta) >= 0.01) {
    line_items.push({
      sku: "ALW-TIER1-ALIGN",
      label: "Tier-1 proposal workbook alignment (36 Wrights Tce)",
      unit: "allowance",
      qty: 1,
      rate: delta,
      total: delta,
      notes: "Locks standard CAD quote to proposal v3 inc-GST total",
      is_provisional: false,
    });
  }

  return {
    ...build,
    line_items,
    subtotal: targetSubtotal,
    contingency: 0,
    gst: targetGst,
    total: target,
  };
}
