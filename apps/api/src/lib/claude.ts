import type {
  AuditFinding,
  Costing,
  Design,
  DesignMode,
  GapFlag,
  PlantPalette,
  RateCard,
  Survey,
} from "@walkthrough/contracts";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DESIGN_MODEL = "claude-opus-4-7";
const AUDIT_MODEL = "claude-sonnet-4-6";

export type DesignProposal = {
  zones: Array<{
    id: string;
    name: string;
    treatment: string;
    plantings: Array<{
      species: string;
      common_name: string;
      count: number;
      form: string;
      sku?: string;
    }>;
    hardscape: Array<{ item: string; qty: number; unit: string; sku?: string }>;
    lighting: Array<{ fixture: string; count: number; sku?: string }>;
    irrigation: Array<{ item: string; qty: number; unit: string; sku?: string }>;
  }>;
  estimated_complexity: "simple" | "standard" | "complex";
};

export type DesignGeneration = {
  proposal: DesignProposal;
  gaps: GapFlag[];
  rationale: string;
};

export type DesignContext = {
  address: string;
  transcript: string | null;
  survey: Survey;
  mode: DesignMode;
  plant_palette: PlantPalette[];
  rate_card: RateCard[];
};

const SYSTEM_PROMPT = `You are the design engine for Curtis & Co, a Melbourne boutique landscape design studio.

DESIGN PHILOSOPHY
- Architectural restraint. Singular species in disciplined mass blocks. No cottage / mixed perennial beds. No scattered ornamentals.
- Period-home gardens (Stonnington, Armadale, Malvern, South Yarra). Lighting and irrigation considered early.
- Boundary treatments often pleached hornbeam, Capital Pear, or Tilia screens.
- Hard materials lean to bluestone (sawn or flamed), corten steel, in-situ concrete, spotted gum decking.

OPERATING MODES
- auto: address only. Propose a full plausible design from lot geometry + Curtis house style.
- gapfill: partial voice brief. Honour every specified element. Flag missing decisions as gaps with proposed fills.
- validate: complete voice brief. Convert the brief faithfully into structured zones. Gaps should be rare; only flag genuine ambiguities.

OUTPUT
Return strict JSON only. Schema:
{
  "proposal": {
    "zones": [
      {
        "id": "kebab-case-id",
        "name": "Display name",
        "treatment": "One paragraph describing the zone's character",
        "plantings": [{ "species": "Botanical name", "common_name": "...", "count": int, "form": "tree|hedge|mass|specimen|groundcover|climber|grass|lawn", "sku": "PLT-..." }],
        "hardscape": [{ "item": "...", "qty": number, "unit": "m2|lm|ea", "sku": "PAV-...|CONC-...|COR-...|TIM-..." }],
        "lighting": [{ "fixture": "...", "count": int, "sku": "LGT-..." }],
        "irrigation": [{ "item": "...", "qty": number, "unit": "lm|zone|ea", "sku": "IRR-..." }]
      }
    ],
    "estimated_complexity": "simple|standard|complex"
  },
  "gaps": [{ "zone": "zone-id", "description": "What's missing", "proposed_fill": "Specific resolution", "rationale": "Why this fill" }],
  "rationale": "One paragraph explaining the overall design intent in plain language."
}

CONSTRAINTS
- Only specify plants whose species appears in the supplied plant_palette. If you need something outside the palette, leave it out and raise a gap.
- Only specify SKUs that appear in the supplied rate_card.
- Never specify pools, swimming-pool fencing, or structural pool concrete. Out of scope.
- Retaining walls > 1.0m must be flagged as a gap requiring engineering, not silently included.
- Quote a specific count or qty for every line. No vague "as required".`;

function buildUserMessage(ctx: DesignContext): string {
  const palette = ctx.plant_palette
    .map(
      (p) =>
        `- ${p.species} (${p.common_name}) — ${p.category}/${p.form ?? "—"}, mature ${p.mature_h_m}x${p.mature_w_m}m`,
    )
    .join("\n");
  const rates = ctx.rate_card
    .map((r) => `- ${r.sku}: ${r.label} (${r.unit}, $${r.rate})`)
    .join("\n");

  return `MODE: ${ctx.mode}

ADDRESS
${ctx.address}

SURVEY
- Lot area: ${ctx.survey.lot_area_m2} m²
- House area: ${ctx.survey.house_area_m2} m²
- Garden area: ${ctx.survey.garden_area_m2} m²
- Measurements: ${ctx.survey.measurements
    .map((m) => `${m.label ?? m.edge_id} ${m.length_m}m @ ${m.bearing_deg}°`)
    .join("; ")}

WALKTHROUGH TRANSCRIPT
${ctx.transcript ?? "(none — auto mode)"}

PLANT PALETTE (approved species)
${palette}

RATE CARD (available SKUs)
${rates}

Produce the design JSON now. No prose, no markdown — just the JSON object.`;
}

function devFallbackDesign(ctx: DesignContext): DesignGeneration {
  const hornbeam =
    ctx.plant_palette.find((p) => p.species.includes("Carpinus")) ?? null;
  const lomandra =
    ctx.plant_palette.find((p) => p.species.includes("Lomandra ‘Tanika’")) ??
    ctx.plant_palette.find((p) => p.species.includes("Lomandra"));
  const bluestone =
    ctx.rate_card.find((r) => r.sku === "PAV-BLUE-SAWN") ?? null;
  const uplight =
    ctx.rate_card.find((r) => r.sku === "LGT-UP-BRASS") ?? null;
  const drip = ctx.rate_card.find((r) => r.sku === "IRR-DRIP") ?? null;

  return {
    proposal: {
      zones: [
        {
          id: "front-garden",
          name: "Front garden",
          treatment:
            "Mass planting of Lomandra ‘Tanika’ in disciplined blocks, low-maintenance, no irrigation to honour the brief.",
          plantings: lomandra
            ? [
                {
                  species: lomandra.species,
                  common_name: lomandra.common_name,
                  count: 36,
                  form: "mass",
                  sku: "PLT-LOM-140",
                },
              ]
            : [],
          hardscape: [],
          lighting: [],
          irrigation: [],
        },
        {
          id: "rear-terrace",
          name: "Rear terrace",
          treatment:
            "Bluestone paving from the entry to the rear, pleached hornbeam screen along the west boundary at 2.4m, brass uplights at the screen and key trees.",
          plantings: hornbeam
            ? [
                {
                  species: hornbeam.species,
                  common_name: hornbeam.common_name,
                  count: 6,
                  form: "hedge",
                  sku: "PLT-CARP-PL24",
                },
              ]
            : [],
          hardscape: bluestone
            ? [{ item: bluestone.label, qty: 38, unit: "m2", sku: bluestone.sku }]
            : [],
          lighting: uplight
            ? [{ fixture: uplight.label, count: 8, sku: uplight.sku }]
            : [],
          irrigation: drip
            ? [{ item: drip.label, qty: 22, unit: "lm", sku: drip.sku }]
            : [],
        },
      ],
      estimated_complexity: "standard",
    },
    gaps:
      ctx.mode === "auto"
        ? [
            {
              zone: "front-garden",
              description: "No watering strategy specified for front mass planting.",
              proposed_fill:
                "Hand-water for establishment year, then dry-tolerant — no permanent irrigation.",
              rationale:
                "Lomandra ‘Tanika’ is drought-tolerant once established and the auto-design defaults to lower-maintenance unless the brief says otherwise.",
            },
          ]
        : [],
    rationale:
      "A two-zone scheme: a disciplined mass-planted front and a paved-screen rear in keeping with Curtis & Co's Stonnington period-home vocabulary. " +
      "Generated in dev fallback mode — ANTHROPIC_API_KEY not configured.",
  };
}

export async function generateDesign(
  ctx: DesignContext,
): Promise<DesignGeneration> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return devFallbackDesign(ctx);
  }

  const body = {
    model: DESIGN_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: buildUserMessage(ctx),
      },
    ],
  };

  const res = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Anthropic /messages failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const textBlock = json.content.find((c) => c.type === "text");
  if (!textBlock) throw new Error("Anthropic response had no text block");

  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Failed to parse design JSON: ${err instanceof Error ? err.message : err}`,
    );
  }

  return parsed as DesignGeneration;
}

const AUDIT_SYSTEM_PROMPT = `You are the self-audit pass for Curtis & Co's landscape design tool. A separate model has just produced a design and costing from a walkthrough transcript and a survey. Your job is to interrogate that output and surface anything that's wrong, missing, or risky — like a senior project lead reviewing the brief before it goes to the client.

Return strict JSON. No prose, no markdown.

Schema:
{
  "findings": [
    {
      "severity": "blocking" | "advisory",
      "category": "fidelity" | "completeness" | "coherence" | "cost" | "safety" | "scope",
      "location": "zone-id or 'global' or 'line:<sku>'",
      "statement": "Human-readable finding in one sentence",
      "suggested_action": "Literal next step the user can take"
    }
  ]
}

CATEGORIES
- fidelity: design must honour what the user said in the transcript. If the transcript specifies a pleached hornbeam screen on the west boundary and the design has mixed natives, that's a blocking fidelity issue.
- completeness: every zone with garden area should have a treatment specified. Empty zones, untreated edges, missing irrigation in a high-water design.
- coherence: design must not contradict itself. Pergola structure listed but no footings line item. Drip irrigation specified but no controller. Lighting specified but no transformer.
- cost: costing must be internally consistent with the design. Lean scenario excludes irrigation but the design copy still references drip lines. Provisional/POA items in the totals.
- safety: anything dangerous. Retaining walls > 1.0m without engineering allowance. Drainage near foundations not detailed. Lighting voltage drop on long cable runs.
- scope: anything outside Curtis & Co's stated scope: pools, swimming-pool fencing, structural engineering, plan-view drafting.

SEVERITY
- blocking: prevents output generation until resolved or explicitly overridden. Use for fidelity gaps the user explicitly cared about, safety issues, scope violations, cost inconsistencies that would mislead a client.
- advisory: surface but don't block. Use for polish suggestions, minor completeness issues, optional enhancements.

If everything is clean, return { "findings": [] }. Do not pad the output.`;

function buildAuditUserMessage(args: {
  transcript: string | null;
  design: Design;
  costings: Costing[];
}): string {
  return `WALKTHROUGH TRANSCRIPT
${args.transcript ?? "(none — auto-design mode)"}

DESIGN (mode: ${args.design.mode}, version: ${args.design.version})
${JSON.stringify({ proposal: args.design.proposal, gaps: args.design.gaps, rationale: args.design.rationale }, null, 2)}

COSTINGS
${args.costings
  .map(
    (c) =>
      `[${c.scenario}] subtotal=${c.subtotal} gst=${c.gst} total=${c.total} ${c.line_items.length} line items` +
      (c.line_items.some((l) => l.is_provisional)
        ? ` (incl. ${c.line_items.filter((l) => l.is_provisional).length} provisional/POA)`
        : ""),
  )
  .join("\n")}

Audit now. Return JSON only.`;
}

function devFallbackAudit(args: {
  design: Design;
  costings: Costing[];
}): { findings: AuditFinding[] } {
  const findings: AuditFinding[] = [];
  const proposal = args.design.proposal as {
    zones?: Array<{
      id: string;
      lighting?: Array<unknown>;
      irrigation?: Array<unknown>;
    }>;
  };

  for (const z of proposal.zones ?? []) {
    if ((z.lighting?.length ?? 0) > 0) {
      const hasTransformer = false;
      if (!hasTransformer) {
        findings.push({
          severity: "advisory",
          category: "coherence",
          location: z.id,
          statement: `Zone "${z.id}" specifies lighting fixtures but no transformer in the line items.`,
          suggested_action:
            "Add at least one LGT-TX-150 transformer per ~140W of fixtures.",
        });
      }
    }
  }

  const provisional = args.costings.flatMap((c) =>
    c.line_items.filter((l) => l.is_provisional),
  );
  if (provisional.length > 0) {
    findings.push({
      severity: "blocking",
      category: "cost",
      location: "global",
      statement: `${provisional.length} line item(s) are provisional/POA across scenarios. Cannot generate a client quote until resolved.`,
      suggested_action:
        "Resolve each provisional SKU with a firm rate, or remove it from the design.",
    });
  }

  if (args.design.gaps.length > 0) {
    findings.push({
      severity: "advisory",
      category: "completeness",
      location: "global",
      statement: `${args.design.gaps.length} gap flag(s) carried over from design generation.`,
      suggested_action: "Review each gap and accept the proposed fill or override.",
    });
  }

  return { findings };
}

export async function runAudit(args: {
  transcript: string | null;
  design: Design;
  costings: Costing[];
}): Promise<{ findings: AuditFinding[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return devFallbackAudit(args);
  }

  const body = {
    model: AUDIT_MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: AUDIT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      { role: "user", content: buildAuditUserMessage(args) },
    ],
  };

  const res = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Anthropic /messages failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const textBlock = json.content.find((c) => c.type === "text");
  if (!textBlock) throw new Error("Anthropic audit response had no text block");

  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as { findings: AuditFinding[] };
  return parsed;
}
