import type {
  AuditFinding,
  CadOp,
  Costing,
  Design,
  DesignMode,
  DesignProposal,
  GapFlag,
  PlantPalette,
  RateCard,
  Survey,
} from "@workstream/contracts";
import { CadOpsBatchSchema } from "@workstream/contracts";
import {
  buildGhostPlacementSuggestions,
  buildStudioSystemPrompt,
  isTier1WrightsTerrace,
  parseStudioAssistResponse,
  tier1WrightsTerraceDesign,
  type StudioPromptSite,
} from "@workstream/domain";
import type { GhostPlacementSuggestion } from "@workstream/contracts";
import { getOwnerEnv } from "./owner-secrets";
import { fetchWithRetry } from "./http";
import { setActiveTelemetryAttributes } from "./telemetry";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DESIGN_MODEL = "claude-opus-4-7";
const AUDIT_MODEL = "claude-sonnet-4-6";
const VISION_MODEL = "claude-sonnet-4-6";

export type { DesignProposal };

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
  /** Operator layout from design studio — AI should expand, not ignore. */
  sketch_brief?: string | null;
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

When SITE SKETCH is provided, treat it as the operator's spatial brief: expand pin placements into proper zones and quantities; do not discard the layout.

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
- Existing house area: ${
    ctx.survey.house_area_m2 > 0
      ? `${ctx.survey.house_area_m2} m² (site context only)`
      : "unavailable — do not infer or invent"
  }
- Garden area: ${ctx.survey.garden_area_m2} m²
- Measurements: ${ctx.survey.measurements
    .map((m) => `${m.label ?? m.edge_id} ${m.length_m}m @ ${m.bearing_deg}°`)
    .join("; ")}

WALKTHROUGH TRANSCRIPT
${ctx.transcript ?? "(none — auto mode)"}

${ctx.sketch_brief ? `SITE SKETCH (operator layout on aerial)\n${ctx.sketch_brief}\n\n` : ""}PLANT PALETTE (approved species)
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
  if (isTier1WrightsTerrace(ctx.address)) {
    return tier1WrightsTerraceDesign({
      address: ctx.address,
      mode: ctx.mode,
    });
  }

  const apiKey = getOwnerEnv("ANTHROPIC_API_KEY");
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

  const res = await fetchWithRetry(MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  }, {
    telemetry: {
      spanName: "anthropic.generate_design",
      provider: "anthropic",
      attributes: {
        "pipeline.stage": "design",
        "model.name": DESIGN_MODEL,
      },
    },
  });

  if (!res.ok) {
    throw new Error(`Anthropic /messages failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  setActiveTelemetryAttributes({
    "tokens.input": json.usage?.input_tokens,
    "tokens.output": json.usage?.output_tokens,
  });
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
  const apiKey = getOwnerEnv("ANTHROPIC_API_KEY");
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

  const res = await fetchWithRetry(MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  }, {
    telemetry: {
      spanName: "anthropic.run_audit",
      provider: "anthropic",
      attributes: {
        "pipeline.stage": "audit",
        "model.name": AUDIT_MODEL,
      },
    },
  });

  if (!res.ok) {
    throw new Error(`Anthropic /messages failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  setActiveTelemetryAttributes({
    "tokens.input": json.usage?.input_tokens,
    "tokens.output": json.usage?.output_tokens,
  });
  const textBlock = json.content.find((c) => c.type === "text");
  if (!textBlock) throw new Error("Anthropic audit response had no text block");

  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as { findings: AuditFinding[] };
  return parsed;
}

// ---------- Vision: photo → measurement -----------------------------------

const VISION_SYSTEM_PROMPT = `You are a precise measurement extractor for site photographs from a landscape construction project. Given an image plus an optional reference scale ("the paver is 600mm wide", "the door is 820mm"), extract every clear dimension visible: lengths, widths, depths, areas, plant heights, gap distances. If no reference is given, prefer common known objects (standard brick = 230mm, AU pavers = typically 400-600mm, door frames = 820-870mm wide).

Output strict JSON, no prose:
{
  "items": [
    {
      "description": "Short noun phrase (e.g. 'Boundary fence height', 'Existing paving run')",
      "value": number,
      "unit": "meters" | "centimeters" | "millimeters" | "square_meters" | "cubic_meters" | "unknown",
      "confidence": number between 0 and 1,
      "reference_used": "What you used to scale (e.g. 'standard 230mm brick course', 'user-supplied paver 600mm')"
    }
  ],
  "notes": "One short sentence on caveats, perspective issues, or anything ambiguous"
}

Rules:
- Confidence 0.85+ only when a clear reference is in frame.
- Skip items where you can't pick a scale — return [] rather than guess.
- For uncertain perspective (no orthogonal view), confidence ≤ 0.65.
- Prefer SI base units; only use cm or mm when the user phrased it that way.`;

export type PhotoMeasurementCallArgs = {
  image_base64: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp";
  user_hint?: string;
};

export type PhotoMeasurementCallResult = {
  items: Array<{
    description: string;
    value: number;
    unit:
      | "meters"
      | "centimeters"
      | "millimeters"
      | "square_meters"
      | "cubic_meters"
      | "unknown";
    confidence: number;
    reference_used: string | null;
  }>;
  notes: string | null;
};

function devFallbackMeasurement(): PhotoMeasurementCallResult {
  return {
    items: [
      {
        description: "Existing paving run",
        value: 6.2,
        unit: "meters",
        confidence: 0.78,
        reference_used: "Standard AU paver 600mm",
      },
      {
        description: "Garden bed depth",
        value: 1.4,
        unit: "meters",
        confidence: 0.71,
        reference_used: "Standard AU paver 600mm",
      },
      {
        description: "Boundary fence height",
        value: 1.8,
        unit: "meters",
        confidence: 0.82,
        reference_used: "Brick course 230mm",
      },
    ],
    notes:
      "Dev fallback — ANTHROPIC_API_KEY not configured. Real Claude Vision would extract from the actual image.",
  };
}

export async function measurePhoto(
  args: PhotoMeasurementCallArgs,
): Promise<PhotoMeasurementCallResult> {
  const apiKey = getOwnerEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return devFallbackMeasurement();
  }

  const userContent: Array<Record<string, unknown>> = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: args.mime_type,
        data: args.image_base64,
      },
    },
  ];
  if (args.user_hint) {
    userContent.push({
      type: "text",
      text: `Reference / hint: ${args.user_hint}`,
    });
  } else {
    userContent.push({
      type: "text",
      text: "No reference provided. Use common objects in frame.",
    });
  }

  const body = {
    model: VISION_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: VISION_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  };

  const res = await fetchWithRetry(MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  }, {
    telemetry: {
      spanName: "anthropic.measure_photo",
      provider: "anthropic",
      attributes: {
        "pipeline.stage": "measurements",
        "model.name": VISION_MODEL,
      },
    },
  });
  if (!res.ok) {
    throw new Error(
      `Anthropic vision failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  setActiveTelemetryAttributes({
    "tokens.input": json.usage?.input_tokens,
    "tokens.output": json.usage?.output_tokens,
  });
  const textBlock = json.content.find((c) => c.type === "text");
  if (!textBlock) throw new Error("Anthropic vision response had no text block");
  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned) as PhotoMeasurementCallResult;
}

// ---------- Vision: photo → client email/name (not for email attachment) ----

const CONTACT_SCAN_PROMPT = `You read Australian site photos for a landscape studio. Find a client or owner name and email if visible (business card, letterhead, plan title block, site sign, invoice header).

Output strict JSON only:
{
  "client_name": "string or null",
  "client_email": "valid email or null",
  "notes": "one short sentence — where you read it from, or why null"
}

Rules:
- Do not invent emails. null if unreadable or absent.
- Normalise emails to lowercase.
- Ignore builder/trades emails unless clearly the property owner.`;

export async function scanImageContact(args: {
  image_base64: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp";
}): Promise<{
  client_name: string | null;
  client_email: string | null;
  notes: string | null;
}> {
  const apiKey = getOwnerEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return {
      client_name: "Eleanor Marsh",
      client_email: "eleanor@example.com.au",
      notes: "Dev fallback — configure ANTHROPIC_API_KEY for real OCR.",
    };
  }

  const body = {
    model: VISION_MODEL,
    max_tokens: 512,
    system: [{ type: "text", text: CONTACT_SCAN_PROMPT }],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: args.mime_type,
              data: args.image_base64,
            },
          },
          {
            type: "text",
            text: "Extract property owner or client contact details only.",
          },
        ],
      },
    ],
  };

  const res = await fetchWithRetry(MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  }, {
    telemetry: {
      spanName: "anthropic.scan_image_contact",
      provider: "anthropic",
      attributes: {
        "pipeline.stage": "filing",
        "model.name": VISION_MODEL,
      },
    },
  });
  if (!res.ok) {
    throw new Error(`Anthropic contact scan failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  setActiveTelemetryAttributes({
    "tokens.input": json.usage?.input_tokens,
    "tokens.output": json.usage?.output_tokens,
  });
  const textBlock = json.content.find((c) => c.type === "text");
  if (!textBlock) throw new Error("No text in contact scan response");
  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned) as {
    client_name?: string | null;
    client_email?: string | null;
    notes?: string | null;
  };
  return {
    client_name: parsed.client_name ?? null,
    client_email: parsed.client_email ?? null,
    notes: parsed.notes ?? null,
  };
}

const AERIAL_GHOST_PROMPT = `You analyse a top-down aerial site plan image for a Melbourne landscape concept sketch.

Return strict JSON only:
{
  "suggestions": [
    {
      "symbol_id": "catalog-id-from-allowed-list",
      "x_pct": 0-100,
      "y_pct": 0-100,
      "confidence": 0-1,
      "reason": "short plain-English hint"
    }
  ]
}

Rules:
- Use ONLY symbol_id values from the allowed list provided.
- x_pct / y_pct are percent from top-left of the image (0–100).
- Suggest trees, lawn, paving, structures where visually plausible — max 8 suggestions.
- These are indicative AI hints, not survey CAD. Never claim precision.
- If uncertain, return an empty suggestions array.`;

async function fetchAerialBase64(
  aerialUri: string,
): Promise<{ base64: string; mime_type: "image/jpeg" | "image/png" | "image/webp" }> {
  const provider = aerialUri.includes("mapbox.com") ? "mapbox" : "external";
  const res = await fetchWithRetry(aerialUri, { method: "GET" }, {
    telemetry: {
      spanName: "map.fetch_aerial_image",
      provider,
      attributes: {
        "pipeline.stage": "design",
      },
    },
  });
  if (!res.ok) throw new Error(`Aerial fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "image/jpeg";
  const mime_type = ct.includes("png")
    ? "image/png"
    : ct.includes("webp")
      ? "image/webp"
      : "image/jpeg";
  return { base64: buf.toString("base64"), mime_type };
}

export async function scanAerialGhosts(args: {
  aerial_uri: string;
  symbol_ids: string[];
  tier1: boolean;
}): Promise<GhostPlacementSuggestion[]> {
  const fallback = () =>
    buildGhostPlacementSuggestions({
      tier1: args.tier1,
      symbolIds: args.symbol_ids,
    });

  const apiKey = getOwnerEnv("ANTHROPIC_API_KEY");
  if (!apiKey || !args.aerial_uri.startsWith("http")) {
    return fallback();
  }

  try {
    const { base64, mime_type } = await fetchAerialBase64(args.aerial_uri);
    const allowed = args.symbol_ids.slice(0, 80).join(", ");
    const body = {
      model: VISION_MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: AERIAL_GHOST_PROMPT }],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mime_type,
                data: base64,
              },
            },
            {
              type: "text",
              text: `Allowed symbol_id values: ${allowed}\nTier-1 Wrights Terrace: ${args.tier1 ? "yes" : "no"}`,
            },
          ],
        },
      ],
    };

    const res = await fetchWithRetry(MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    }, {
      telemetry: {
        spanName: "anthropic.scan_aerial_ghosts",
        provider: "anthropic",
        attributes: {
          "pipeline.stage": "design",
          "model.name": VISION_MODEL,
        },
      },
    });
    if (!res.ok) return fallback();

    const json = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const textBlock = json.content.find((c) => c.type === "text");
    if (!textBlock) return fallback();

    const cleaned = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned) as {
      suggestions?: Array<{
        symbol_id?: string;
        x_pct?: number;
        y_pct?: number;
        confidence?: number;
        reason?: string;
      }>;
    };

    const allowedSet = new Set(args.symbol_ids);
    const out: GhostPlacementSuggestion[] = [];
    for (const s of parsed.suggestions ?? []) {
      if (!s.symbol_id || !allowedSet.has(s.symbol_id)) continue;
      const x = Number(s.x_pct);
      const y = Number(s.y_pct);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out.push({
        id: crypto.randomUUID(),
        symbol_id: s.symbol_id,
        x_pct: Math.min(100, Math.max(0, x)),
        y_pct: Math.min(100, Math.max(0, y)),
        confidence: Math.min(1, Math.max(0, Number(s.confidence) || 0.5)),
        reason: s.reason?.trim() || "AI aerial hint",
      });
    }
    return out.length > 0 ? out : fallback();
  } catch {
    return fallback();
  }
}

const CAD_OPS_SYSTEM = `You are the AI CAD engine for Workstream (Curtis & Co, Melbourne landscape).
Emit deterministic CAD operations in metre space (origin SW of aerial frame, Y-up).
Return strict JSON only — no markdown.

Schema:
{
  "ops": [ CadOp, ... ],
  "rationale": "short string"
}

Allowed CadOp.op values:
- add_layer { name, color? }
- add_line { layer, start:{x,y}, end:{x,y}, ghost }
- add_polyline { layer, points:[{x,y}], closed, ghost }
- add_circle { layer, center:{x,y}, radius, ghost }
- add_arc { layer, center, radius, start_angle_deg, end_angle_deg, ghost }
- add_text { layer, position, height, value, rotation_deg?, ghost }
- add_insert { layer, block_name, position, scale?, rotation_deg?, ghost }
- add_dim { layer, p1, p2, offset?, ghost }
- offset_polyline { entity_id, distance, ghost }
- delete_entity { entity_id }

Layers: SKETCH-REF, PLANTING, HARDSCAPE, STRUCTURES, WATER, IRRIGATION, TRP, ANNOTATION, DIMENSIONS, PERMITS.

Rules:
- All new AI geometry MUST set ghost: true.
- Stay inside width_m × height_m.
- TRP circles are indicative (AS 4970) — never claim survey accuracy.
- Prefer closed polylines for lawn/paving envelopes; inserts for plant symbols (block_name = catalog symbol_id).
- Do not invent lodgement-ready dimensions.
- Max 80 ops.`;

export type CadOpsContext = {
  address: string;
  width_m: number;
  height_m: number;
  sketch_summary: string;
  planning_notes: string;
  instruction?: string | null;
  existing_entity_brief?: string | null;
  catalog_symbol_ids?: string[];
};

function devFallbackCadOps(ctx: CadOpsContext): { ops: CadOp[]; rationale: string } {
  const w = ctx.width_m;
  const h = ctx.height_m;
  const margin = Math.min(w, h) * 0.12;
  const ops: CadOp[] = [
    {
      op: "add_polyline",
      layer: "HARDSCAPE",
      closed: true,
      ghost: true,
      points: [
        { x: margin, y: margin },
        { x: w - margin, y: margin },
        { x: w - margin, y: h * 0.45 },
        { x: margin, y: h * 0.45 },
      ],
    },
    {
      op: "add_circle",
      layer: "TRP",
      ghost: true,
      center: { x: w * 0.72, y: h * 0.68 },
      radius: Math.min(w, h) * 0.08,
    },
    {
      op: "add_text",
      layer: "ANNOTATION",
      ghost: true,
      position: { x: margin, y: h - margin },
      height: 0.4,
      value: "AI CAD proposal — accept to commit",
      rotation_deg: 0,
    },
  ];
  if (ctx.catalog_symbol_ids?.length) {
    ops.push({
      op: "add_insert",
      layer: "PLANTING",
      ghost: true,
      block_name: ctx.catalog_symbol_ids[0]!,
      position: { x: w * 0.35, y: h * 0.62 },
      scale: 1,
      rotation_deg: 0,
    });
  }
  return {
    ops,
    rationale:
      "Dev fallback AI CAD envelope + indicative TRP — ANTHROPIC_API_KEY not configured or model parse failed.",
  };
}

export async function generateCadOps(
  ctx: CadOpsContext,
): Promise<{ ops: CadOp[]; rationale: string }> {
  const apiKey = getOwnerEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return devFallbackCadOps(ctx);
  }

  const symbols = (ctx.catalog_symbol_ids ?? []).slice(0, 40).join(", ");
  const user = [
    `Address: ${ctx.address}`,
    `Canvas: ${ctx.width_m.toFixed(2)} m × ${ctx.height_m.toFixed(2)} m (origin SW, Y-up)`,
    ctx.instruction
      ? `Edit instruction: ${ctx.instruction}`
      : "Generate an initial AI CAD proposal from the sketch.",
    "",
    "Sketch summary:",
    ctx.sketch_summary || "(empty)",
    "",
    "Planning notes:",
    ctx.planning_notes || "(none)",
    "",
    "Existing entities (for edit/offset — use entity_id when needed):",
    ctx.existing_entity_brief || "(none)",
    "",
    `Catalog block_name values (prefer these for add_insert): ${symbols || "(none)"}`,
  ].join("\n");

  const body = {
    model: DESIGN_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: CAD_OPS_SYSTEM }],
    messages: [{ role: "user", content: user }],
  };

  try {
    const res = await fetchWithRetry(
      MESSAGES_URL,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      },
      {
        telemetry: {
          spanName: "anthropic.generate_cad_ops",
          provider: "anthropic",
          attributes: {
            "pipeline.stage": "cad",
            "model.name": DESIGN_MODEL,
          },
        },
      },
    );
    if (!res.ok) return devFallbackCadOps(ctx);

    const json = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const textBlock = json.content.find((c) => c.type === "text");
    if (!textBlock) return devFallbackCadOps(ctx);

    const cleaned = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned) as unknown;
    const batch = CadOpsBatchSchema.safeParse(parsed);
    if (!batch.success || batch.data.ops.length === 0) {
      return devFallbackCadOps(ctx);
    }
    // Force ghost on generative ops
    const ops = batch.data.ops.map((op) => {
      if ("ghost" in op) return { ...op, ghost: true };
      return op;
    }) as CadOp[];
    return {
      ops,
      rationale: batch.data.rationale ?? "AI CAD ops",
    };
  } catch {
    return devFallbackCadOps(ctx);
  }
}

export async function runStudioAssist(args: {
  project: { name: string; address: string };
  site: StudioPromptSite;
  canvasElementCount: number;
  message: string;
  sketch_brief?: string | null;
  symbol_ids: string[];
  tier1: boolean;
}): Promise<{ reply: string; suggestions: GhostPlacementSuggestion[] }> {
  const fallback = () => {
    const suggestions = buildGhostPlacementSuggestions({
      tier1: args.tier1,
      symbolIds: args.symbol_ids,
    });
    return {
      reply: args.tier1
        ? "Indicative Wrights Terrace massing — accept ghosts to commit placements."
        : "Indicative Curtis-style placements — accept ghosts to commit.",
      suggestions,
    };
  };

  const apiKey = getOwnerEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return fallback();

  const system = buildStudioSystemPrompt(
    { name: args.project.name, address: args.project.address },
    args.canvasElementCount,
    args.site,
  );

  const userText = [
    args.sketch_brief ? `Current sketch:\n${args.sketch_brief}\n` : "",
    `Operator request:\n${args.message}`,
    "",
    `Allowed symbol_id values: ${args.symbol_ids.slice(0, 80).join(", ")}`,
    "",
    "Respond with 2–3 sentences of practical advice, then a <canvas_suggestions> JSON array:",
    '[{"symbol_id":"...","x_pct":0-100,"y_pct":0-100,"reason":"...","confidence":0.0-1.0}]',
    "All coordinates are percentage of the aerial (0–100). Suggestions stay indicative.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const body = {
      model: VISION_MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: system }],
      messages: [{ role: "user", content: userText }],
    };

    const res = await fetchWithRetry(
      MESSAGES_URL,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      },
      {
        telemetry: {
          spanName: "anthropic.studio_assist",
          provider: "anthropic",
          attributes: {
            "pipeline.stage": "design",
            "model.name": VISION_MODEL,
          },
        },
      },
    );
    if (!res.ok) return fallback();

    const json = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const textBlock = json.content.find((c) => c.type === "text");
    if (!textBlock) return fallback();

    const allowed = new Set(args.symbol_ids);
    const parsed = parseStudioAssistResponse(textBlock.text, allowed);
    if (parsed.suggestions.length === 0) {
      const heuristic = buildGhostPlacementSuggestions({
        tier1: args.tier1,
        symbolIds: args.symbol_ids,
      });
      return {
        reply: parsed.reply,
        suggestions: heuristic,
      };
    }
    return parsed;
  } catch {
    return fallback();
  }
}
