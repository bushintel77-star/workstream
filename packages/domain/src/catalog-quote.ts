import type { CatalogPlacement, CatalogSymbol, DesignCanvas } from "@workstream/contracts";
import { getCatalogSymbol } from "./catalog";

export type PlacementQuoteRow = {
  symbol_id: string;
  label: string;
  count: number;
  rate_card_sku?: string;
  category: string;
};

export type RateCardLookup = Map<
  string,
  { label: string; unit: string; rate: number }
>;

/** Group design-studio placements for quote / scope markdown. */
export function summarizePlacementsForQuote(
  placements: CatalogPlacement[],
  extraSymbols: CatalogSymbol[] = [],
): PlacementQuoteRow[] {
  const symbolMap = new Map<string, CatalogSymbol>();
  for (const sym of extraSymbols) symbolMap.set(sym.id, sym);

  const counts = new Map<string, number>();
  for (const p of placements) {
    counts.set(p.symbol_id, (counts.get(p.symbol_id) ?? 0) + 1);
  }

  const rows: PlacementQuoteRow[] = [];
  for (const [symbol_id, count] of counts) {
    const sym =
      symbolMap.get(symbol_id) ?? getCatalogSymbol(symbol_id);
    rows.push({
      symbol_id,
      label: sym?.label ?? symbol_id,
      count,
      rate_card_sku: sym?.rate_card_sku,
      category: sym?.category ?? "annotation",
    });
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

export function formatSitePlanQuoteSection(
  canvas: DesignCanvas | null | undefined,
  extraSymbols: CatalogSymbol[] = [],
  rateLookup?: RateCardLookup,
): string[] {
  if (!canvas?.placements?.length) return [];

  const rows = summarizePlacementsForQuote(canvas.placements, extraSymbols);
  const lines: string[] = [];
  lines.push("## Site plan (design studio)");
  lines.push("");
  lines.push(
    "Assets placed on the aerial site plan. Quantities are plan counts — confirm against design zones before issue.",
  );
  lines.push("");
  lines.push("| Asset | Qty on plan | SKU | Rate card |");
  lines.push("| --- | ---: | --- | --- |");

  for (const row of rows) {
    const sku = row.rate_card_sku ?? "—";
    let rateNote = "—";
    if (row.rate_card_sku && rateLookup?.has(row.rate_card_sku)) {
      const rc = rateLookup.get(row.rate_card_sku)!;
      rateNote = `${rc.label} (${rc.unit} @ ${rc.rate})`;
    } else if (row.rate_card_sku) {
      rateNote = "SKU not on rate card";
    }
    lines.push(`| ${row.label} | ${row.count} | ${sku} | ${rateNote} |`);
  }

  if (canvas.strokes.length > 0) {
    lines.push("");
    lines.push(
      `Freehand markup: ${canvas.strokes.length} stroke(s) on plan (not separately quantified).`,
    );
  }

  lines.push("");
  return lines;
}
