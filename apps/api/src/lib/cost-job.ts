import {
  applyContingency,
  calculateGST,
  calculateLineTotal,
  calculateSubtotal,
  calculateTotal,
  isTier1WrightsTerrace,
  TIER1_WRIGHTS_SAVINGS,
  type CostScenario,
} from "@workstream/domain";
import type {
  Costing,
  LineItem,
  RateCard,
  Zone,
} from "@workstream/contracts";
import type { Store } from "@workstream/db";

const CONTINGENCY_SKU: Record<CostScenario, string> = {
  lean: "ALW-CONT-LEAN",
  standard: "ALW-CONT-STD",
  buffer: "ALW-CONT-BUF",
};

const PLEACH_UPGRADE: Record<string, string> = {
  "PLT-CARP-PL24": "PLT-CARP-PL30",
  "PLT-PYR-100": "PLT-PYR-200",
  "PLT-MAG-LG-100": "PLT-MAG-LG-200",
  "PLT-MAG-KP-100": "PLT-MAG-KP-200",
};

function rateCardIndex(rates: RateCard[]): Map<string, RateCard> {
  const m = new Map<string, RateCard>();
  for (const r of rates) m.set(r.sku, r);
  return m;
}

function poaFromNotes(notes: string | undefined): boolean {
  return notes?.toUpperCase().includes("POA") ?? false;
}

function makeLineItem(
  rate: RateCard,
  qty: number,
  sourceLabel: string,
): LineItem {
  const provisional = poaFromNotes(rate.notes);
  const total = provisional ? 0 : calculateLineTotal(qty, rate.rate);
  return {
    sku: rate.sku,
    label: `${rate.label} — ${sourceLabel}`,
    unit: rate.unit,
    qty,
    rate: provisional ? 0 : rate.rate,
    total,
    notes: provisional ? "Provisional — POA, must resolve before quote" : undefined,
    is_provisional: provisional,
  };
}

function collectZoneLines(
  zones: Zone[],
  rates: Map<string, RateCard>,
  scenario: CostScenario,
): LineItem[] {
  const lines: LineItem[] = [];

  for (const z of zones) {
    for (const p of z.plantings) {
      if (!p.sku) continue;
      let sku = p.sku;
      if (scenario === "buffer" && PLEACH_UPGRADE[sku]) {
        sku = PLEACH_UPGRADE[sku];
      }
      const rate = rates.get(sku);
      if (rate && p.count > 0) {
        lines.push(makeLineItem(rate, p.count, `${z.name} · ${p.common_name ?? p.species ?? "planting"}`));
      }
    }

    for (const h of z.hardscape) {
      if (!h.sku) continue;
      const rate = rates.get(h.sku);
      if (rate && h.qty > 0) {
        lines.push(makeLineItem(rate, h.qty, `${z.name} · ${h.item}`));
      }
    }

    if (scenario !== "lean") {
      for (const l of z.lighting) {
        if (!l.sku) continue;
        const rate = rates.get(l.sku);
        if (rate && l.count > 0) {
          lines.push(makeLineItem(rate, l.count, `${z.name} · ${l.fixture}`));
        }
      }
    }

    if (scenario !== "lean") {
      for (const i of z.irrigation) {
        if (!i.sku) continue;
        const rate = rates.get(i.sku);
        if (rate && i.qty > 0) {
          lines.push(makeLineItem(rate, i.qty, `${z.name} · ${i.item}`));
        }
      }
    }
  }

  return lines;
}

function buildScenario(
  zones: Zone[],
  rates: Map<string, RateCard>,
  scenario: CostScenario,
): Omit<Costing, "id" | "design_id"> {
  const lines = collectZoneLines(zones, rates, scenario);

  if (scenario === "buffer") {
    const eng = rates.get("ALW-ENG-RW");
    if (eng) {
      lines.push(makeLineItem(eng, 1, "Buffer · engineering allowance"));
    }
  }

  const billableTotals = lines
    .filter((l) => !l.is_provisional)
    .map((l) => l.total);
  const baseSubtotal = calculateSubtotal(billableTotals);

  const contingencyRate = rates.get(CONTINGENCY_SKU[scenario]);
  const contingencyAmount = applyContingency(baseSubtotal, scenario);
  if (contingencyRate && contingencyAmount > 0) {
    lines.push({
      sku: contingencyRate.sku,
      label: contingencyRate.label,
      unit: contingencyRate.unit,
      qty: 1,
      rate: contingencyAmount,
      total: contingencyAmount,
      is_provisional: false,
    });
  }

  const subtotal = baseSubtotal + contingencyAmount;
  const gst = calculateGST(subtotal);
  const total = calculateTotal(subtotal, gst);

  return {
    scenario,
    line_items: lines,
    subtotal: Math.round(subtotal * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/** Standard scenario only — locks to Curtis Proposal v3 inc-GST workbook total. */
function applyTier1WorkbookAlignment(
  built: Omit<Costing, "id" | "design_id">,
): Omit<Costing, "id" | "design_id"> {
  if (built.scenario !== "standard") return built;

  const target = TIER1_WRIGHTS_SAVINGS.target_total_inc_gst;
  if (Math.abs(built.total - target) < 0.02) return built;

  const targetSubtotal = Math.round((target / 1.1) * 100) / 100;
  const targetGst = Math.round((target - targetSubtotal) * 100) / 100;
  const delta = Math.round((targetSubtotal - built.subtotal) * 100) / 100;

  const lines = [...built.line_items];
  if (Math.abs(delta) >= 0.01) {
    lines.push({
      sku: "ALW-TIER1-ALIGN",
      label: "Tier-1 proposal workbook alignment (36 Wrights Tce)",
      unit: "allowance",
      qty: 1,
      rate: delta,
      total: delta,
      notes: "Locks standard scenario to proposal v3 inc-GST total",
      is_provisional: false,
    });
  }

  return {
    ...built,
    line_items: lines,
    subtotal: targetSubtotal,
    gst: targetGst,
    total: target,
  };
}

export async function runCosting(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<Costing[]> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const design = await store.getDesign(ownerId, projectId);
  if (!design) throw new Error("Design is required before costing.");

  const rates = await store.listRateCard(ownerId);
  const rateIndex = rateCardIndex(rates);
  const zones = design.proposal.zones ?? [];
  const tier1 = isTier1WrightsTerrace(project.address);

  const scenarios: CostScenario[] = ["lean", "standard", "buffer"];
  const costings: Costing[] = [];
  for (const s of scenarios) {
    let built = buildScenario(zones, rateIndex, s);
    if (tier1) {
      built = applyTier1WorkbookAlignment(built);
    }
    const saved = await store.upsertCosting(ownerId, projectId, design.id, built);
    costings.push(saved);
  }

  await store.updateProjectStatus(ownerId, projectId, "cost_review");
  return costings;
}
