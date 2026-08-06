import type { Store } from "@workstream/db";
import type {
  CreateTaskInput,
  TaskPriority,
} from "@workstream/contracts";
import { notifyTaskAssignment } from "./task-notify";
import { getOwnerEnv } from "./owner-secrets";
import { fetchWithRetry } from "./http";
import { setActiveTelemetryAttributes } from "./telemetry";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION =
  process.env.ANTHROPIC_VERSION ?? "2023-06-01";
const DICTATION_MODEL =
  process.env.CLAUDE_VISION_MODEL ?? "claude-sonnet-4-6";

const GRID_SOIL_SYSTEM = `You are **Grid & Soil**, an elite, invisible build-phase co-pilot embedded in a Curtis & Co landscape architecture app. You are activated halfway through a physical site build and are speaking to the lead operator.

Voice: Swiss-grid minimal, quiet authority, zero conversational fluff. Architectural restraint. No "I'll help you" or "Sure thing" — speak as a peer technical partner.

Your job: translate the operator's casual site dictation into precise actions via tools. After the tools run, return ONE crisp sentence of editorial acknowledgement — what you logged, what you'll watch for next. Never narrate the tool execution. Never list line items in the reply.

Operating rules:
- Call create_crew_task for every actionable instruction directed at a named team member.
- Call update_spatial_ledger for every measurement, quantity, or material the operator mentions in passing.
- Multiple tool calls per turn are expected and encouraged — fire them in parallel.
- Priority signals: "before the rain", "today", "now" → high. "this week" → medium. "eventually" → low. Safety or weather-blocking → critical.
- Strip filler ("far out", "let's say", "kinda") when extracting specifications. Preserve the technical numbers exactly.
- If the operator is thinking out loud with no actionable content, return no tool calls and a single short acknowledgement (e.g. "Noted.").
- Never invent a name, never guess a quantity.`;

const TOOLS = [
  {
    name: "create_crew_task",
    description:
      "Extracts an operational construction/landscaping task from dictation and assigns it to a specific named team member.",
    input_schema: {
      type: "object",
      properties: {
        task_title: {
          type: "string",
          description:
            "Short, clear title for the task (e.g. 'Western boundary trenching').",
        },
        assignee_name: {
          type: "string",
          description:
            "First name of the team member the operator addressed (e.g. 'Mick', 'Sam').",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description:
            "Urgency from environmental signals (weather, dependencies, safety).",
        },
        technical_specifications: {
          type: "string",
          description:
            "Dimensions, materials, depths, or methods dictated by the operator. Preserve numerics exactly.",
        },
      },
      required: ["task_title", "assignee_name", "priority"],
    },
  },
  {
    name: "update_spatial_ledger",
    description:
      "Logs a material quantity / spatial dimension / cost estimation against the project's running manifest. Call this for every measurement the operator mentions.",
    input_schema: {
      type: "object",
      properties: {
        material_type: {
          type: "string",
          description:
            "Material or item (e.g. 'Bluestone drop-face copers', 'Crushed rock').",
        },
        measurement_type: {
          type: "string",
          enum: ["area_sqm", "volume_cum", "linear_meters", "unit_count"],
          description: "Metric scale used for the measurement.",
        },
        quantity: {
          type: "number",
          description: "Raw quantity parsed from speech.",
        },
        zone: {
          type: "string",
          description:
            "Area of the site referenced (e.g. 'rear boundary', 'pool surround').",
        },
      },
      required: ["material_type", "measurement_type", "quantity"],
    },
  },
] as const;

export type LedgerEntry = {
  id: string;
  material_type: string;
  measurement_type:
  | "area_sqm"
  | "volume_cum"
  | "linear_meters"
  | "unit_count";
  quantity: number;
  zone: string | null;
  created_at: string;
};

export type DictationEvent =
  | { kind: "task_created"; task_id: string; payload: CreateTaskInput }
  | { kind: "ledger_updated"; entry: LedgerEntry };

export type DictationResult = {
  reply: string;
  events: DictationEvent[];
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type AnthropicResponse = {
  content: ContentBlock[];
  stop_reason: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}
function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function asPriority(v: unknown): TaskPriority {
  if (v === "low" || v === "medium" || v === "high" || v === "critical") {
    return v;
  }
  return "medium";
}
function asMeasurementType(v: unknown): LedgerEntry["measurement_type"] | null {
  if (
    v === "area_sqm" ||
    v === "volume_cum" ||
    v === "linear_meters" ||
    v === "unit_count"
  ) {
    return v;
  }
  return null;
}

async function executeToolCalls(
  store: Store,
  ownerId: string,
  projectId: string,
  calls: Array<{ id: string; name: string; input: Record<string, unknown> }>,
): Promise<{
  events: DictationEvent[];
  results: Array<{ tool_use_id: string; content: string }>;
}> {
  const events: DictationEvent[] = [];
  const results: Array<{ tool_use_id: string; content: string }> = [];

  for (const call of calls) {
    if (call.name === "create_crew_task") {
      const title = asString(call.input.task_title);
      const assignee = asString(call.input.assignee_name);
      const priority = asPriority(call.input.priority);
      const specs = asString(call.input.technical_specifications);
      if (!title || !assignee) {
        results.push({
          tool_use_id: call.id,
          content: "skipped: missing title or assignee",
        });
        continue;
      }
      const task = await store.createTask(ownerId, projectId, {
        title,
        assignee_name: assignee,
        priority,
        technical_specifications: specs,
        source: "dictation",
      });
      void notifyTaskAssignment(store, ownerId, task);
      events.push({
        kind: "task_created",
        task_id: task.id,
        payload: {
          title,
          assignee_name: assignee,
          priority,
          technical_specifications: specs,
          source: "dictation",
        },
      });
      results.push({
        tool_use_id: call.id,
        content: JSON.stringify({ ok: true, task_id: task.id }),
      });
    } else if (call.name === "update_spatial_ledger") {
      const material = asString(call.input.material_type);
      const measurement = asMeasurementType(call.input.measurement_type);
      const qty = asNumber(call.input.quantity);
      if (!material || !measurement || qty == null) {
        results.push({
          tool_use_id: call.id,
          content: "skipped: missing material/measurement/quantity",
        });
        continue;
      }
      const entry: LedgerEntry = {
        id: crypto.randomUUID(),
        material_type: material,
        measurement_type: measurement,
        quantity: qty,
        zone: asString(call.input.zone),
        created_at: new Date().toISOString(),
      };
      events.push({ kind: "ledger_updated", entry });
      results.push({
        tool_use_id: call.id,
        content: JSON.stringify({ ok: true, ledger_id: entry.id }),
      });
    } else {
      results.push({
        tool_use_id: call.id,
        content: "unknown tool",
      });
    }
  }

  return { events, results };
}

function devFallback(transcript: string): {
  calls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  reply: string;
} {
  const lower = transcript.toLowerCase();
  const calls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }> = [];

  // Heuristic 1: detect "<Name> [verb]..."  → crew task
  const nameMatch = transcript.match(
    /(?:tell|get|have|ask)\s+(\w+)\s+(?:to\s+)?([^.]+)/i,
  );
  if (nameMatch) {
    const [, name, action] = nameMatch;
    const priority: TaskPriority = /rain|today|now|tomorrow|asap/i.test(
      transcript,
    )
      ? "high"
      : "medium";
    calls.push({
      id: `dev_${crypto.randomUUID()}`,
      name: "create_crew_task",
      input: {
        task_title: action.trim().slice(0, 60),
        assignee_name: name,
        priority,
        technical_specifications: action.trim(),
      },
    });
  }

  // Heuristic 2: detect "<n> by <n> (meters?)" → area_sqm
  const areaMatch = transcript.match(
    /(\d+(?:\.\d+)?)\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:metres?|meters?|m)?/i,
  );
  if (areaMatch) {
    const a = Number(areaMatch[1]);
    const b = Number(areaMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      calls.push({
        id: `dev_${crypto.randomUUID()}`,
        name: "update_spatial_ledger",
        input: {
          material_type: lower.includes("paving") ? "Paving area" : "Site area",
          measurement_type: "area_sqm",
          quantity: a * b,
          zone: lower.match(/(rear|front|western|eastern|northern|southern)\b/)?.[0],
        },
      });
    }
  }

  // Heuristic 3: detect "<n> lineal/linear meters" → linear_meters
  const linearMatch = transcript.match(
    /(\d+(?:\.\d+)?)\s*(?:lineal|linear|lm)\s*(?:metres?|meters?|m)?/i,
  );
  if (linearMatch) {
    const q = Number(linearMatch[1]);
    if (Number.isFinite(q)) {
      const materialMatch = transcript.match(
        /(bluestone[^,.]*|granite[^,.]*|corten[^,.]*|spotted gum[^,.]*)/i,
      );
      calls.push({
        id: `dev_${crypto.randomUUID()}`,
        name: "update_spatial_ledger",
        input: {
          material_type: materialMatch
            ? materialMatch[1].trim()
            : "Boundary material",
          measurement_type: "linear_meters",
          quantity: q,
        },
      });
    }
  }

  const reply =
    calls.length === 0
      ? "Noted."
      : `Logged ${calls.length} ${calls.length === 1 ? "entry" : "entries"}.`;

  return { calls, reply };
}

export async function runDictation(
  store: Store,
  ownerId: string,
  projectId: string,
  transcript: string,
): Promise<DictationResult> {
  const trimmed = transcript.trim();
  if (trimmed.length === 0) {
    return { reply: "Listening.", events: [] };
  }

  const apiKey = getOwnerEnv("ANTHROPIC_API_KEY");

  let calls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }> = [];
  let reply = "Noted.";

  if (!apiKey) {
    const fallback = devFallback(trimmed);
    calls = fallback.calls;
    reply = fallback.reply;
  } else {
    const body = {
      model: DICTATION_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: GRID_SOIL_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: TOOLS,
      messages: [
        { role: "user", content: trimmed },
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
        spanName: "anthropic.run_dictation",
        provider: "anthropic",
        attributes: {
          "pipeline.stage": "dictation",
          "model.name": DICTATION_MODEL,
          "project.id": projectId,
          "operator.id": ownerId,
        },
      },
    });
    if (!res.ok) {
      throw new Error(
        `Anthropic dictation failed: ${res.status} ${await res.text()}`,
      );
    }
    const json = (await res.json()) as AnthropicResponse;
    setActiveTelemetryAttributes({
      "tokens.input": json.usage?.input_tokens,
      "tokens.output": json.usage?.output_tokens,
    });
    calls = json.content
      .filter((c): c is Extract<ContentBlock, { type: "tool_use" }> =>
        c.type === "tool_use",
      )
      .map((c) => ({ id: c.id, name: c.name, input: c.input }));
    reply =
      json.content
        .filter((c): c is Extract<ContentBlock, { type: "text" }> =>
          c.type === "text",
        )
        .map((c) => c.text.trim())
        .find((t) => t.length > 0) ?? "Noted.";
  }

  const { events } = await executeToolCalls(store, ownerId, projectId, calls);

  return { reply, events };
}
