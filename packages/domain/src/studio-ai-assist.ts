/**
 * AI-first studio brief — deterministic heuristics (no auto-save).
 * Vision ghosts remain client-ephemeral until the operator confirms.
 */

export type StudioAiSuggestion = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  action: "quote" | "save" | "trp" | "schedule" | "place" | "cad";
  symbol_id?: string;
};

export type SketchCanvasAiInput = {
  placementCount: number;
  hasPlanningSymbol: boolean;
  hasHardscape: boolean;
  hasStructurePlanting: boolean;
  tier1: boolean;
  sketchReadyForCad: boolean;
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

/**
 * 2026 one-canvas sketch ribbon AI — progressive, action-first coaching.
 * Prefer structure → massing → TRP → CAD over generic tips.
 */
export function buildSketchCanvasAiSuggestions(
  input: SketchCanvasAiInput,
): StudioAiSuggestion[] {
  const out: StudioAiSuggestion[] = [];

  if (input.tier1) {
    out.push({
      id: "tier1-ribbon",
      priority: "high",
      title: "Architectural massing",
      detail: "Lock front entry + rear courtyard, then promote quote.",
      action: "place",
      symbol_id: "hornbeam-pleached",
    });
  }

  if (input.placementCount === 0) {
    out.push({
      id: "structure-first",
      priority: "high",
      title: "Structure first",
      detail: "Place canopy or pleached screen — then mass planting.",
      action: "place",
      symbol_id: "hornbeam-pleached",
    });
    return out;
  }

  if (!input.hasStructurePlanting) {
    out.push({
      id: "add-canopy",
      priority: "high",
      title: "Add canopy anchors",
      detail: "Trees or screens give the plan scale before hardscape densifies.",
      action: "place",
      symbol_id: "olive-standard",
    });
  }

  if (!input.hasHardscape && input.placementCount >= 2) {
    out.push({
      id: "add-hardscape",
      priority: "medium",
      title: "Lay a path language",
      detail: "Bluestone or steppers tie massing to circulation.",
      action: "place",
      symbol_id: "bluestone-paver",
    });
  }

  if (!input.hasPlanningSymbol && input.placementCount >= 1) {
    out.push({
      id: "trp-ribbon",
      priority: "medium",
      title: "Protect retained trees",
      detail: "Drop a TRP ring where canopy protection applies.",
      action: "trp",
      symbol_id: "tree-root-protection",
    });
  }

  if (input.sketchReadyForCad) {
    out.push({
      id: "draft-cad",
      priority: "high",
      title: "Draft working drawing",
      detail: "Sketch is dense enough — generate AI CAD on this aerial.",
      action: "cad",
    });
  } else if (input.placementCount >= 3) {
    out.push({
      id: "mass-fill",
      priority: "low",
      title: "Mass the ground plane",
      detail: "Paint Lomandra or turf between structure — live BOM tracks it.",
      action: "place",
      symbol_id: "lomandra-mass",
    });
  }

  return out.slice(0, 3);
}

/** Ordered coaching cards for the AI rail (AI-first workflow). */
export function buildStudioAiSuggestions(
  input: StudioAiAssistInput,
): StudioAiSuggestion[] {
  const out: StudioAiSuggestion[] = [];

  if (input.tier1) {
    out.push({
      id: "tier1-massing",
      priority: "high",
      title: "Architectural massing",
      detail:
        "36 Wrights Terrace: front entry bluestone + specimen anchors, rear courtyard discipline. Save the sketch, then open Quote for zones and workbook savings.",
      action: "quote",
    });
  }

  if (input.placementCount === 0) {
    out.push({
      id: "start-sketch",
      priority: "high",
      title: "Start with structure on the aerial",
      detail:
        "Place pleached hornbeam or site trees first, then mass planting and hardscape. This layout feeds the working drawing and live BOM.",
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
      id: "promote-quote",
      priority: "high",
      title: "Promote sketch to quote",
      detail:
        "Save the plan, draft CAD, accept suggestions, then open Quote to promote the live BOM.",
      action: "quote",
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
      detail: "Unsaved sketch changes will not feed CAD or quote.",
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
      reason: "Front entry — formal pleached screen along lacework",
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
        reason: "Rear courtyard — mass-planted ground plane",
      });
    }
  }

  return ghosts;
}
