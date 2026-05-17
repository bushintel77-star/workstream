import type {
  Audit,
  Costing,
  Design,
  OutputKind,
  Project,
  Survey,
} from "@walkthrough/contracts";

type Args = {
  project: Project;
  survey: Survey;
  design: Design;
  costings: Costing[];
  audit: Audit | null;
};

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

type ZoneProposal = {
  id: string;
  name: string;
  treatment: string;
  plantings: Array<{ species?: string; common_name?: string; count: number; sku?: string }>;
  hardscape: Array<{ item: string; qty: number; unit: string; sku?: string }>;
  lighting: Array<{ fixture: string; count: number; sku?: string }>;
  irrigation: Array<{ item: string; qty: number; unit: string; sku?: string }>;
};

function zones(design: Design): ZoneProposal[] {
  return ((design.proposal as { zones?: ZoneProposal[] }).zones ?? []).filter(Boolean);
}

export function buildTaskList(args: Args): string {
  const lines: string[] = [];
  lines.push(`# Task list — ${args.project.address}`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)}.`);
  lines.push("");

  let n = 1;
  lines.push("## Site preparation");
  lines.push(`${n++}. Site prep + setout (TSK-PREP) — ${args.survey.garden_area_m2} m²`);
  lines.push(`${n++}. Confirm services + obtain permits before excavation.`);
  lines.push("");

  for (const z of zones(args.design)) {
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
  const lines: string[] = [];
  lines.push(`# Schedule (indicative) — ${args.project.address}`);
  lines.push("");
  lines.push("Crew of 4. Day rate from rate card.");
  lines.push("");
  lines.push("| Week | Activity |");
  lines.push("|------|----------|");
  let week = 1;
  lines.push(`| ${week++} | Site prep, demolition, setout |`);
  if (zones(args.design).some((z) => z.hardscape.length > 0)) {
    lines.push(`| ${week++} | Hardscape — paving, edging, walls |`);
    lines.push(`| ${week++} | Hardscape continued + drainage |`);
  }
  if (zones(args.design).some((z) => z.irrigation.length > 0)) {
    lines.push(`| ${week++} | Irrigation rough-in + controller |`);
  }
  lines.push(`| ${week++} | Soil prep, mulch base |`);
  lines.push(`| ${week++} | Planting — trees and hedges first, mass blocks second |`);
  if (zones(args.design).some((z) => z.lighting.length > 0)) {
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
  lines.push(`**Project total (Standard scenario, incl. GST): ${aud0(standard.total)}**`);
  lines.push("");
  lines.push(`Subtotal ${aud2(standard.subtotal)}  ·  GST ${aud2(standard.gst)}`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  for (const z of zones(args.design)) {
    lines.push(`### ${z.name}`);
    lines.push(`${z.treatment}`);
    lines.push("");
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
  lines.push("Quote valid 30 days. Pricing reflects rate card effective on project creation.");
  return lines.join("\n");
}

export function buildScope(args: Args): string {
  const lines: string[] = [];
  lines.push(`# Scope of works (internal) — ${args.project.address}`);
  lines.push("");
  lines.push(`Design mode: **${args.design.mode}**  ·  version v${args.design.version}`);
  lines.push("");
  lines.push("## Survey");
  lines.push(`- Lot: ${args.survey.lot_area_m2} m²`);
  lines.push(`- House: ${args.survey.house_area_m2} m²`);
  lines.push(`- Garden: ${args.survey.garden_area_m2} m²`);
  lines.push("");
  lines.push("## Rationale");
  lines.push("");
  lines.push(args.design.rationale);
  lines.push("");
  lines.push("## Gaps carried into delivery");
  if (args.design.gaps.length === 0) {
    lines.push("");
    lines.push("None.");
  } else {
    for (const g of args.design.gaps) {
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
    case "brochure":
      throw new Error("Brochure output is deferred (Phase 8 in spec).");
  }
}
