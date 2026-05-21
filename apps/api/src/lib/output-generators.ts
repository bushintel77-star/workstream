import type {
  Audit,
  CatalogSymbol,
  Costing,
  Design,
  DesignCanvas,
  OutputKind,
  Project,
  RateCard,
  Survey,
  Task,
  Zone,
} from "@workstream/contracts";
import {
  buildEnvelopeBrief,
  formatSitePlanQuoteSection,
  isTier1WrightsTerrace,
  TIER1_WRIGHTS_SAVINGS,
  totalEmbodiedCarbon,
  type RateCardLookup,
} from "@workstream/domain";

export type GeneratorArgs = {
  project: Project;
  survey: Survey | null;
  design: Design | null;
  designCanvas: DesignCanvas | null;
  catalogSymbols: CatalogSymbol[];
  rateCard: RateCard[];
  costings: Costing[];
  audit: Audit | null;
  tasks: Task[];
};

function rateCardLookup(rows: RateCard[]): RateCardLookup {
  const map: RateCardLookup = new Map();
  for (const row of rows) {
    if (!map.has(row.sku)) {
      map.set(row.sku, { label: row.label, unit: row.unit, rate: row.rate });
    }
  }
  return map;
}

type Args = GeneratorArgs;

const aud0 = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

const aud2 = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);

function zones(design: Design): Zone[] {
  return design.proposal.zones ?? [];
}

function requireSurvey(args: Args, kind: string): Survey {
  if (!args.survey) throw new Error(`${kind} requires a survey`);
  return args.survey;
}
function requireDesign(args: Args, kind: string): Design {
  if (!args.design) throw new Error(`${kind} requires a design`);
  return args.design;
}

export function buildTaskList(args: Args): string {
  const survey = requireSurvey(args, "task_list");
  const design = requireDesign(args, "task_list");
  const lines: string[] = [];
  lines.push(`# Task list — ${args.project.address}`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)}.`);
  lines.push("");

  let n = 1;
  lines.push("## Site preparation");
  lines.push(`${n++}. Site prep + setout (TSK-PREP) — ${survey.garden_area_m2} m²`);
  lines.push(`${n++}. Confirm services + obtain permits before excavation.`);
  lines.push("");

  for (const z of zones(design)) {
    lines.push(`## ${z.name}`);
    lines.push(`> ${z.treatment}`);
    lines.push("");
    for (const h of z.hardscape) {
      lines.push(
        `${n++}. ${h.item} — ${h.qty} ${h.unit}${h.sku ? ` (${h.sku})` : ""}`,
      );
    }
    for (const p of z.plantings) {
      lines.push(
        `${n++}. Plant ${p.count} × ${p.common_name ?? p.species}${p.sku ? ` (${p.sku})` : ""}`,
      );
    }
    for (const l of z.lighting) {
      lines.push(
        `${n++}. Install ${l.count} × ${l.fixture}${l.sku ? ` (${l.sku})` : ""}`,
      );
    }
    for (const i of z.irrigation) {
      lines.push(
        `${n++}. ${i.item} — ${i.qty} ${i.unit}${i.sku ? ` (${i.sku})` : ""}`,
      );
    }
    lines.push("");
  }

  lines.push("## Completion");
  lines.push(`${n++}. Final clean + waste removal.`);
  lines.push(`${n++}. Handover walk with client; provide care notes for planting.`);

  return lines.join("\n");
}

export function buildSchedule(args: Args): string {
  const design = requireDesign(args, "schedule");
  const lines: string[] = [];
  lines.push(`# Schedule (indicative) — ${args.project.address}`);
  lines.push("");
  lines.push("Crew of 4. Day rate from rate card.");
  lines.push("");
  lines.push("| Week | Activity |");
  lines.push("|------|----------|");
  let week = 1;
  lines.push(`| ${week++} | Site prep, demolition, setout |`);
  if (zones(design).some((z) => z.hardscape.length > 0)) {
    lines.push(`| ${week++} | Hardscape — paving, edging, walls |`);
    lines.push(`| ${week++} | Hardscape continued + drainage |`);
  }
  if (zones(design).some((z) => z.irrigation.length > 0)) {
    lines.push(`| ${week++} | Irrigation rough-in + controller |`);
  }
  lines.push(`| ${week++} | Soil prep, mulch base |`);
  lines.push(`| ${week++} | Planting — trees and hedges first, mass blocks second |`);
  if (zones(design).some((z) => z.lighting.length > 0)) {
    lines.push(`| ${week++} | Lighting install + commissioning |`);
  }
  lines.push(`| ${week++} | Final clean, mulch top-up, handover |`);
  return lines.join("\n");
}

export function buildQuote(args: Args): string {
  const standard =
    args.costings.find((c) => c.scenario === "standard") ?? args.costings[0];
  const lines: string[] = [];
  lines.push(`# Quote — ${args.project.address}`);
  lines.push("");
  lines.push("Curtis & Co — Boutique Landscape Design, Melbourne.");
  lines.push("");
  if (isTier1WrightsTerrace(args.project.address)) {
    lines.push("## Tier-1 architectural massing");
    lines.push("");
    lines.push(
      `Value reallocation saves **${aud0(Math.abs(TIER1_WRIGHTS_SAVINGS.net_inc_gst))} incl. GST** vs cottage-scatter scope. Architecture locked.`,
    );
    lines.push("");
  }
  lines.push(`**Project total (Standard scenario, incl. GST): ${aud0(standard.total)}**`);
  lines.push("");
  lines.push(`Subtotal ${aud2(standard.subtotal)}  ·  GST ${aud2(standard.gst)}`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  const designForQuote = requireDesign(args, "quote");
  for (const z of zones(designForQuote)) {
    lines.push(`### ${z.name}`);
    lines.push(`${z.treatment}`);
    lines.push("");
  }
  const sitePlan = formatSitePlanQuoteSection(
    args.designCanvas,
    args.catalogSymbols,
    rateCardLookup(args.rateCard),
  );
  if (sitePlan.length > 0) {
    lines.push(...sitePlan);
  }

  if (args.survey && args.designCanvas?.placements?.length) {
    const envelope = buildEnvelopeBrief({
      project: args.project,
      survey: args.survey,
      canvas: args.designCanvas,
      symbols: args.catalogSymbols,
      sketchCosting:
        args.costings.find((c) =>
          c.line_items.some((li) => li.label.includes("sketch ·")),
        ) ?? null,
    });
    const planning = envelope.planning_flags.filter(
      (f) => f.id !== "scope-envelope",
    );
    if (planning.length > 0) {
      lines.push("## Planning & permits (from envelope sketch)");
      lines.push("");
      for (const f of planning) {
        const tag =
          f.severity === "likely" ? "**Likely**" : f.severity === "review" ? "**Review**" : "OK";
        lines.push(`- ${f.title} — ${tag}: ${f.detail}`);
      }
      lines.push("");
    }
    if (envelope.budget_mid > 0) {
      lines.push(
        `_Envelope budget band (sketch, provisional): ${aud0(envelope.budget_low)} – ${aud0(envelope.budget_high)} incl. GST — formal quote below supersedes for contract._`,
      );
      lines.push("");
    }
  }

  lines.push("## Inclusions (Standard)");
  lines.push("");
  for (const li of standard.line_items.filter((l) => !l.is_provisional)) {
    lines.push(`- ${li.label} — ${li.qty} ${li.unit} @ ${aud2(li.rate)} → ${aud2(li.total)}`);
  }
  const provisional = standard.line_items.filter((l) => l.is_provisional);
  if (provisional.length > 0) {
    lines.push("");
    lines.push("## Provisional (POA — to be confirmed before acceptance)");
    lines.push("");
    for (const li of provisional) {
      lines.push(`- ${li.label} — ${li.qty} ${li.unit}`);
    }
  }
  lines.push("");
  lines.push("## Scenarios");
  lines.push("");
  for (const c of args.costings) {
    lines.push(`- ${c.scenario.toUpperCase()} — ${aud0(c.total)} incl. GST`);
  }
  lines.push("");
  lines.push("## Embodied carbon (estimate)");
  lines.push("");
  const carbon = totalEmbodiedCarbon(
    standard.line_items.map((li) => ({ sku: li.sku, qty: li.qty })),
  );
  lines.push(`- Net: ${carbon.net_kg_co2e} kg CO₂e`);
  if (carbon.emitting_kg_co2e > 0) {
    lines.push(`- Emitting materials: +${carbon.emitting_kg_co2e} kg CO₂e`);
  }
  if (carbon.sequestering_kg_co2e < 0) {
    lines.push(
      `- Sequestering (planting + compost): ${carbon.sequestering_kg_co2e} kg CO₂e`,
    );
  }
  if (carbon.unknown_skus.length > 0) {
    lines.push(
      `- Coefficients pending for: ${carbon.unknown_skus.slice(0, 6).join(", ")}${carbon.unknown_skus.length > 6 ? "…" : ""}`,
    );
  }
  lines.push("");
  lines.push(
    "Estimates use the EPiC database (epicdatabase.com.au) for AU construction materials and ICE v3 where local data is missing. Plant biogenic uptake is a lifecycle stub — replace with EPDs when supplier data is available.",
  );
  lines.push("");
  lines.push("Quote valid 30 days. Pricing reflects rate card effective on project creation.");
  return lines.join("\n");
}

export function buildScope(args: Args): string {
  const survey = requireSurvey(args, "scope");
  const design = requireDesign(args, "scope");
  const lines: string[] = [];
  lines.push(`# Scope of works (internal) — ${args.project.address}`);
  lines.push("");
  lines.push(`Design mode: **${design.mode}**  ·  version v${design.version}`);
  lines.push("");
  lines.push("## Survey");
  lines.push(`- Lot: ${survey.lot_area_m2} m²`);
  lines.push(`- House: ${survey.house_area_m2} m²`);
  lines.push(`- Garden: ${survey.garden_area_m2} m²`);
  lines.push("");
  const sitePlan = formatSitePlanQuoteSection(
    args.designCanvas,
    args.catalogSymbols,
    rateCardLookup(args.rateCard),
  );
  if (sitePlan.length > 0) {
    lines.push(...sitePlan);
  }
  lines.push("## Rationale");
  lines.push("");
  lines.push(design.rationale);
  lines.push("");
  lines.push("## Gaps carried into delivery");
  if (design.gaps.length === 0) {
    lines.push("");
    lines.push("None.");
  } else {
    for (const g of design.gaps) {
      lines.push(`- [${g.zone}] ${g.description}`);
      lines.push(`  - Resolution: ${g.proposed_fill}`);
      lines.push(`  - Rationale: ${g.rationale}`);
    }
  }
  if (args.audit) {
    lines.push("");
    lines.push(`## Audit (${args.audit.passed ? "PASSED" : "BLOCKED"})`);
    lines.push(
      `${args.audit.blocking_count} blocking · ${args.audit.advisory_count} advisory`,
    );
    for (const f of args.audit.findings) {
      lines.push(
        `- [${f.severity.toUpperCase()} · ${f.category}] ${f.statement} → ${f.suggested_action}`,
      );
    }
  }
  return lines.join("\n");
}

export function buildDailySiteReport(args: Args): string {
  const today = new Date().toISOString().slice(0, 10);
  const newToday = args.tasks.filter((t) => t.created_at.slice(0, 10) === today);
  const open = args.tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  );
  const done = args.tasks.filter((t) => t.status === "done");

  const lines: string[] = [];
  lines.push(`# Daily site report — ${args.project.address}`);
  lines.push("");
  lines.push(`Date: ${today}`);
  lines.push("");
  lines.push("## Counts");
  lines.push(`- New today: ${newToday.length}`);
  lines.push(`- Open: ${open.length}`);
  lines.push(`- Completed: ${done.length}`);
  lines.push("");

  if (newToday.length > 0) {
    lines.push("## New today");
    for (const t of newToday) {
      const assignee = t.assignee_name ? ` · ${t.assignee_name}` : "";
      const priority = ` (${t.priority})`;
      lines.push(`- ${t.title}${assignee}${priority}`);
      if (t.technical_specifications) {
        lines.push(`  ↳ ${t.technical_specifications}`);
      }
    }
    lines.push("");
  }

  if (open.length > 0) {
    lines.push("## Open");
    for (const t of open) {
      const assignee = t.assignee_name ? ` · ${t.assignee_name}` : "";
      lines.push(`- [${t.priority}] ${t.title}${assignee}`);
    }
    lines.push("");
  }

  if (done.length > 0) {
    lines.push("## Completed");
    for (const t of done) {
      const assignee = t.assignee_name ? ` · ${t.assignee_name}` : "";
      lines.push(`- ${t.title}${assignee}`);
    }
  }

  return lines.join("\n");
}

export function buildStonningtonStormwaterPermit(args: Args): string {
  const survey = requireSurvey(args, "permit_stonnington_stormwater");
  const design = requireDesign(args, "permit_stonnington_stormwater");
  const hardscapeM2 = zones(design).reduce(
    (sum, z) =>
      sum +
      z.hardscape
        .filter((h) => h.unit === "m2")
        .reduce((s, h) => s + h.qty, 0),
    0,
  );

  const lines: string[] = [];
  lines.push(`# City of Stonnington — Stormwater Permit (DRAFT)`);
  lines.push("");
  lines.push(`Property: ${args.project.address}`);
  lines.push(`Applicant: Curtis & Co Landscape Design`);
  lines.push(`Prepared: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push("## Site characteristics");
  lines.push(`- Lot area: ${survey.lot_area_m2} m²`);
  lines.push(`- Existing house footprint: ${survey.house_area_m2} m²`);
  lines.push(`- Garden area: ${survey.garden_area_m2} m²`);
  lines.push(`- Proposed new hardscape (impermeable): ${hardscapeM2} m²`);
  lines.push("");
  lines.push("## Proposed stormwater management");
  lines.push("- Surface drainage: graded paving falls to perimeter spoon drains.");
  lines.push("- Sub-surface drainage: 100 mm slotted AG drain on garden side of all retaining and edge walls.");
  lines.push("- Discharge point: connect to existing legal point of discharge via stormwater pit.");
  lines.push("");
  lines.push("## Council declarations");
  lines.push("- All works comply with City of Stonnington Local Law and Council Stormwater Management Policy.");
  lines.push("- No discharge to neighbouring properties.");
  lines.push("- Site to be re-vegetated within 4 weeks of works completion.");
  lines.push("");
  lines.push("> DRAFT — generated from Workstream survey + design data. Verify before lodgement.");
  return lines.join("\n");
}

export function buildYarraHeritagePermit(args: Args): string {
  const survey = requireSurvey(args, "permit_yarra_heritage");
  const design = requireDesign(args, "permit_yarra_heritage");
  const lines: string[] = [];
  lines.push(`# City of Yarra — Heritage Overlay Application (DRAFT)`);
  lines.push("");
  lines.push(`Property: ${args.project.address}`);
  lines.push(`Applicant: Curtis & Co Landscape Design`);
  lines.push(`Prepared: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push("## Site");
  lines.push(`- Lot area: ${survey.lot_area_m2} m²`);
  lines.push(`- Existing dwelling: ${survey.house_area_m2} m² (retained, no works to fabric)`);
  lines.push(`- Garden area subject to works: ${survey.garden_area_m2} m²`);
  lines.push("");
  lines.push("## Proposed landscape works");
  for (const z of zones(design)) {
    lines.push(`### ${z.name}`);
    lines.push(`${z.treatment}`);
    lines.push("");
  }
  lines.push("## Heritage compatibility statement");
  lines.push("Works are confined to the garden and rear of the property. No alteration to dwelling fabric, fenestration, roofline or street-facing elevation. Plant palette and hard materials selected to be sympathetic to the period character of the property and surrounding streetscape, in line with the City of Yarra Heritage Design Guidelines.");
  lines.push("");
  lines.push("> DRAFT — generated from Workstream survey + design data. Verify before lodgement and append site photographs.");
  return lines.join("\n");
}

export function generateForKind(kind: OutputKind, args: Args): string {
  switch (kind) {
    case "task_list":
      return buildTaskList(args);
    case "schedule":
      return buildSchedule(args);
    case "quote":
      return buildQuote(args);
    case "scope":
      return buildScope(args);
    case "daily_site_report":
      return buildDailySiteReport(args);
    case "permit_stonnington_stormwater":
      return buildStonningtonStormwaterPermit(args);
    case "permit_yarra_heritage":
      return buildYarraHeritagePermit(args);
    case "brochure":
      throw new Error("Brochure output is deferred (Phase 8 in spec).");
  }
}
