import type { GhostPlacementSuggestion } from "@workstream/contracts";

export type ParsedStudioAssist = {
  reply: string;
  suggestions: GhostPlacementSuggestion[];
};

/** Extract prose reply and canvas suggestion ghosts from model output. */
export function parseStudioAssistResponse(
  text: string,
  allowedSymbolIds: Set<string>,
): ParsedStudioAssist {
  const tagMatch = text.match(
    /<canvas_suggestions>\s*([\s\S]*?)\s*<\/canvas_suggestions>/i,
  );
  let reply = text
    .replace(/<canvas_suggestions>[\s\S]*?<\/canvas_suggestions>/i, "")
    .trim()
    .replace(/^```(?:markdown|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const suggestions: GhostPlacementSuggestion[] = [];
  const rawJson = tagMatch?.[1]?.trim();
  if (rawJson) {
    try {
      const cleaned = rawJson
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");
      const arr = JSON.parse(cleaned) as Array<{
        symbol_id?: string;
        x_pct?: number;
        y_pct?: number;
        reason?: string;
        confidence?: number;
      }>;
      for (const s of arr) {
        if (!s.symbol_id || !allowedSymbolIds.has(s.symbol_id)) continue;
        const x = Number(s.x_pct);
        const y = Number(s.y_pct);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        suggestions.push({
          id: crypto.randomUUID(),
          symbol_id: s.symbol_id,
          x_pct: Math.min(100, Math.max(0, x)),
          y_pct: Math.min(100, Math.max(0, y)),
          confidence: Math.min(
            1,
            Math.max(0, Number(s.confidence) || 0.65),
          ),
          reason: s.reason?.trim() || "AI sketch suggestion",
        });
      }
    } catch {
      /* ignore malformed JSON */
    }
  }

  if (!reply) {
    reply =
      suggestions.length > 0
        ? "Here are indicative placements — accept any ghost to commit."
        : "No layout changes suggested yet.";
  }

  return { reply, suggestions };
}
