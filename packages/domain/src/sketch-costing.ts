import type {
  CatalogPlacement,
  CatalogSymbol,
  LineItem,
  RateCard,
  Survey,
} from "@workstream/contracts";
import {
  applyContingency,
  calculateGST,
  calculateLineTotal,
  calculateSubtotal,
  calculateTotal,
} from "./costing";
import { summarizePlacementsForQuote } from "./catalog-quote";

/** Rough qty from plan pin count (and symbol defaults). */
export function sketchQtyForSymbol(
  symbol: CatalogSymbol,
  pinCount: number,
  survey: Pick<Survey, "garden_area_m2">,
): number {
  if (pinCount <= 0) return 0;
  if (symbol.id === "lawn-turf") {
    return Math.round(survey.garden_area_m2);
  }
  if (symbol.category === "paving" && symbol.default_width_m) {
    return Math.round(pinCount * symbol.default_width_m * symbol.default_width_m);
  }
  if (symbol.category === "planting") {
    return pinCount;
  }
  return pinCount;
}

export function buildSketchLineItems(
  placements: CatalogPlacement[],
  symbols: CatalogSymbol[],
  survey: Pick<Survey, "garden_area_m2">,
  rates: Map<string, RateCard>,
): LineItem[] {
  const rows = summarizePlacementsForQuote(placements, symbols);
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));
  const lines: LineItem[] = [];

  for (const row of rows) {
    if (!row.rate_card_sku) continue;
    const rate = rates.get(row.rate_card_sku);
    if (!rate) continue;
    const sym = symbolMap.get(row.symbol_id) ?? symbols.find((s) => s.id === row.symbol_id);
    if (!sym) continue;
    const qty = sketchQtyForSymbol(sym, row.count, survey);
    if (qty <= 0) continue;
    lines.push({
      sku: rate.sku,
      label: `${rate.label} — sketch · ${row.label}`,
      unit: rate.unit,
      qty,
      rate: rate.rate,
      total: calculateLineTotal(qty, rate.rate),
      notes: "Sketch estimate from plan pins — confirm after AI design",
      is_provisional: true,
    });
  }

  return lines;
}

export function buildSketchCostingTotals(line_items: LineItem[]): {
  line_items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
} {
  const billable = line_items.filter((l) => !l.is_provisional).map((l) => l.total);
  let subtotal = calculateSubtotal(billable);
  if (subtotal === 0 && line_items.length > 0) {
    subtotal = calculateSubtotal(line_items.map((l) => l.total));
  }
  const withContingency = applyContingency(subtotal, "standard");
  subtotal += withContingency;
  const gst = calculateGST(subtotal);
  const total = calculateTotal(subtotal, gst);
  return {
    line_items,
    subtotal: Math.round(subtotal * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
