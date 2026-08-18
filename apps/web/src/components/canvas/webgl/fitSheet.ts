/**
 * Gold Standard 2026 — Fit-Sheet math (live itemized quotation summary).
 *
 * Pure module: converts what the WebGL studio already holds (RenderItem
 * geometry, trenches, zones, boundary) into the domain estimate args, and
 * summarises the resulting StudioEstimateReport + TradeTelemetry into the
 * shape the FitSheetCard renders — sections, totals, stats, stock lines,
 * and the procurement alert.
 *
 * Everything is client-side and derived from geometry, so the sheet is
 * live-synced to the canvas by construction (the estimate hook recomputes
 * on every items/trench/zone change). No fetch, no persistence — provisional
 * figures with the standard honesty line.
 *
 * Reused domain engines (no SVG-studio coupling):
 *   - BY_TYPE (handoff/studioCatalog) — per-type rate/size metrics for
 *     estimateStudioDrawing's metaByType
 *   - sectionForEstimateTier (resolve-quote) — line → quote section
 *   - solveLiveTradeEstimate (live-trade-sourcing) — hub offers + stock
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 3 (Itemized Fit-Sheet)
 */

import type {
  StudioComplianceItem,
  StudioEstimateLine,
  StudioEstimateReport,
  TradeTelemetry,
} from "@workstream/domain";
import { sectionForEstimateTier } from "@workstream/domain";
import type { QuoteSectionId } from "@workstream/contracts";
import type { StudioEstimateArgs } from "../../../lib/studio-estimate-worker-types";
import type { RenderItem } from "./sceneItems";
import type { PctPoint } from "./coordTransform";
import type { ConstructionTrench, IrrigationZone } from "@workstream/contracts";
import { BY_TYPE } from "../handoff/studioCatalog";

const SECTION_LABEL: Record<QuoteSectionId, string> = {
  sitework: "Sitework",
  hardscape: "Hardscape",
  planting: "Planting",
  drainage: "Drainage",
  provisional: "Provisional",
  custom: "Custom",
};

const SECTION_ORDER: QuoteSectionId[] = [
  "sitework",
  "hardscape",
  "planting",
  "drainage",
  "provisional",
  "custom",
];

/** AUD money format — $1,234.56. */
export function fmtAud(n: number): string {
  return `$${n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Build the domain estimate args from WebGL studio props. RenderItem is a
 * structural subset of StudioComplianceItem ({id,t,x,y,scale,ghost}), so the
 * mapping is a pick; metaByType comes straight from BY_TYPE.
 */
export function buildEstimateArgsFromStudio(args: {
  items: RenderItem[];
  boundaryPct: PctPoint[];
  constructionTrenches: ConstructionTrench[];
  irrigationZones: IrrigationZone[];
  scaleM: number;
  outdoorM2: number;
}): StudioEstimateArgs {
  // "bollard" has no estimate-engine type or BY_TYPE rate (StudioItemType /
  // StudioComplianceItemType both lack it) — excluded rather than guessed.
  const items: StudioComplianceItem[] = args.items
    .filter((it): it is RenderItem & { t: StudioComplianceItem["t"] } =>
      it.t !== "bollard",
    )
    .map((it) => ({
      id: it.id,
      t: it.t,
      x: it.x,
      y: it.y,
      scale: it.scale,
      ghost: it.ghost,
    }));

  const metaByType: StudioEstimateArgs["metaByType"] = {};
  for (const t of Object.keys(BY_TYPE) as Array<keyof typeof BY_TYPE>) {
    const d = BY_TYPE[t];
    metaByType[t] = {
      rate: d.rate,
      wPx: d.w,
      hPx: d.h,
      areaKind: d.area ?? "none",
      heightM: d.heightM,
      lin: d.lin,
      existing: d.existing,
      dbhM: d.dbhM,
      canopyM: d.canopyM,
    };
  }

  return {
    outdoorM2: args.outdoorM2,
    boundary: args.boundaryPct,
    items,
    metaByType,
    accessConstrained: args.outdoorM2 > 400,
    scaleM: args.scaleM,
    irrigationZones: args.irrigationZones,
    constructionTrenches: args.constructionTrenches.filter((t) => !t.ghost),
  };
}

/** Round to cents — mirrors the engine's own total rounding. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Exclude estimate lines by line id AFTER the engine runs. The report's
 * money fields are exact sums of the line totals
 * (studio-preemptive-estimate.ts:849), so subtotal/GST/total recompute from
 * the filtered set with the engine's own formula — exact and honest. Unknown
 * ids are ignored (a stale exclusion never phantoms). Pure — the
 * estimation-dock spec §4 filtering point.
 */
export function excludeEstimateLines(
  estimate: StudioEstimateReport,
  excludedIds: ReadonlySet<string>,
): StudioEstimateReport {
  if (excludedIds.size === 0) return estimate;
  const lines = estimate.lines.filter((l) => !excludedIds.has(l.id));
  if (lines.length === estimate.lines.length) return estimate;
  const materialsExGst = round2(lines.reduce((s, l) => s + l.total, 0));
  const gst = round2(materialsExGst * 0.1);
  return {
    ...estimate,
    lines,
    materialsExGst,
    gst,
    totalInclGst: round2(materialsExGst + gst),
  };
}

/** One stock-pulse row — a trade-matched line with its hub offer status. */
export interface StockLine {
  estimateLineId: string;
  label: string;
  qty: number;
  unit: string;
  hubLabel: string;
  inStock: boolean;
  mode: "live_matched" | "ai_estimated";
}

/** One fit-sheet section (quote-section grouping of estimate lines). */
export interface FitSheetSection {
  id: QuoteSectionId;
  label: string;
  lines: StudioEstimateLine[];
  subtotal: number;
}

export interface FitSheetSummary {
  sections: FitSheetSection[];
  /** Lines sorted by total desc — the "top items" rows. */
  topLines: Array<{ line: StudioEstimateLine; section: QuoteSectionId }>;
  subtotal: number;
  gst: number;
  total: number;
  stats: {
    hardscapeM2: number;
    excavateM3: number;
    spoilTonnes: number;
    tipperLoads: number;
  };
  stockLines: StockLine[];
  /** True when any live-matched offer is out of stock (procurement alert). */
  procurementAlert: string | null;
  lowStockCount: number;
}

/**
 * Summarise the estimate + trade telemetry into the render shape.
 * Returns null when there are no estimate lines (empty canvas).
 */
export function summarizeFitSheet(
  estimate: StudioEstimateReport,
  telemetry: TradeTelemetry | null,
): FitSheetSummary | null {
  if (estimate.lines.length === 0) return null;

  const bySection = new Map<QuoteSectionId, StudioEstimateLine[]>();
  for (const line of estimate.lines) {
    const section = sectionForEstimateTier(line.tier, line.label);
    const bucket = bySection.get(section);
    if (bucket) bucket.push(line);
    else bySection.set(section, [line]);
  }

  const sections: FitSheetSection[] = [];
  for (const id of SECTION_ORDER) {
    const lines = bySection.get(id);
    if (!lines || lines.length === 0) continue;
    sections.push({
      id,
      label: SECTION_LABEL[id],
      lines,
      subtotal: lines.reduce((s, l) => s + l.total, 0),
    });
  }

  const topLines = [...estimate.lines]
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((line) => ({
      line,
      section: sectionForEstimateTier(line.tier, line.label),
    }));

  const stockLines: StockLine[] = (telemetry?.matchedLines ?? []).map((m) => ({
    estimateLineId: m.estimateLineId,
    label: m.offer.label,
    qty: m.qty,
    unit: m.unit,
    hubLabel: m.offer.hubLabel,
    inStock: m.offer.inStock,
    mode: m.mode,
  }));

  const lowStock = stockLines.filter((s) => s.mode === "live_matched" && !s.inStock);
  const procurementAlert =
    lowStock.length > 0
      ? `${lowStock[0]!.label} stock is low at matched hubs — approval within 48h secures allocation.`
      : null;

  return {
    sections,
    topLines,
    subtotal: estimate.materialsExGst,
    gst: estimate.gst,
    total: estimate.totalInclGst,
    stats: {
      hardscapeM2: estimate.hardscapeM2,
      excavateM3: estimate.excavateM3,
      spoilTonnes: estimate.spoilTonnes,
      tipperLoads: estimate.tipperLoads,
    },
    stockLines,
    procurementAlert,
    lowStockCount: lowStock.length,
  };
}
