import type {
  CatalogSymbol,
  Costing,
  DesignCanvas,
  Project,
  Survey,
} from "@workstream/contracts";
import {
  assessPlanningFromSketch,
  type PlanningFlag,
} from "./planning-context";
import { summarizePlacementsForQuote } from "./catalog-quote";

const aud0 = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

export type EnvelopeBrief = {
  markdown: string;
  budget_low: number;
  budget_high: number;
  budget_mid: number;
  planning_flags: PlanningFlag[];
};

function budgetBand(mid: number): { low: number; high: number } {
  const low = Math.round(mid * 0.85);
  const high = Math.round(mid * 1.2);
  return { low, high };
}

export function buildEnvelopeBrief(input: {
  project: Pick<Project, "address">;
  survey: Survey;
  canvas: DesignCanvas | null | undefined;
  symbols: CatalogSymbol[];
  sketchCosting?: Pick<Costing, "subtotal" | "gst" | "total" | "line_items"> | null;
}): EnvelopeBrief {
  const planning_flags = assessPlanningFromSketch(
    input.project.address,
    input.survey,
    input.canvas,
    input.symbols,
  );

  const mid = input.sketchCosting?.total ?? 0;
  const { low: budget_low, high: budget_high } = budgetBand(mid);

  const rows = input.canvas?.placements?.length
    ? summarizePlacementsForQuote(input.canvas.placements, input.symbols)
    : [];

  const lines: string[] = [];
  lines.push(`# Envelope brief — ${input.project.address}`);
  lines.push("");
  lines.push(
    "Back-of-envelope scope and budget for client discussion. Not a contract quote — permits, arborist, and council fees are additional.",
  );
  lines.push("");

  if (mid > 0) {
    lines.push("## Budget band (sketch, provisional, incl. GST)");
    lines.push("");
    lines.push(
      `**${aud0(budget_low)} – ${aud0(budget_high)}**  ·  midpoint ${aud0(mid)}`,
    );
    lines.push("");
    lines.push(
      "Based on plan pin counts and rate card allowances. Develop design from sketch, then full costing, before a formal quote.",
    );
    lines.push("");
  } else {
    lines.push("## Budget band");
    lines.push("");
    lines.push(
      "_Run sketch estimate after saving the design studio layout._",
    );
    lines.push("");
  }

  if (rows.length > 0) {
    lines.push("## Sketch scope (on aerial)");
    lines.push("");
    for (const row of rows) {
      lines.push(
        `- ${row.label} × ${row.count}${row.rate_card_sku ? ` (${row.rate_card_sku})` : ""}`,
      );
    }
    lines.push("");
    lines.push(
      `Site: ${input.survey.lot_area_m2} m² lot · ${input.survey.garden_area_m2} m² garden`,
    );
    lines.push("");
  }

  lines.push("## Planning, tree protection & permits (preliminary)");
  lines.push("");
  lines.push("| Item | Level | Notes |");
  lines.push("| --- | --- | --- |");
  for (const f of planning_flags) {
    if (f.id === "scope-envelope") continue;
    const level =
      f.severity === "likely"
        ? "Likely"
        : f.severity === "review"
          ? "Review"
          : "OK";
    lines.push(`| ${f.title} | ${level} | ${f.detail} |`);
  }
  lines.push("");

  const outputs = planning_flags
    .filter((f) => f.output_kind)
    .map((f) => f.output_kind);
  const unique = [...new Set(outputs)];
  if (unique.length > 0) {
    lines.push("## Suggested next documents");
    lines.push("");
    for (const kind of unique) {
      if (!kind) continue;
      lines.push(`- Generate **${kind.replace(/_/g, " ")}** when scope is confirmed`);
    }
    lines.push("");
  }

  lines.push(
    "> Confirm municipality, heritage overlay, and TPZ with planning certificate and arborist before excavation.",
  );

  return {
    markdown: lines.join("\n"),
    budget_low,
    budget_high,
    budget_mid: mid,
    planning_flags,
  };
}
