/**
 * Live Trade Sourcing — deterministic Melbourne trade match for canvas HUD.
 * Workflow 1: cached hub catalog + historical fallback (no live supplier APIs).
 */

import { calculateGST } from "./costing";
import type { StudioEstimateReport } from "./studio-preemptive-estimate";

export type TradeHubId =
  | "plantmark_wantirna"
  | "plantmark_thomastown"
  | "dinsan_dingley"
  | "warners"
  | "speciality_trees"
  | "lilydale_lawn"
  | "anco"
  | "soilco"
  | "anl";

export type TradeMatchMode = "live_matched" | "ai_estimated";

export type MelbourneTradeOffer = {
  hubId: TradeHubId;
  hubLabel: string;
  sku: string;
  label: string;
  botanicalOrSpec: string;
  container: string;
  unit: string;
  wholesaleExGst: number;
  inStock: boolean;
  /** Rough km from Prahran CBD for freight band. */
  hubKmFromPrahran: number;
  /** Studio item types this offer can price. */
  studioTypes: string[];
};

export type TradeLineMatch = {
  estimateLineId: string;
  sourceIds: string[];
  studioHint: string;
  qty: number;
  unit: string;
  offer: MelbourneTradeOffer;
  tierMultiplier: number;
  lineExGst: number;
  mode: TradeMatchMode;
  alternatives: MelbourneTradeOffer[];
};

export type TradeTelemetry = {
  mode: TradeMatchMode;
  matchedLines: TradeLineMatch[];
  materialsTradeExGst: number;
  freightExGst: number;
  tradeExGst: number;
  gst: number;
  totalInclGst: number;
  /** Fraction of primary lines that matched a hub offer. */
  matchRatio: number;
  budgetLimitAud: number | null;
  overBudget: boolean;
  honesty: string;
};

/** Default contractor trade multiplier (Stage 2: account profile). */
export const DEFAULT_TRADE_TIER = 1;

/** Historical Melbourne SE index when catalog miss (2025–2026 shaped). */
export const MELBOURNE_COST_INDEX = 1.04;

const FREIGHT_PER_KM = 2.4;
const FREIGHT_BASE = 85;

/**
 * Cached Melbourne trade hub offers — shaped like hourly wholesale sync.
 * Not live Plantmark/Dinsan APIs (Stage 2).
 */
export const MELBOURNE_TRADE_CATALOG: MelbourneTradeOffer[] = [
  {
    hubId: "dinsan_dingley",
    hubLabel: "Dinsan Nursery · Dingley Village",
    sku: "DIN-SYZ-45",
    label: "Syzygium australe",
    botanicalOrSpec: "Syzygium australe",
    container: "45L bag",
    unit: "ea",
    wholesaleExGst: 185,
    inStock: true,
    hubKmFromPrahran: 22,
    studioTypes: ["hedge", "feature"],
  },
  {
    hubId: "warners",
    hubLabel: "Warners Nurseries",
    sku: "WAR-SYZ-45",
    label: "Syzygium australe",
    botanicalOrSpec: "Syzygium australe",
    container: "45L bag",
    unit: "ea",
    wholesaleExGst: 198,
    inStock: true,
    hubKmFromPrahran: 28,
    studioTypes: ["hedge", "feature"],
  },
  {
    hubId: "plantmark_wantirna",
    hubLabel: "Plantmark · Wantirna",
    sku: "PMK-CARP-100",
    label: "Pleached hornbeam",
    botanicalOrSpec: "Carpinus betulus",
    container: "100L advanced",
    unit: "ea",
    wholesaleExGst: 465,
    inStock: true,
    hubKmFromPrahran: 32,
    studioTypes: ["hedge", "canopy"],
  },
  {
    hubId: "plantmark_thomastown",
    hubLabel: "Plantmark · Thomastown",
    sku: "PMK-CARP-100-T",
    label: "Pleached hornbeam",
    botanicalOrSpec: "Carpinus betulus",
    container: "100L advanced",
    unit: "ea",
    wholesaleExGst: 455,
    inStock: false,
    hubKmFromPrahran: 24,
    studioTypes: ["hedge", "canopy"],
  },
  {
    hubId: "speciality_trees",
    hubLabel: "Speciality Trees (trade)",
    sku: "SPT-OLI-200",
    label: "Olive standard",
    botanicalOrSpec: "Olea europaea",
    container: "200L",
    unit: "ea",
    wholesaleExGst: 420,
    inStock: true,
    hubKmFromPrahran: 18,
    studioTypes: ["canopy", "feature"],
  },
  {
    hubId: "plantmark_wantirna",
    hubLabel: "Plantmark · Wantirna",
    sku: "PMK-LOM-140",
    label: "Lomandra Tanika",
    botanicalOrSpec: "Lomandra longifolia 'Tanika'",
    container: "140mm",
    unit: "ea",
    wholesaleExGst: 10.5,
    inStock: true,
    hubKmFromPrahran: 32,
    studioTypes: ["bed"],
  },
  {
    hubId: "dinsan_dingley",
    hubLabel: "Dinsan Nursery · Dingley Village",
    sku: "DIN-BUX-200",
    label: "Buxus sphere",
    botanicalOrSpec: "Buxus sempervirens",
    container: "200mm",
    unit: "ea",
    wholesaleExGst: 24,
    inStock: true,
    hubKmFromPrahran: 22,
    studioTypes: ["feature", "hedge"],
  },
  {
    hubId: "anl",
    hubLabel: "ANL · Melbourne",
    sku: "ANL-BLUE-SAWN",
    label: "Bluestone sawn 30mm",
    botanicalOrSpec: "Bluestone paving 30 mm",
    container: "crate",
    unit: "m²",
    wholesaleExGst: 118,
    inStock: true,
    hubKmFromPrahran: 16,
    studioTypes: ["paving"],
  },
  {
    hubId: "anl",
    hubLabel: "ANL · Melbourne",
    sku: "ANL-BLUE-50",
    label: "Bluestone sawn 50mm",
    botanicalOrSpec: "Bluestone paving 50 mm",
    container: "crate",
    unit: "m²",
    wholesaleExGst: 148,
    inStock: true,
    hubKmFromPrahran: 16,
    studioTypes: ["paving"],
  },
  {
    hubId: "lilydale_lawn",
    hubLabel: "Lilydale Instant Lawn",
    sku: "LIL-SIR-ROLL",
    label: "Sir Walter turf",
    botanicalOrSpec: "Instant turf rolls",
    container: "pallet layer",
    unit: "m²",
    wholesaleExGst: 12.5,
    inStock: true,
    hubKmFromPrahran: 38,
    studioTypes: ["lawn"],
  },
  {
    hubId: "anco",
    hubLabel: "Anco Turf",
    sku: "ANC-TIF-ROLL",
    label: "TifTuf turf",
    botanicalOrSpec: "Instant turf rolls",
    container: "pallet layer",
    unit: "m²",
    wholesaleExGst: 14.2,
    inStock: true,
    hubKmFromPrahran: 26,
    studioTypes: ["lawn"],
  },
  {
    hubId: "soilco",
    hubLabel: "Soilco",
    sku: "SCO-MULCH-PINE",
    label: "Pine bark mulch",
    botanicalOrSpec: "Bulk organic mulch",
    container: "loose tipper",
    unit: "m³",
    wholesaleExGst: 72,
    inStock: true,
    hubKmFromPrahran: 30,
    studioTypes: ["bed"],
  },
  {
    hubId: "anl",
    hubLabel: "ANL · Melbourne",
    sku: "ANL-CR6",
    label: "CR6 crushed rock",
    botanicalOrSpec: "Compacted base",
    container: "loose tipper",
    unit: "t",
    wholesaleExGst: 62,
    inStock: true,
    hubKmFromPrahran: 16,
    studioTypes: ["paving", "deck"],
  },
  {
    hubId: "warners",
    hubLabel: "Warners Nurseries",
    sku: "WAR-DECK-SUP",
    label: "Deck timber supply",
    botanicalOrSpec: "Hardwood decking",
    container: "pack",
    unit: "m²",
    wholesaleExGst: 175,
    inStock: true,
    hubKmFromPrahran: 28,
    studioTypes: ["deck"],
  },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function studioHintFromLabel(label: string): string {
  const l = label.toLowerCase();
  if (/paving|bluestone/.test(l)) return "paving";
  if (/deck/.test(l)) return "deck";
  if (/turf|lawn/.test(l)) return "lawn";
  if (/hedge|pleach|hornbeam/.test(l)) return "hedge";
  if (/plant bed|planting|lomandra|mass/.test(l)) return "bed";
  if (/canopy|olive|tree/.test(l)) return "canopy";
  if (/feature/.test(l)) return "feature";
  if (/drain/.test(l)) return "frenchdrain";
  if (/crushed|CR6|excavation|bedding|joint|edge|labour|framing/i.test(label))
    return "assembly";
  return "other";
}

function offersForType(studioType: string): MelbourneTradeOffer[] {
  return MELBOURNE_TRADE_CATALOG.filter((o) =>
    o.studioTypes.includes(studioType),
  ).sort((a, b) => {
    // Prefer in-stock, then price, then proximity
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    if (a.wholesaleExGst !== b.wholesaleExGst)
      return a.wholesaleExGst - b.wholesaleExGst;
    return a.hubKmFromPrahran - b.hubKmFromPrahran;
  });
}

function syntheticOffer(
  studioHint: string,
  unit: string,
  rate: number,
): MelbourneTradeOffer {
  return {
    hubId: "anl",
    hubLabel: "Melbourne SE index",
    sku: `IDX-${studioHint.toUpperCase()}`,
    label: "Historical average",
    botanicalOrSpec: "Indexed trade average",
    container: "—",
    unit,
    wholesaleExGst: round2(rate * MELBOURNE_COST_INDEX),
    inStock: true,
    hubKmFromPrahran: 20,
    studioTypes: [studioHint],
  };
}

function freightForOffers(offers: MelbourneTradeOffer[]): number {
  if (offers.length === 0) return 0;
  const maxKm = Math.max(...offers.map((o) => o.hubKmFromPrahran));
  return round2(FREIGHT_BASE + maxKm * FREIGHT_PER_KM);
}

/**
 * Resolve live-trade telemetry from a continuous studio estimate.
 * When `forceUnverified` or no catalog hit, labels amber AI-estimated fallback.
 */
export function solveLiveTradeEstimate(args: {
  report: Pick<StudioEstimateReport, "lines" | "totalInclGst" | "materialsExGst">;
  tierMultiplier?: number;
  budgetLimitAud?: number | null;
  /** Simulate wholesale API drop → historical index. */
  forceUnverified?: boolean;
}): TradeTelemetry {
  const tier = args.tierMultiplier ?? DEFAULT_TRADE_TIER;
  const force = args.forceUnverified === true;
  const primary = args.report.lines.filter((l) => l.tier === "primary");
  const matchedLines: TradeLineMatch[] = [];
  let matchedCount = 0;

  for (const line of primary) {
    const hint = studioHintFromLabel(line.label);
    const alts = force ? [] : offersForType(hint);
    const best = alts[0];
    const mode: TradeMatchMode =
      !force && best ? "live_matched" : "ai_estimated";
    if (mode === "live_matched") matchedCount += 1;

    const offer =
      best ??
      syntheticOffer(hint, line.unit, line.rate);

    const lineExGst = round2(line.qty * offer.wholesaleExGst * tier);
    matchedLines.push({
      estimateLineId: line.id,
      sourceIds: line.sourceIds,
      studioHint: hint,
      qty: line.qty,
      unit: line.unit,
      offer,
      tierMultiplier: tier,
      lineExGst,
      mode,
      alternatives: alts.slice(1, 4),
    });
  }

  // Include secondary crushed rock when present (bulk logistics)
  for (const line of args.report.lines.filter((l) =>
    /CR6|crushed rock/i.test(l.label),
  )) {
    const alts = force ? [] : offersForType("paving").filter((o) =>
      /CR6|crushed/i.test(o.label),
    );
    const best = alts[0] ?? MELBOURNE_TRADE_CATALOG.find((o) => o.sku === "ANL-CR6");
    if (!best) continue;
    matchedLines.push({
      estimateLineId: line.id,
      sourceIds: line.sourceIds,
      studioHint: "assembly",
      qty: line.qty,
      unit: line.unit,
      offer: best,
      tierMultiplier: tier,
      lineExGst: round2(line.qty * best.wholesaleExGst * tier),
      mode: force ? "ai_estimated" : "live_matched",
      alternatives: [],
    });
    if (!force) matchedCount += 1;
  }

  const materialsTradeExGst = round2(
    matchedLines.reduce((s, m) => s + m.lineExGst, 0),
  );
  const hubOffers = matchedLines
    .filter((m) => m.mode === "live_matched")
    .map((m) => m.offer);
  const freightExGst = freightForOffers(hubOffers);
  const tradeExGst = round2(materialsTradeExGst + freightExGst);
  const gst = calculateGST(tradeExGst);
  const totalInclGst = round2(tradeExGst + gst);
  const matchRatio =
    primary.length === 0 ? 0 : matchedCount / primary.length;
  const mode: TradeMatchMode =
    force || matchRatio < 0.5 ? "ai_estimated" : "live_matched";
  const budget = args.budgetLimitAud ?? null;
  const overBudget = budget != null && totalInclGst > budget;

  return {
    mode,
    matchedLines,
    materialsTradeExGst,
    freightExGst,
    tradeExGst,
    gst,
    totalInclGst,
    matchRatio,
    budgetLimitAud: budget,
    overBudget,
    honesty:
      mode === "live_matched"
        ? "Cached Melbourne trade hubs — confirm stock with nursery before order"
        : "AI Estimated — Wholesale Unverified",
  };
}

/** SKU tag for a selected studio item id. */
export function tradeTagForItem(
  telemetry: TradeTelemetry,
  itemId: string,
): TradeLineMatch | null {
  return (
    telemetry.matchedLines.find(
      (m) =>
        m.sourceIds.includes(itemId) &&
        m.studioHint !== "assembly",
    ) ?? null
  );
}
