/**
 * Landscape-ops schedules from DesignCanvas tip — planting, trench, lighting, material.
 * Indicative Workflow 1; honesty footers travel with every export.
 */

import type {
  CatalogPlacement,
  CatalogSymbol,
  ConstructionTrench,
  ConstructionTrenchKind,
  DesignCanvas,
  IrrigationZone,
  LineItem,
  RateCard,
} from "@workstream/contracts";
import { plantPalette } from "./seeds";
import {
  polylineLengthFromCanvasPercent,
  type CanvasGroundScale,
} from "./canvas-geometry";
import {
  assessLvCircuit,
  DEFAULT_TRANSFORMER_VA,
  DEFAULT_WIRE_GAUGE,
  fixtureWattage,
  type LvWireGauge,
} from "./lv-lighting";
import { isLightingSymbolId } from "./landscape-services";
import { CURTIS_DESIGN_ASSETS } from "./catalog-assets";

export const PLANTING_SCHEDULE_HONESTY =
  "Indicative planting schedule from board placements — confirm pot size and spacing on site / with nursery.";

export const TRENCH_SCHEDULE_HONESTY =
  "Indicative dig lengths and depth bands — not BYDA / authority asset plans. Confirm before dig.";

export const LIGHTING_SCHEDULE_HONESTY =
  "Indicative LV load and cable sizing — confirm with electrician before procurement.";

export const MATERIAL_SCHEDULE_HONESTY =
  "Orderable material schedule from live BOM / rate card — supplier adapters optional.";

export type PlantingScheduleRow = {
  symbol_id: string;
  species: string;
  common_name: string;
  count: number;
  pot_form: string;
  spacing_m: number | null;
  /** Nursery container size (L) from the palette — null when unknown. */
  pot_size_l: number | null;
  rate_card_sku: string | null;
};

export type PlantingSchedule = {
  rows: PlantingScheduleRow[];
  honesty: string;
};

export type TrenchScheduleRow = {
  id: string;
  name: string;
  kind: ConstructionTrenchKind;
  length_m: number;
  depth_mm: number;
  depth_band: string;
  source: string;
};

export type TrenchSchedule = {
  rows: TrenchScheduleRow[];
  honesty: string;
};

export type LightingScheduleRow = {
  fixture_symbol_id: string;
  label: string;
  count: number;
  watts_each: number;
  design_va: number;
  suggested_gauge: LvWireGauge;
  run_length_m: number;
  voltage_drop_note: string;
};

export type LightingSchedule = {
  rows: LightingScheduleRow[];
  aggregate_design_va: number;
  transformer_va: number;
  honesty: string;
};

export type MaterialScheduleRow = {
  sku: string;
  label: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
  rate_source: "rate_card" | "quote_line";
  /** Rate-card supplier when known; TBA when unset — never invent a trade account. */
  supplier: string | null;
};

export type MaterialSchedule = {
  rows: MaterialScheduleRow[];
  honesty: string;
};

export const SUPPLIER_ORDER_HONESTY =
  "Supplier order / delivery request from live quote lines — confirm availability and lead times with the trade account before placing.";

const DEPTH_BAND: Record<ConstructionTrenchKind, string> = {
  irrig_main: "350–450 mm",
  irrig_lateral: "200–300 mm",
  lighting_conduit: "250–350 mm",
  drainage: "400–500 mm",
};

const SPACING_BY_FORM: Record<string, number> = {
  bed: 0.4,
  hedge: 0.6,
  feature: 1.5,
  canopy: 4,
  lawn: 0,
};

/** Count of leading words two strings share (e.g. "lomandra longifolia" vs
 *  "lomandra" → 1; "lomandra longifolia 'tanika'" vs "lomandra longifolia" → 2). */
function sharedWordPrefixLen(a: string, b: string): number {
  const wa = a.split(/\s+/);
  const wb = b.split(/\s+/);
  let n = 0;
  while (n < wa.length && n < wb.length && wa[n] === wb[n]) n += 1;
  return n;
}

function matchPalette(botanical: string | undefined, label: string) {
  const bot = (botanical ?? "").toLowerCase();
  const lab = label.toLowerCase();
  const direct = plantPalette.find(
    (p) =>
      p.species.toLowerCase().includes(bot.split("'")[0]!.trim()) ||
      p.common_name.toLowerCase() === lab ||
      lab.includes(p.common_name.toLowerCase().slice(0, 12)),
  );
  if (direct) return direct;

  // Genus fallback — the catalog botanical may add a species epithet the
  // palette omits (e.g. catalog "Lomandra longifolia 'Tanika'" vs palette
  // "Lomandra 'Tanika'"). Match the palette species sharing the most leading
  // words, so a cultivar resolves to its own entry rather than a bare genus.
  const genus = bot.split(/\s+/)[0];
  if (!genus || genus.length < 3) return null;
  let best: (typeof plantPalette)[number] | null = null;
  let bestLen = 0;
  for (const p of plantPalette) {
    const ps = p.species.toLowerCase();
    if (!ps.startsWith(genus)) continue;
    const shared = sharedWordPrefixLen(ps, bot);
    if (shared > bestLen) {
      best = p;
      bestLen = shared;
    }
  }
  return best;
}

/** Aggregate planting placements × Curtis catalog / palette → nursery order rows. */
export function buildPlantingSchedule(
  canvas: Pick<DesignCanvas, "placements">,
  symbols: CatalogSymbol[] = CURTIS_DESIGN_ASSETS,
): PlantingSchedule {
  const bySymbol = new Map<string, CatalogPlacement[]>();
  const symMap = new Map(symbols.map((s) => [s.id, s]));
  for (const p of canvas.placements ?? []) {
    const sym = symMap.get(p.symbol_id);
    if (!sym || sym.category !== "planting") continue;
    if (p.symbol_id === "existing-tree-retain") continue;
    const list = bySymbol.get(p.symbol_id) ?? [];
    list.push(p);
    bySymbol.set(p.symbol_id, list);
  }

  const rows: PlantingScheduleRow[] = [];
  for (const [symbolId, list] of bySymbol) {
    const sym = symMap.get(symbolId)!;
    const pal = matchPalette(sym.botanical_name, sym.label);
    const form =
      pal?.form ??
      (sym.keywords?.includes("hedge")
        ? "Hedge"
        : sym.keywords?.includes("grass")
          ? "Mass / pot"
          : "Container");
    const studioForm = sym.keywords?.includes("hedge")
      ? "hedge"
      : sym.id.includes("lawn")
        ? "lawn"
        : sym.mature_height_m && sym.mature_height_m >= 3
          ? "canopy"
          : "bed";
    rows.push({
      symbol_id: symbolId,
      species: pal?.species ?? sym.botanical_name ?? sym.label,
      common_name: pal?.common_name ?? sym.label,
      count: list.length,
      pot_form: form,
      // Palette spacing/pot size win over form-based defaults when the
      // species record carries them (open-source-enriched seed library).
      spacing_m: pal?.spacing_m ?? SPACING_BY_FORM[studioForm] ?? 0.5,
      pot_size_l: pal?.pot_size_l ?? null,
      rate_card_sku: sym.rate_card_sku ?? null,
    });
  }
  rows.sort((a, b) => a.common_name.localeCompare(b.common_name, "en-AU"));
  return { rows, honesty: PLANTING_SCHEDULE_HONESTY };
}

/** Accepted construction trenches → dig schedule (indicative m + depth band). */
/** Convenience scale: board width metres maps to 100% X (square board). */
export function boardWidthScale(widthM = 20): CanvasGroundScale {
  const px = 1000;
  return {
    canvasWidthPx: px,
    canvasHeightPx: px,
    metresPerXPx: widthM / px,
    metresPerYPx: widthM / px,
  };
}

export function buildTrenchSchedule(
  canvas: Pick<DesignCanvas, "construction_trenches">,
  scale: CanvasGroundScale = boardWidthScale(20),
): TrenchSchedule {
  const rows: TrenchScheduleRow[] = [];
  for (const t of canvas.construction_trenches ?? []) {
    if (t.ghost) continue;
    const length_m = Number(
      polylineLengthFromCanvasPercent(t.points, scale).toFixed(2),
    );
    rows.push({
      id: t.id,
      name: t.name,
      kind: t.kind,
      length_m,
      depth_mm: t.depth_mm,
      depth_band: DEPTH_BAND[t.kind] ?? `${t.depth_mm} mm`,
      source: t.source,
    });
  }
  return { rows, honesty: TRENCH_SCHEDULE_HONESTY };
}

/** LV fixtures + conduit runs → cable / VA schedule for electrician review. */
export function buildLightingSchedule(
  canvas: Pick<DesignCanvas, "placements" | "irrigation_zones" | "construction_trenches">,
  symbols: CatalogSymbol[] = CURTIS_DESIGN_ASSETS,
  scale: CanvasGroundScale = boardWidthScale(20),
): LightingSchedule {
  const symMap = new Map(symbols.map((s) => [s.id, s]));
  const fixtures = (canvas.placements ?? [])
    .filter((p) => isLightingSymbolId(p.symbol_id))
    .map((p) => ({
      id: p.id,
      symbolId: p.symbol_id,
      x: p.x_pct,
      y: p.y_pct,
      rot: p.rotation_deg,
    }));

  const zones: IrrigationZone[] = canvas.irrigation_zones ?? [];
  const lightingZones = zones.filter(
    (z) => z.kind === "lighting" || z.kind === "lighting_conduit",
  );
  const conduitTrenches = (canvas.construction_trenches ?? []).filter(
    (t: ConstructionTrench) => t.kind === "lighting_conduit" && !t.ghost,
  );

  let runLengthM = 0;
  for (const z of lightingZones) {
    if (z.points.length >= 2) {
      runLengthM += polylineLengthFromCanvasPercent(z.points, scale);
    }
  }
  for (const t of conduitTrenches) {
    runLengthM += polylineLengthFromCanvasPercent(t.points, scale);
  }
  if (runLengthM < 1 && fixtures.length > 0) {
    runLengthM = Math.max(8, fixtures.length * 3);
  }

  const assessment = assessLvCircuit({
    fixtures,
    runLengthM,
    transformerVa: DEFAULT_TRANSFORMER_VA,
    wireGauge: DEFAULT_WIRE_GAUGE,
  });

  const bySym = new Map<string, number>();
  for (const f of fixtures) {
    bySym.set(f.symbolId, (bySym.get(f.symbolId) ?? 0) + 1);
  }

  const rows: LightingScheduleRow[] = [];
  for (const [symbolId, count] of bySym) {
    const w = fixtureWattage(symbolId);
    const designVa = Math.round(count * w * 1.2);
    rows.push({
      fixture_symbol_id: symbolId,
      label: symMap.get(symbolId)?.label ?? symbolId,
      count,
      watts_each: w,
      design_va: designVa,
      suggested_gauge: assessment.wireGauge,
      run_length_m: Number(runLengthM.toFixed(1)),
      voltage_drop_note: assessment.dropWarn
        ? `Voltage drop ~${assessment.voltageDropPct.toFixed(1)}% — review run length / gauge`
        : `Voltage drop ~${assessment.voltageDropPct.toFixed(1)}% (indicative)`,
    });
  }

  return {
    rows,
    aggregate_design_va: Math.round(assessment.designLoadW),
    transformer_va: assessment.transformerVa,
    honesty: LIGHTING_SCHEDULE_HONESTY,
  };
}

/** Live BOM / quote lines → orderable material schedule (rate-card sourced). */
export function buildMaterialSchedule(input: {
  lineItems?: LineItem[];
  rateCard?: RateCard[];
}): MaterialSchedule {
  const bySku = new Map(
    (input.rateCard ?? []).map((r) => [r.sku, r] as const),
  );
  const rows: MaterialScheduleRow[] = [];
  for (const line of input.lineItems ?? []) {
    const rate = bySku.get(line.sku);
    rows.push({
      sku: line.sku,
      label: line.label,
      qty: line.qty,
      unit: line.unit,
      rate: line.rate,
      total: line.total,
      rate_source: "quote_line",
      supplier: rate?.supplier?.trim() || null,
    });
  }
  if (rows.length === 0 && input.rateCard?.length) {
    /* Empty BOM — nothing to order yet. */
  }
  rows.sort((a, b) => a.sku.localeCompare(b.sku, "en-AU"));
  return { rows, honesty: MATERIAL_SCHEDULE_HONESTY };
}

export type SupplierOrderGroup = {
  supplier: string;
  rows: MaterialScheduleRow[];
};

export type SupplierOrderSheet = {
  groups: SupplierOrderGroup[];
  unassigned: MaterialScheduleRow[];
  honesty: string;
  line_count: number;
};

/** Group live quote lines by rate-card supplier for trade order / delivery sheets. */
export function buildSupplierOrderSheet(input: {
  lineItems?: LineItem[];
  rateCard?: RateCard[];
}): SupplierOrderSheet {
  const schedule = buildMaterialSchedule(input);
  const bySupplier = new Map<string, MaterialScheduleRow[]>();
  const unassigned: MaterialScheduleRow[] = [];
  for (const row of schedule.rows) {
    const supplier = row.supplier?.trim();
    if (!supplier) {
      unassigned.push(row);
      continue;
    }
    const list = bySupplier.get(supplier) ?? [];
    list.push(row);
    bySupplier.set(supplier, list);
  }
  const groups = [...bySupplier.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "en-AU"))
    .map(([supplier, rows]) => ({ supplier, rows }));
  return {
    groups,
    unassigned,
    honesty: SUPPLIER_ORDER_HONESTY,
    line_count: schedule.rows.length,
  };
}

/** Markdown trade order / delivery request — same commercial truth as the quote. */
export function supplierOrderSheetMarkdown(
  sheet: SupplierOrderSheet,
  meta: { address: string; generatedOn?: string },
): string {
  const lines: string[] = [];
  const day = meta.generatedOn ?? new Date().toISOString().slice(0, 10);
  lines.push(`# Supplier order / delivery request — ${meta.address}`);
  lines.push("");
  lines.push(`Generated ${day}.`);
  lines.push("");
  lines.push(`_${sheet.honesty}_`);
  lines.push("");
  if (sheet.line_count === 0) {
    lines.push("_No quote / BOM lines to order yet._");
    lines.push("");
    return lines.join("\n");
  }

  const emitTable = (rows: MaterialScheduleRow[]) => {
    lines.push("| SKU | Item | Qty | Unit | Indicative rate |");
    lines.push("|-----|------|-----|------|-----------------|");
    for (const r of rows) {
      lines.push(
        `| ${r.sku} | ${r.label} | ${r.qty} | ${r.unit} | ${r.rate.toFixed(2)} |`,
      );
    }
    lines.push("");
  };

  for (const group of sheet.groups) {
    lines.push(`## ${group.supplier}`);
    lines.push("");
    lines.push("### Order list");
    lines.push("");
    emitTable(group.rows);
    lines.push("### Delivery request");
    lines.push("");
    lines.push(
      `- Deliver to: ${meta.address} (confirm access, drop zone, and site contact).`,
    );
    lines.push(
      `- Requested materials: ${group.rows.length} line(s) as listed above.`,
    );
    lines.push("- Preferred window: TBA — confirm with site supervisor.");
    lines.push("- Note: quantities from live quote; confirm pack sizes before dispatch.");
    lines.push("");
  }

  if (sheet.unassigned.length > 0) {
    lines.push("## Supplier TBA");
    lines.push("");
    lines.push(
      "Rate card has no supplier for these SKUs — assign a trade account before placing the order.",
    );
    lines.push("");
    lines.push("### Order list");
    lines.push("");
    emitTable(sheet.unassigned);
    lines.push("### Delivery request");
    lines.push("");
    lines.push(
      `- Deliver to: ${meta.address} (confirm access, drop zone, and site contact).`,
    );
    lines.push(
      `- Requested materials: ${sheet.unassigned.length} line(s) — supplier still TBA.`,
    );
    lines.push("- Preferred window: TBA — confirm with site supervisor.");
    lines.push("");
  }

  lines.push(
    "> Not a fake brochure. Lines come from the live quote / BOM. Live supplier price APIs are out of scope — confirm with the trade account.",
  );
  return lines.join("\n");
}

/** CSV helpers for schedule export. */
export function scheduleToCsv(
  headers: string[],
  rows: Array<Record<string, string | number | null | undefined>>,
): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function plantingScheduleCsv(sched: PlantingSchedule): string {
  return scheduleToCsv(
    ["species", "common_name", "count", "pot_form", "pot_size_l", "spacing_m", "rate_card_sku"],
    sched.rows.map((r) => ({
      species: r.species,
      common_name: r.common_name,
      count: r.count,
      pot_form: r.pot_form,
      pot_size_l: r.pot_size_l,
      spacing_m: r.spacing_m,
      rate_card_sku: r.rate_card_sku,
    })),
  );
}

export function trenchScheduleCsv(sched: TrenchSchedule): string {
  return scheduleToCsv(
    ["name", "kind", "length_m", "depth_mm", "depth_band", "source"],
    sched.rows.map((r) => ({
      name: r.name,
      kind: r.kind,
      length_m: r.length_m,
      depth_mm: r.depth_mm,
      depth_band: r.depth_band,
      source: r.source,
    })),
  );
}

export function lightingScheduleCsv(sched: LightingSchedule): string {
  return scheduleToCsv(
    [
      "label",
      "count",
      "watts_each",
      "design_va",
      "suggested_gauge",
      "run_length_m",
      "voltage_drop_note",
    ],
    sched.rows.map((r) => ({
      label: r.label,
      count: r.count,
      watts_each: r.watts_each,
      design_va: r.design_va,
      suggested_gauge: r.suggested_gauge,
      run_length_m: r.run_length_m,
      voltage_drop_note: r.voltage_drop_note,
    })),
  );
}

export function materialScheduleCsv(sched: MaterialSchedule): string {
  return scheduleToCsv(
    ["sku", "label", "qty", "unit", "rate", "total", "rate_source", "supplier"],
    sched.rows.map((r) => ({
      sku: r.sku,
      label: r.label,
      qty: r.qty,
      unit: r.unit,
      rate: r.rate,
      total: r.total,
      rate_source: r.rate_source,
      supplier: r.supplier,
    })),
  );
}
