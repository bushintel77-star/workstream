/**
 * AI-first studio brief — deterministic heuristics (no auto-save).
 * Vision ghosts remain client-ephemeral until the operator confirms.
 */

export type StudioAiSuggestion = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  action: "develop" | "save" | "trp" | "schedule" | "place";
  symbol_id?: string;
};

export type GhostPlacementSuggestion = {
  id: string;
  symbol_id: string;
  x_pct: number;
  y_pct: number;
  confidence: number;
  reason: string;
};

export type StudioAiAssistInput = {
  placementCount: number;
  strokeCount: number;
  zoneCount: number;
  hasPlanningSymbol: boolean;
  tier1: boolean;
  hasDesign: boolean;
};

/** Ordered coaching cards for the AI rail (AI-first workflow). */
export function buildStudioAiSuggestions(
  input: StudioAiAssistInput,
): StudioAiSuggestion[] {
  const out: StudioAiSuggestion[] = [];

  if (input.tier1) {
    out.push({
      id: "tier1-massing",
      priority: "high",
      title: "Tier-1 architectural massing",
      detail:
        "36 Wrights Terrace: front entry bluestone + specimen anchors, rear courtyard discipline. Run develop from sketch to lock zones and costing parity.",
      action: "develop",
    });
  }

  if (input.placementCount === 0) {
    out.push({
      id: "start-sketch",
      priority: "high",
      title: "Start with structure on the aerial",
      detail:
        "Place pleached hornbeam or site trees first, then mass planting and hardscape. AI develop reads this layout.",
      action: "place",
      symbol_id: "hornbeam-pleached",
    });
  } else if (!input.hasPlanningSymbol) {
    out.push({
      id: "trp-check",
      priority: "medium",
      title: "Check tree protection",
      detail:
        "Add TRP or retained-tree symbols where canopy protection applies — council and arborist review.",
      action: "trp",
      symbol_id: "tree-root-protection",
    });
  }

  if (input.placementCount > 0 && !input.hasDesign) {
    out.push({
      id: "develop",
      priority: "high",
      title: "Develop design from sketch",
      detail:
        "Save the plan, then run AI develop to generate zones, species blocks, and quote-ready rationale.",
      action: "develop",
    });
  }

  if (input.placementCount > 0) {
    out.push({
      id: "schedule",
      priority: "medium",
      title: "Live schedule estimate",
      detail:
        "Open Schedule for GST line items from placements and irrigation zones.",
      action: "schedule",
    });
  }

  if (input.strokeCount === 0 && input.placementCount > 0) {
    out.push({
      id: "markup",
      priority: "low",
      title: "Optional site markup",
      detail: "Use Draw for beds, limits, or notes — survey ink only, concept sketch.",
      action: "place",
    });
  }

  return out;
}

/** Extend suggestions when studio reports dirty state. */
export function withDirtySaveSuggestion(
  suggestions: StudioAiSuggestion[],
  isDirty: boolean,
): StudioAiSuggestion[] {
  if (!isDirty) {
    return suggestions.filter((s) => s.id !== "save");
  }
  const has = suggestions.some((s) => s.id === "save");
  if (has) return suggestions;
  return [
    {
      id: "save",
      priority: "high",
      title: "Save before leaving studio",
      detail: "Unsaved sketch changes will not feed envelope or AI develop.",
      action: "save",
    },
    ...suggestions,
  ];
}

/**
 * Ephemeral ghost overlays — heuristic layout hints (not vision API).
 * Operator confirms before symbols enter the saved canvas.
 */
export function buildGhostPlacementSuggestions(input: {
  tier1: boolean;
  symbolIds: string[];
}): GhostPlacementSuggestion[] {
  const has = (id: string) => input.symbolIds.includes(id);
  const ghosts: GhostPlacementSuggestion[] = [];

  if (input.tier1 && has("hornbeam-pleached")) {
    ghosts.push({
      id: "ghost-tier1-hornbeam",
      symbol_id: "hornbeam-pleached",
      x_pct: 28,
      y_pct: 62,
      confidence: 0.88,
      reason: "Tier-1 front entry — formal pleached screen along lacework",
    });
  }

  if (has("tree-root-protection")) {
    ghosts.push({
      id: "ghost-trp",
      symbol_id: "tree-root-protection",
      x_pct: 55,
      y_pct: 38,
      confidence: 0.72,
      reason: "Suggested TPZ fence — confirm with arborist report",
    });
  }

  const deciduous = input.symbolIds.find((id) =>
    /tree|hornbeam|lomandra/i.test(id),
  );
  if (deciduous && !input.tier1) {
    ghosts.push({
      id: "ghost-tree",
      symbol_id: deciduous,
      x_pct: 68,
      y_pct: 45,
      confidence: 0.65,
      reason: "Canopy anchor — typical rear yard retained tree",
    });
  }

  if (input.tier1) {
    const mass = input.symbolIds.find((id) => /lomandra/i.test(id));
    if (mass) {
      ghosts.push({
        id: "ghost-tier1-mass",
        symbol_id: mass,
        x_pct: 72,
        y_pct: 58,
        confidence: 0.8,
        reason: "Tier-1 rear courtyard — mass-planted ground plane",
      });
    }
  }

  return ghosts;
}
