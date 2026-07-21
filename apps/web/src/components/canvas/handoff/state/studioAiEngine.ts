/**
 * Central AI engine for the handoff Design Studio.
 *
 * Proposals, coaching, scan, assist, and stale marking are owned here —
 * the CAD board and chrome only consume the results. Ghosts stay ephemeral
 * (`ghost: true`) until accept commits them onto the drawing.
 */

import {
  buildGhostPlacementSuggestions,
  buildStudioAiSuggestions,
  detectCanopyClustersFromImageData,
  interpretSketchStrokesToCad,
  isTier1WrightsTerrace,
  type GhostPlacementSuggestion,
  type RgbaImageData,
  type StudioAiSuggestion,
} from "@workstream/domain";
import {
  constrainAssetCentre,
  sanitizeItemsToOutdoor,
} from "../geometry/outdoorClamp";
import type { StudioItem, StudioItemType } from "../studioCatalog";
import type { StudioSnapshot } from "./studioTypes";
import { markStaleGhostsNearEdit } from "./staleGhosts";

export type AiProposalSource =
  | "seed"
  | "scan"
  | "assist"
  | "canopy"
  | "layout"
  | "coach"
  | "sketch";

export type AiDraftStatus = "unverified" | "verified" | "scanning" | "assisting";

const SYMBOL_TO_TYPE: Record<string, StudioItemType> = {
  canopy: "canopy",
  "olive-standard": "canopy",
  "hornbeam-pleached": "hedge",
  "existing-tree-retain": "exist",
  "tree-root-protection": "exist",
  "bluestone-paver": "paving",
  "lomandra-mass": "bed",
  deck: "deck",
  lawn: "lawn",
  hedge: "hedge",
  bed: "bed",
  frenchdrain: "frenchdrain",
  feature: "feature",
  paving: "paving",
};

export function mapSymbolToStudioType(symbolId: string): StudioItemType {
  const key = symbolId.toLowerCase();
  if (SYMBOL_TO_TYPE[key]) return SYMBOL_TO_TYPE[key]!;
  if (/drain|french|storm/.test(key)) return "frenchdrain";
  if (/pav|bluestone|path|step/.test(key)) return "paving";
  if (/deck/.test(key)) return "deck";
  if (/lawn|turf/.test(key)) return "lawn";
  if (/hedge|pleach|screen|buxus/.test(key)) return "hedge";
  if (/bed|lomandra|plant|mass/.test(key)) return "bed";
  if (/feature|specimen|cycas/.test(key)) return "feature";
  if (/exist|trp|retain|root/.test(key)) return "exist";
  return "canopy";
}

export function proposalToStudioItem(
  g: GhostPlacementSuggestion,
  id: string,
  source: AiProposalSource,
): StudioItem {
  const t = mapSymbolToStudioType(g.symbol_id);
  const scale =
    t === "exist" ? 1 : Math.max(0.5, Math.min(1.3, 0.55 + g.confidence * 0.7));
  return {
    id,
    t,
    x: Math.max(0, Math.min(100, g.x_pct)),
    y: Math.max(0, Math.min(100, g.y_pct)),
    rot: 0,
    scale,
    ghost: true,
    why: g.reason,
    conf: g.confidence,
    stale: false,
    // source encoded in id prefix for lifecycle filters
    // e.g. ai-scan-…, ai-assist-…, ai-canopy-…
  };
}

export function aiItemPrefix(source: AiProposalSource): string {
  return `ai-${source}-`;
}

export function isAiProposalItem(item: StudioItem): boolean {
  return item.ghost && item.id.startsWith("ai-");
}

/** Snapshot facts the coaching rail and propose path share. */
export function studioAiFacts(
  snap: StudioSnapshot,
  address: string,
): {
  tier1: boolean;
  accepted: StudioItem[];
  pending: StudioItem[];
  placementCount: number;
  hasHardscape: boolean;
  hasStructurePlanting: boolean;
  hasExist: boolean;
  strokeCount: number;
} {
  const accepted = snap.items.filter((i) => !i.ghost);
  const pending = snap.items.filter((i) => i.ghost);
  return {
    tier1: isTier1WrightsTerrace(address),
    accepted,
    pending,
    placementCount: accepted.length,
    hasHardscape: accepted.some((i) =>
      ["paving", "deck", "frenchdrain"].includes(i.t),
    ),
    hasStructurePlanting: accepted.some((i) =>
      ["canopy", "feature", "hedge", "exist"].includes(i.t),
    ),
    hasExist: accepted.some((i) => i.t === "exist"),
    strokeCount: snap.strokes.length,
  };
}

/** Progressive coaching — always derived from the live drawing, never static. */
export function buildHandoffCoaching(
  snap: StudioSnapshot,
  address: string,
  pendingGhostCount: number,
): StudioAiSuggestion[] {
  const f = studioAiFacts(snap, address);
  const base = buildStudioAiSuggestions({
    placementCount: f.placementCount,
    strokeCount: f.strokeCount,
    zoneCount: Math.max(1, Math.round(f.placementCount / 3)),
    hasPlanningSymbol: f.hasExist,
    tier1: f.tier1,
    hasDesign: f.placementCount >= 3 && f.hasHardscape,
  });

  const out = [...base];
  if (pendingGhostCount > 0) {
    out.unshift({
      id: "review-ghosts",
      priority: "high",
      title: `Review ${pendingGhostCount} AI proposal${pendingGhostCount === 1 ? "" : "s"}`,
      detail:
        "Accept commits to the working drawing; reject discards. Stale amber means a nearby edit may have invalidated the rationale.",
      action: "cad",
    });
  } else if (f.placementCount >= 2 && snap.boundary.length >= 3) {
    out.push({
      id: "scan-site",
      priority: "medium",
      title: "Scan site for AI layout",
      detail:
        "Run Scan to propose canopy, hardscape, and drainage moves from the aerial and lot geometry.",
      action: "cad",
    });
  }

  return out.slice(0, 4);
}

export function draftStatus(
  pendingCount: number,
  busy: "idle" | "scanning" | "assisting",
): AiDraftStatus {
  if (busy === "scanning") return "scanning";
  if (busy === "assisting") return "assisting";
  return pendingCount > 0 ? "unverified" : "verified";
}

/**
 * Heuristic layout propose from live geometry — used when API scan is
 * unavailable, and as the baseline merge for Scan.
 */
export function proposeLayoutFromSnapshot(
  snap: StudioSnapshot,
  address: string,
  idn: number,
): { items: StudioItem[]; idn: number } {
  const f = studioAiFacts(snap, address);
  const symbolIds = [
    "canopy",
    "deck",
    "hedge",
    "frenchdrain",
    "lawn",
    "feature",
    "bluestone-paver",
    "hornbeam-pleached",
    "tree-root-protection",
    "lomandra-mass",
  ];
  const domain = buildGhostPlacementSuggestions({
    tier1: f.tier1,
    symbolIds,
  });

  // Geometry-aware extras from boundary / building — CAD-native AI, not a HUD.
  const xs = snap.boundary.map((p) => p.x);
  const ys = snap.boundary.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const rearY = maxY - (maxY - minY) * 0.18;
  const frontY = minY + (maxY - minY) * 0.12;
  const buildMaxY = snap.building.length
    ? Math.max(...snap.building.map((p) => p.y))
    : (minY + maxY) / 2;

  const extras: GhostPlacementSuggestion[] = [];
  if (!f.accepted.some((i) => i.t === "deck") && !f.pending.some((i) => i.t === "deck")) {
    extras.push({
      id: "layout-deck",
      symbol_id: "deck",
      x_pct: cx,
      y_pct: Math.min(95, buildMaxY + 6),
      confidence: 0.91,
      reason: "Links rear door to outdoor room · hold fall under 1:100",
    });
  }
  if (
    !f.hasStructurePlanting ||
    f.accepted.filter((i) => i.t === "canopy" || i.t === "feature").length < 2
  ) {
    extras.push({
      id: "layout-canopy-w",
      symbol_id: "canopy",
      x_pct: minX + (maxX - minX) * 0.25,
      y_pct: rearY,
      confidence: 0.89,
      reason: "West canopy — shades glazing at 3 PM in summer",
    });
    extras.push({
      id: "layout-canopy-e",
      symbol_id: "canopy",
      x_pct: minX + (maxX - minX) * 0.75,
      y_pct: rearY + 2,
      confidence: 0.86,
      reason: "Lifts canopy cover toward the 15% maturity target",
    });
  }
  if (!f.accepted.some((i) => i.t === "hedge") && !f.pending.some((i) => i.t === "hedge")) {
    extras.push({
      id: "layout-hedge",
      symbol_id: "hedge",
      x_pct: cx,
      y_pct: frontY,
      confidence: 0.84,
      reason: "Front boundary screen · 1.2 m clipped",
    });
  }
  if (
    f.hasHardscape &&
    !f.accepted.some((i) => i.t === "frenchdrain") &&
    !f.pending.some((i) => i.t === "frenchdrain")
  ) {
    extras.push({
      id: "layout-drain",
      symbol_id: "frenchdrain",
      x_pct: cx,
      y_pct: buildMaxY + 1.5,
      confidence: 0.9,
      reason: "Intercepts runoff at paving low point",
    });
  }

  const merged = [...domain, ...extras];
  let nextIdn = idn;
  const items: StudioItem[] = merged.map((g) => {
    nextIdn += 1;
    return proposalToStudioItem(
      g,
      `${aiItemPrefix("layout")}${nextIdn}`,
      "layout",
    );
  });
  return { items, idn: nextIdn };
}

/** NL assist → geometry-aware ghost proposals (offline path). */
export function proposeFromAssistQuery(
  snap: StudioSnapshot,
  query: string,
  idn: number,
): { items: StudioItem[]; idn: number } {
  const q = query.toLowerCase();
  const xs = snap.boundary.map((p) => p.x);
  const ys = snap.boundary.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const rearY = Math.max(...ys) - 8;

  const wantsShade = /shade|sun|west|glaz|canopy|tree/.test(q);
  const wantsHard = /pave|deck|path|bluestone|hard/.test(q);
  const wantsDrain = /drain|water|runoff|storm|permeab/.test(q);
  const wantsScreen = /screen|hedge|front|fence|privacy/.test(q);

  const suggestions: GhostPlacementSuggestion[] = [];
  if (wantsShade || (!wantsHard && !wantsDrain && !wantsScreen)) {
    suggestions.push(
      {
        id: "assist-a",
        symbol_id: "canopy",
        x_pct: cx - 2,
        y_pct: rearY,
        confidence: 0.84,
        reason: `You asked: “${query}”`,
      },
      {
        id: "assist-b",
        symbol_id: "canopy",
        x_pct: cx + 2.5,
        y_pct: rearY - 3,
        confidence: 0.82,
        reason: `You asked: “${query}”`,
      },
    );
  }
  if (wantsHard) {
    suggestions.push({
      id: "assist-deck",
      symbol_id: "deck",
      x_pct: cx,
      y_pct: cy + 8,
      confidence: 0.87,
      reason: `Hardscape from: “${query}”`,
    });
  }
  if (wantsDrain) {
    suggestions.push({
      id: "assist-drain",
      symbol_id: "frenchdrain",
      x_pct: cx,
      y_pct: cy,
      confidence: 0.88,
      reason: `Drainage from: “${query}”`,
    });
  }
  if (wantsScreen) {
    suggestions.push({
      id: "assist-hedge",
      symbol_id: "hedge",
      x_pct: cx,
      y_pct: Math.min(...ys) + 6,
      confidence: 0.85,
      reason: `Screen from: “${query}”`,
    });
  }

  let nextIdn = idn;
  const items = suggestions.map((g) => {
    nextIdn += 1;
    return proposalToStudioItem(
      g,
      `${aiItemPrefix("assist")}${nextIdn}`,
      "assist",
    );
  });
  return { items, idn: nextIdn };
}

/**
 * Freehand sketch strokes → CAD ghost assets, snapped clear of setback and
 * house envelope. Accept commits them onto the site plan.
 */
export function proposeFromStrokes(
  snap: StudioSnapshot,
  idn: number,
  opts?: { scaleM?: number },
): { items: StudioItem[]; idn: number; count: number } {
  const suggestions = interpretSketchStrokesToCad(snap.strokes, {
    boundary: snap.boundary,
    building: snap.building,
    scaleM: opts?.scaleM,
  });
  if (suggestions.length === 0) {
    return { items: [], idn, count: 0 };
  }

  let nextIdn = idn;
  const items = suggestions.map((g) => {
    nextIdn += 1;
    const t = mapSymbolToStudioType(g.symbol_id);
    const placed = constrainAssetCentre(
      g.x_pct,
      g.y_pct,
      t,
      snap.boundary,
      snap.building,
    );
    const x = placed.x;
    const y = placed.y;
    let reason = g.reason;
    if (placed.reason) {
      reason = `${reason} · ${placed.reason}`;
    }

    const item = proposalToStudioItem(
      {
        id: g.id,
        symbol_id: g.symbol_id,
        x_pct: x,
        y_pct: y,
        confidence: g.confidence,
        reason,
      },
      `${aiItemPrefix("sketch")}${nextIdn}`,
      "sketch",
    );
    if (g.scaleHint != null) item.scale = g.scaleHint;
    if (g.rotDeg != null) item.rot = g.rotDeg;
    return item;
  });

  return { items, idn: nextIdn, count: items.length };
}

/**
 * Map AI CAD suggestions (from the server sketch→CAD vision pipeline) into
 * studio ghost items. Same placement constraints as the local heuristic path,
 * but the suggestions arrive already interpreted by Claude vision.
 */
export function proposeFromCadSuggestions(
  snap: StudioSnapshot,
  idn: number,
  suggestions: Array<{
    id: string;
    symbol_id: string;
    x_pct: number;
    y_pct: number;
    confidence: number;
    reason: string;
    scale_hint?: number;
    rot_deg?: number;
  }>,
): { items: StudioItem[]; idn: number; count: number } {
  if (suggestions.length === 0) return { items: [], idn, count: 0 };
  let nextIdn = idn;
  const items = suggestions.map((g) => {
    nextIdn += 1;
    const t = mapSymbolToStudioType(g.symbol_id);
    const placed = constrainAssetCentre(
      g.x_pct,
      g.y_pct,
      t,
      snap.boundary,
      snap.building,
    );
    let reason = g.reason;
    if (placed.reason) reason = `${reason} · ${placed.reason}`;
    const item = proposalToStudioItem(
      {
        id: g.id,
        symbol_id: g.symbol_id,
        x_pct: placed.x,
        y_pct: placed.y,
        confidence: g.confidence,
        reason,
      },
      `${aiItemPrefix("sketch")}${nextIdn}`,
      "sketch",
    );
    if (g.scale_hint != null) item.scale = g.scale_hint;
    if (g.rot_deg != null) item.rot = g.rot_deg;
    return item;
  });
  return { items, idn: nextIdn, count: items.length };
}

export function proposeFromCanopyImage(
  image: RgbaImageData,
  idn: number,
): { items: StudioItem[]; idn: number } {
  const clusters = detectCanopyClustersFromImageData(image, {
    gridSize: 24,
    maxClusters: 6,
    symbolId: "canopy",
  });
  let nextIdn = idn;
  const items = clusters.map((c) => {
    nextIdn += 1;
    return proposalToStudioItem(
      {
        id: c.id,
        symbol_id: "canopy",
        x_pct: c.x_pct,
        y_pct: c.y_pct,
        confidence: c.confidence,
        reason: c.reason,
      },
      `${aiItemPrefix("canopy")}${nextIdn}`,
      "canopy",
    );
  });
  return { items, idn: nextIdn };
}

/** Merge new AI proposals; drop prior proposals from the same source family. */
export function mergeAiProposals(
  snap: StudioSnapshot,
  incoming: StudioItem[],
  replaceSources: AiProposalSource[] | "all-pending",
): StudioItem[] {
  const committed = snap.items.filter((i) => !i.ghost);
  const keepPending =
    replaceSources === "all-pending"
      ? []
      : snap.items.filter(
          (i) =>
            i.ghost &&
            !replaceSources.some((s) => i.id.startsWith(aiItemPrefix(s))),
        );
  // Avoid stacking duplicates on nearly the same centroid
  const kept = [...committed, ...keepPending];
  const add: StudioItem[] = [];
  const safeIncoming = sanitizeItemsToOutdoor(
    incoming,
    snap.boundary,
    snap.building,
  );
  for (const g of safeIncoming) {
    const clash = [...kept, ...add].some(
      (o) => o.ghost && Math.hypot(o.x - g.x, o.y - g.y) < 2.5 && o.t === g.t,
    );
    if (!clash) add.push(g);
  }
  return [...kept, ...add];
}

export function acceptProposal(
  snap: StudioSnapshot,
  id: string,
): StudioSnapshot {
  return {
    ...snap,
    items: snap.items.map((i) => {
      if (i.id !== id) return i;
      const live = { ...i, ghost: false, stale: false };
      return sanitizeItemsToOutdoor(
        [live],
        snap.boundary,
        snap.building,
      )[0]!;
    }),
  };
}

export function rejectProposal(
  snap: StudioSnapshot,
  id: string,
): StudioSnapshot {
  return {
    ...snap,
    items: snap.items.filter((i) => i.id !== id),
  };
}

export function acceptAllProposals(snap: StudioSnapshot): StudioSnapshot {
  const accepted = snap.items.map((i) =>
    i.ghost ? { ...i, ghost: false, stale: false } : i,
  );
  return {
    ...snap,
    items: sanitizeItemsToOutdoor(accepted, snap.boundary, snap.building),
  };
}

/** Re-export so mutate path and engine share one stale implementation. */
export { markStaleGhostsNearEdit };

/** Map API ghost suggestions (contracts) into studio items. */
export function proposalsFromApiSuggestions(
  suggestions: Array<{
    id: string;
    symbol_id: string;
    x_pct: number;
    y_pct: number;
    confidence: number;
    reason: string;
  }>,
  idn: number,
  source: AiProposalSource,
): { items: StudioItem[]; idn: number } {
  let nextIdn = idn;
  const items = suggestions.map((g) => {
    nextIdn += 1;
    return proposalToStudioItem(g, `${aiItemPrefix(source)}${nextIdn}`, source);
  });
  return { items, idn: nextIdn };
}

/** After a CAD commit (trace finish / place), propose follow-up if sparse. */
export function maybeAutoProposeAfterCommit(
  snap: StudioSnapshot,
  address: string,
  idn: number,
): { items: StudioItem[]; idn: number } | null {
  const f = studioAiFacts(snap, address);
  if (f.pending.length > 0) return null;
  if (f.placementCount === 0) return null;
  if (f.placementCount >= 6 && f.hasHardscape && f.hasStructurePlanting) {
    return null;
  }
  return proposeLayoutFromSnapshot(snap, address, idn);
}
