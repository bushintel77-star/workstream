import type {
  CatalogPlacement,
  CatalogSymbol,
  DesignCanvas,
  Survey,
} from "@workstream/contracts";
import { summarizePlacementsForQuote } from "./catalog-quote";
import { sketchQtyForSymbol } from "./sketch-costing";

export type Municipality = "stonnington" | "yarra" | "unknown";

export type PlanningCategory =
  | "tree_protection"
  | "stormwater"
  | "heritage"
  | "permit"
  | "council";

export type PlanningSeverity = "likely" | "review" | "clear";

export type PlanningFlag = {
  id: string;
  category: PlanningCategory;
  severity: PlanningSeverity;
  title: string;
  detail: string;
  /** Suggested Workstream output to draft next. */
  output_kind?:
    | "permit_stonnington_stormwater"
    | "permit_yarra_heritage"
    | "scope";
};

const STONNINGTON_LOCALITIES = [
  "stonnington",
  "prahran",
  "malvern",
  "armadale",
  "toorak",
  "windsor",
  "south yarra",
  "hawksburn",
  "kooyong",
];

const YARRA_LOCALITIES = [
  "yarra",
  "fitzroy",
  "richmond",
  "collingwood",
  "abbotsford",
  "clifton hill",
  "cremorne",
  "burnley",
  "hawthorn", // often Boroondara but clients say Yarra fringe
];

const TREE_SYMBOL_IDS = new Set([
  "hornbeam-pleached",
  "olive-standard",
  "box-ball",
  "existing-tree-retain",
  "tree-root-protection",
]);

const HARDSCAPE_SYMBOL_IDS = new Set([
  "bluestone-paver",
  "granite-stepper",
  "sandstone-crazy",
  "basalt-grid",
  "timber-deck",
  "gravel-mulch",
]);

/** Infer inner-Melbourne municipality from address string (confirm on Vicmap later). */
export function detectMunicipality(address: string): Municipality {
  const lower = address.toLowerCase();
  if (STONNINGTON_LOCALITIES.some((l) => lower.includes(l))) return "stonnington";
  if (YARRA_LOCALITIES.some((l) => lower.includes(l))) return "yarra";
  return "unknown";
}

function estimateHardscapeM2(
  placements: CatalogPlacement[],
  symbols: CatalogSymbol[],
  survey: Pick<Survey, "garden_area_m2">,
): number {
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));
  let m2 = 0;
  const counts = new Map<string, number>();
  for (const p of placements) {
    counts.set(p.symbol_id, (counts.get(p.symbol_id) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    if (!HARDSCAPE_SYMBOL_IDS.has(id)) continue;
    const sym = symbolMap.get(id);
    if (!sym) continue;
    m2 += sketchQtyForSymbol(sym, count, survey);
  }
  return m2;
}

function placementHas(
  placements: CatalogPlacement[],
  symbolIds: Set<string> | string,
): boolean {
  const set =
    typeof symbolIds === "string" ? new Set([symbolIds]) : symbolIds;
  return placements.some((p) => set.has(p.symbol_id));
}

/** Preliminary planning / permit flags from envelope sketch + site. */
export function assessPlanningFromSketch(
  address: string,
  survey: Pick<Survey, "garden_area_m2" | "lot_area_m2" | "house_area_m2">,
  canvas: DesignCanvas | null | undefined,
  symbols: CatalogSymbol[] = [],
): PlanningFlag[] {
  const flags: PlanningFlag[] = [];
  const municipality = detectMunicipality(address);
  const placements = canvas?.placements ?? [];

  if (municipality === "stonnington") {
    flags.push({
      id: "council-stonnington",
      category: "council",
      severity: "clear",
      title: "City of Stonnington",
      detail: "Address matches Stonnington localities — use Stonnington planning and stormwater policies.",
    });
  } else if (municipality === "yarra") {
    flags.push({
      id: "council-yarra",
      category: "council",
      severity: "clear",
      title: "City of Yarra",
      detail: "Address matches Yarra localities — check heritage overlay and streetscape guidelines.",
    });
  } else {
    flags.push({
      id: "council-unknown",
      category: "council",
      severity: "review",
      title: "Confirm council",
      detail: "Municipality not inferred from address — confirm via Vicmap / planning certificate before lodgement.",
    });
  }

  const trpMarked = placementHas(placements, "tree-root-protection");
  const retainTree = placementHas(placements, "existing-tree-retain");
  const newTrees = placements.some((p) =>
    TREE_SYMBOL_IDS.has(p.symbol_id) &&
    p.symbol_id !== "existing-tree-retain" &&
    p.symbol_id !== "tree-root-protection",
  );

  if (trpMarked || retainTree || newTrees) {
    flags.push({
      id: "trp-as4970",
      category: "tree_protection",
      severity: trpMarked ? "likely" : "review",
      title: "Tree root protection (AS 4970)",
      detail: trpMarked
        ? "TRP zone marked on sketch — arborist report, TPZ/SRP fencing and supervision likely before excavation."
        : retainTree
          ? "Existing tree to retain — confirm TPZ/SRP with arborist; no grade change inside protection zone without approval."
          : "New trees on sketch near dwelling — check for existing canopy trees on or off lot; TRP may apply to works within root zones.",
      output_kind: "scope",
    });
  }

  const hardscapeM2 = estimateHardscapeM2(placements, symbols, survey);
  const pool = placementHas(placements, "pool");
  if (municipality === "stonnington" && (hardscapeM2 >= 15 || pool)) {
    flags.push({
      id: "stonnington-stormwater",
      category: "stormwater",
      severity: "likely",
      title: "Stonnington stormwater / drainage",
      detail: `Sketch shows ~${Math.round(hardscapeM2)} m² new hardscape${pool ? " and pool" : ""} — likely triggers stormwater quality/quantity review and legal point-of-discharge check.`,
      output_kind: "permit_stonnington_stormwater",
    });
  }

  if (municipality === "yarra") {
    flags.push({
      id: "yarra-heritage",
      category: "heritage",
      severity: "review",
      title: "Yarra heritage / streetscape",
      detail:
        "Garden works in Yarra often need heritage-compatible materials and no impact to street-facing fabric — confirm overlay on property certificate.",
      output_kind: "permit_yarra_heritage",
    });
  }

  const retaining = placementHas(placements, "retaining-wall");
  if (retaining || pool) {
    flags.push({
      id: "permits-structural",
      category: "permit",
      severity: "likely",
      title: "Building / engineering permits",
      detail:
        "Retaining or pool on sketch — confirm building permit, engineering, and services locates before pricing construction.",
      output_kind: "scope",
    });
  }

  if (placements.length > 0) {
    flags.push({
      id: "scope-envelope",
      category: "permit",
      severity: "review",
      title: "Scope & budget alignment",
      detail:
        "Envelope sketch is for client budget discussion only — council permits and TRP reports are separate deliverables before contract.",
    });
  }

  return flags;
}

export function formatPlanningFlagsForAi(flags: PlanningFlag[]): string {
  if (!flags.length) return "";
  const lines = flags.map(
    (f) =>
      `- [${f.severity.toUpperCase()}] ${f.title}: ${f.detail}${f.output_kind ? ` (draft: ${f.output_kind})` : ""}`,
  );
  return [
    "PRELIMINARY PLANNING (envelope — confirm with council and arborist):",
    ...lines,
  ].join("\n");
}
