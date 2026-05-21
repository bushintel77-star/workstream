import type {
  CatalogPlacement,
  CatalogSymbol,
  DesignCanvas,
  Survey,
} from "@workstream/contracts";
import { summarizePlacementsForQuote } from "./catalog-quote";
import { getCatalogSymbol } from "./catalog";
import {
  assessPlanningFromSketch,
  formatPlanningFlagsForAi,
} from "./planning-context";

/** Text brief for Claude from design-studio placements. */
export function formatSketchBriefForAi(
  canvas: DesignCanvas | null | undefined,
  symbols: CatalogSymbol[] = [],
  survey?: Pick<Survey, "garden_area_m2" | "lot_area_m2" | "house_area_m2">,
  address?: string,
): string | null {
  if (!canvas?.placements?.length) return null;

  const rows = summarizePlacementsForQuote(canvas.placements, symbols);
  const lines: string[] = [
    "The operator placed these assets on the aerial site plan (rough layout — expand into proper zones, species, and quantities):",
    "",
  ];

  for (const row of rows) {
    const sym = getCatalogSymbol(row.symbol_id);
    const pos = canvas.placements
      .filter((p) => p.symbol_id === row.symbol_id)
      .map((p) => `@ ${p.x_pct.toFixed(0)}%,${p.y_pct.toFixed(0)}%`)
      .join("; ");
    lines.push(
      `- ${row.label} (${row.category}) × ${row.count} on plan${row.rate_card_sku ? ` · SKU ${row.rate_card_sku}` : ""}${sym?.description ? ` — ${sym.description}` : ""}`,
    );
    lines.push(`  Positions: ${pos}`);
  }

  if (rows.some((r) => r.symbol_id === "lawn-turf") && survey) {
    lines.push(
      "",
      `Turf / lawn symbol used — garden area is ${survey.garden_area_m2} m² (use for lawn qty if appropriate).`,
    );
  }

  if (canvas.strokes.length > 0) {
    lines.push(
      "",
      `Freehand markup: ${canvas.strokes.length} stroke(s) — treat as layout notes.`,
    );
  }

  lines.push(
    "",
    "Honor this spatial intent. Propose 2–4 named zones that realize the sketch with Curtis palette species and rate-card SKUs. You may refine counts and add irrigation/lighting where the sketch is silent.",
  );

  if (address && survey) {
    const planning = formatPlanningFlagsForAi(
      assessPlanningFromSketch(address, survey, canvas, symbols),
    );
    if (planning) {
      lines.push("", planning);
    }
  }

  return lines.join("\n");
}
