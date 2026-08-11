import type { VoiceIntentClassificationResponse } from "@workstream/contracts";
import { classifyVoiceIntent as lexicalClassify } from "@workstream/domain";
import { getOwnerEnv } from "./owner-secrets";
import { fetchWithRetry } from "./http";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION ?? "2023-06-01";
const CLASSIFY_MODEL = process.env.CLAUDE_VOICE_INTENT_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You classify spoken landscape-design transcripts. Given the user's transcript, decide whether it is a design instruction (adds, moves, places, sizes, or specifies landscape elements like plants, paving, paths, beds, decks, lawns, trees, hedges, or garden features) or an operational dictation (crew tasks, measurements, material quantities, notes, weather, scheduling, or site observations that do not change geometry).

Return ONLY a JSON object with two keys:
- kind: "design" or "dictation"
- confidence: a number between 0 and 1 indicating how clear the classification is

Examples:
- "Create a 2.4 metre bluestone path from the gate to the terrace" → {"kind":"design","confidence":0.95}
- "Sam, check the western trench before the rain" → {"kind":"dictation","confidence":0.92}
- "Add a pleached hornbeam hedge along the north boundary" → {"kind":"design","confidence":0.96}
- "We need twenty bags of crushed rock by Wednesday" → {"kind":"dictation","confidence":0.88}`;

type ProviderResult = {
  kind: "design" | "dictation";
  confidence: number;
};

async function classifyWithAnthropic(
  transcript: string,
): Promise<ProviderResult | null> {
  const apiKey = getOwnerEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const res = await fetchWithRetry(
    MESSAGES_URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: CLASSIFY_MODEL,
        max_tokens: 128,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Transcript: "${transcript}"\n\nReturn JSON only.`,
          },
        ],
      }),
    },
    {
      telemetry: {
        spanName: "anthropic.classify_voice_intent",
        provider: "anthropic",
        attributes: { "pipeline.stage": "voice_intent" },
      },
    },
  );

  if (!res.ok) {
    throw new Error(
      `Anthropic voice-intent classification failed: ${res.status} ${await res.text()}`,
    );
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = json.content.find((c) => c.type === "text")?.text ?? "";
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "kind" in parsed &&
      "confidence" in parsed &&
      (parsed.kind === "design" || parsed.kind === "dictation") &&
      typeof parsed.confidence === "number" &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
    ) {
      return parsed as ProviderResult;
    }
  } catch {
    /* malformed JSON — fall through to null */
  }
  return null;
}

export type ClassifyVoiceIntentInput = {
  transcript: string;
  confidence: number | null;
  source: "mobile_recording" | "push_to_talk" | "typed";
};

export async function classifyVoiceIntent(
  input: ClassifyVoiceIntentInput,
): Promise<VoiceIntentClassificationResponse> {
  let providerResult: ProviderResult | null = null;
  let classifier: "anthropic" | "lexical" = "lexical";

  try {
    providerResult = await classifyWithAnthropic(input.transcript);
    if (providerResult) classifier = "anthropic";
  } catch {
    /* Anthropic unavailable — fall through to lexical */
  }

  if (!providerResult) {
    const kind = lexicalClassify(input.transcript);
    providerResult = {
      kind,
      confidence: input.confidence ?? 0.5,
    };
  }

  return {
    kind: providerResult.kind,
    transcript: input.transcript,
    confidence: providerResult.confidence,
    source: input.source,
    classifier,
    dil_recorded: false,
  };
}
