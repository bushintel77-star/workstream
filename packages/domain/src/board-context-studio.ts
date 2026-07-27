/**
 * Studio state → BoardContext v1.
 *
 * The assist board is durable: `DesignCanvas` (placements, features, irrigation
 * zones, construction trenches, `site_frame`, presentation pack) plus `Survey`,
 * `Project` and the symbol catalogue. This module assembles those artefacts into
 * the versioned whole-board snapshot from `board-context.ts` — an assembly job,
 * not new capture.
 *
 * Honesty rules (HITL / zero-mock): every block is real or absent. Nothing is
 * defaulted into existence — no assumed DBH, no invented datum, no fabricated
 * council. Absent blocks are marked in `provenance` and surface through
 * `boardContextGaps()`, so the assist says "no levels authored" instead of
 * inventing a grade.
 *
 * Domain-pure: no server imports, unit-testable without a server.
 */

import type {
  CatalogPlacement,
  CatalogSymbol,
  Costing,
  DesignCanvas,
  DesignSiteFramePoint,
  LandscapeFeature,
  LineItem,
  Project,
  RateCard,
  Survey,
} from "@workstream/contracts";
import {
  boardContextGaps,
  buildBoardContext,
  type BoardContext,
  type BoardContextInput,
  type BoardPlanting,
  type BoardPoint,
  type BoardProvenance,
  type BoardQuoteLine,
  type BoardSurface,
} from "./board-context";
import { getCatalogSymbol } from "./catalog";
import { catalogAssetCode } from "./catalog-assets";
import { assessPlanningFromSketch, detectMunicipality } from "./planning-context";
import { buildSketchCostingTotals, buildSketchLineItems } from "./sketch-costing";
import { coarseSymbolToComplianceType } from "./studio-ai-prompt";
import {
  evaluateStudioCompliance,
  type StudioComplianceItem,
  type StudioComplianceItemType,
} from "./studio-preemptive-compliance";
import { tpzRadiusFromDbhCm } from "./tpz-geometry";

/** TRP annotation — a protection ring, never a plant. */
const TRP_SYMBOL_ID = "tree-root-protection";

/** Operator DBH stamp on an existing-tree placement label (`exist:dbh=0.45`). */
const DBH_LABEL = /^exist:dbh=([\d.]+)$/;

/** Coarse types that form ground surfaces rather than planting. */
const SURFACE_TYPES = new Set<StudioComplianceItemType>([
  "lawn",
  "paving",
  "deck",
  "frenchdrain",
]);

/** Coarse types that are planting even when the catalogue category is not. */
const PLANTING_TYPES = new Set<StudioComplianceItemType>([
  "canopy",
  "hedge",
  "bed",
  "feature",
  "exist",
]);

export type StudioBoardContextInput = {
  project: Pick<Project, "id" | "address" | "lat" | "lng">;
  canvas?: DesignCanvas | null;
  survey?: Survey | null;
  /** Owner catalogue overrides; built-in symbols resolve as a fallback. */
  symbols?: CatalogSymbol[];
  /** Board scale (m across 100% width) when the frame has no calibrated span. */
  scaleM?: number | null;
  /** Workable outdoor m² the caller already derived for site intel. */
  outdoorM2?: number | null;
  /** Derived climate read-outs — pass what site intel already computed. */
  sunHours?: number | null;
  shadeSummary?: string | null;
  /** Committed costing wins; otherwise the live sketch estimate is used. */
  costing?: Costing | null;
  rateCard?: RateCard[];
  /** Design lifecycle fields when the caller has them loaded. */
  mode?: string | null;
  phase?: string | null;
};

type PlacedSymbol = {
  placement: CatalogPlacement;
  symbol: CatalogSymbol | null;
  coarse: StudioComplianceItemType;
};

function pct(points: DesignSiteFramePoint[] | undefined): BoardPoint[] {
  return (points ?? []).map((p) => ({ x: p.x_pct, y: p.y_pct }));
}

function pctRings(rings: DesignSiteFramePoint[][] | undefined): BoardPoint[][] {
  return (rings ?? []).map((ring) => pct(ring));
}

function dbhFromLabel(label: string | undefined): number | null {
  if (!label) return null;
  const match = DBH_LABEL.exec(label);
  if (!match) return null;
  const n = Number.parseFloat(match[1]!);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveSymbols(
  placements: CatalogPlacement[],
  symbols: CatalogSymbol[],
): PlacedSymbol[] {
  const owned = new Map(symbols.map((s) => [s.id, s]));
  return placements.map((placement) => ({
    placement,
    symbol: owned.get(placement.symbol_id) ?? getCatalogSymbol(placement.symbol_id) ?? null,
    coarse: coarseSymbolToComplianceType(placement.symbol_id),
  }));
}

/**
 * Where a placement lands in the context. Coarse type wins for ground surfaces
 * (turf is catalogued as planting but reasons as a surface); the catalogue
 * category decides the rest.
 */
function bucketOf(
  entry: PlacedSymbol,
): "planting" | "surface" | "lighting" | "tpz" | "skip" {
  if (entry.placement.symbol_id === TRP_SYMBOL_ID) return "tpz";
  if (SURFACE_TYPES.has(entry.coarse)) return "surface";

  const category = entry.symbol?.category;
  if (category === "lighting") return "lighting";
  if (category === "planting") return "planting";
  if (category === "structure" || category === "water" || category === "furniture") {
    return "surface";
  }
  if (PLANTING_TYPES.has(entry.coarse)) return "planting";
  return "skip";
}

/** Permeability by coarse type — unknown stays null rather than guessing. */
function permeableOf(coarse: StudioComplianceItemType): boolean | null {
  if (coarse === "paving" || coarse === "deck") return false;
  if (coarse === "lawn" || coarse === "bed" || coarse === "hedge") return true;
  return null;
}

/**
 * Plan area for a grouped surface. Mirrors `sketchQtyForSymbol` so surface areas
 * and quote quantities agree — a design↔quote cross-check has to compare like
 * with like. Anything the estimator cannot express in m² stays null.
 */
function surfaceAreaM2(
  symbol: CatalogSymbol | null,
  coarse: StudioComplianceItemType,
  count: number,
  survey: Survey | null,
): number | null {
  if (symbol?.id === "lawn-turf") {
    return survey ? survey.garden_area_m2 : null;
  }
  if ((coarse === "paving" || coarse === "deck") && symbol?.default_width_m) {
    return count * symbol.default_width_m * symbol.default_width_m;
  }
  return null;
}

function featureSurface(feature: LandscapeFeature): BoardSurface {
  const layer = feature.metadata.layer;
  return {
    type: layer,
    area_m2: feature.material_fill?.live_calculations?.area_m2 ?? null,
    material: feature.material_fill?.sku ?? feature.metadata.friendly_name ?? null,
    permeable:
      layer === "hardscape" ? false : layer === "softscape_beds" ? true : null,
  };
}

function quoteLine(item: LineItem): BoardQuoteLine {
  return {
    label: item.label,
    qty: item.qty,
    unit: item.unit,
    total: item.total,
  };
}

/** Standard scenario is the client-facing number the board should be read against. */
export function preferredCosting(costings: Costing[]): Costing | null {
  const rank: Record<Costing["scenario"], number> = {
    standard: 0,
    lean: 1,
    buffer: 2,
  };
  return (
    [...costings].sort((a, b) => rank[a.scenario] - rank[b.scenario])[0] ?? null
  );
}

/**
 * Assemble the whole-board snapshot the design assist reasons over.
 *
 * Deterministic: placements are sorted into a stable order before assembly, so
 * the same board always serialises byte-identically regardless of the order the
 * store hands back placements.
 */
export function buildStudioBoardContext(
  input: StudioBoardContextInput,
): BoardContext {
  const canvas = input.canvas ?? null;
  const survey = input.survey ?? null;
  const frame = canvas?.site_frame;
  const symbols = input.symbols ?? [];
  const entries = resolveSymbols(canvas?.placements ?? [], symbols);

  const boundary = pct(frame?.boundary);
  const building = pct(frame?.building);
  const scaleM = frame?.board_width_m ?? input.scaleM ?? null;
  const outdoorM2 = input.outdoorM2 ?? survey?.garden_area_m2 ?? null;

  /* ---- planting: one row per placement, so spatial reasoning survives ---- */
  const planting: Array<Partial<BoardPlanting> & { code: string }> = [];
  const lighting: Array<Record<string, unknown>> = [];
  const tpz: Array<{ code: string | null; radius_m: number | null; x: number; y: number }> = [];
  const surfaceGroups = new Map<
    string,
    { symbol: CatalogSymbol | null; coarse: StudioComplianceItemType; count: number }
  >();

  for (const entry of entries) {
    const { placement, symbol, coarse } = entry;
    const code = symbol ? catalogAssetCode(symbol) : placement.symbol_id.toUpperCase();

    switch (bucketOf(entry)) {
      case "planting":
        planting.push({
          code,
          species: symbol?.botanical_name ?? symbol?.label ?? null,
          category: symbol?.category ?? null,
          count: 1,
          x: placement.x_pct,
          y: placement.y_pct,
          scale: placement.scale,
          rotation_deg: placement.rotation_deg,
          mature_spread_m: symbol?.default_width_m ?? null,
          height_m: symbol?.mature_height_m ?? null,
          dbh_m: dbhFromLabel(placement.label),
          // Not persisted — the studio growth-stage preset is client state.
          growth_stage_now: null,
          rate_card_sku: symbol?.rate_card_sku ?? null,
        });
        break;
      case "surface": {
        const group = surfaceGroups.get(placement.symbol_id);
        if (group) group.count += 1;
        else surfaceGroups.set(placement.symbol_id, { symbol, coarse, count: 1 });
        break;
      }
      case "lighting":
        lighting.push({
          id: placement.id,
          code,
          symbol_id: placement.symbol_id,
          label: symbol?.label ?? null,
          x: placement.x_pct,
          y: placement.y_pct,
          rate_card_sku: symbol?.rate_card_sku ?? null,
        });
        break;
      case "tpz": {
        // AS 4970 radius needs a measured DBH — never assume one.
        const dbh = dbhFromLabel(placement.label);
        tpz.push({
          code,
          radius_m: dbh == null ? null : tpzRadiusFromDbhCm(dbh * 100),
          x: placement.x_pct,
          y: placement.y_pct,
        });
        break;
      }
      default:
        break;
    }
  }

  planting.sort(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      (a.x ?? 0) - (b.x ?? 0) ||
      (a.y ?? 0) - (b.y ?? 0),
  );
  lighting.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  tpz.sort((a, b) => a.x - b.x || a.y - b.y);

  /* ---- surfaces: drawn features carry measured area, placements estimate ---- */
  const surfaces: BoardSurface[] = [];
  for (const feature of canvas?.features ?? []) {
    surfaces.push(featureSurface(feature));
  }
  const placementSurfaces = [...surfaceGroups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, group]) => ({
      type: group.coarse,
      area_m2: surfaceAreaM2(group.symbol, group.coarse, group.count, survey),
      material: group.symbol?.label ?? null,
      permeable: permeableOf(group.coarse),
    }));
  surfaces.push(...placementSurfaces);

  /* ---- compliance: studio inspector + preliminary planning flags ---- */
  const complianceItems: StudioComplianceItem[] = entries.map((entry) => ({
    id: entry.placement.id,
    t: entry.coarse,
    x: entry.placement.x_pct,
    y: entry.placement.y_pct,
    scale: entry.placement.scale,
    ghost: false,
    dbhM: dbhFromLabel(entry.placement.label) ?? undefined,
  }));
  const report = evaluateStudioCompliance({
    outdoorM2: outdoorM2 ?? 0,
    boundary,
    items: complianceItems,
    scaleM: scaleM ?? undefined,
  });
  const planningFlags = survey
    ? assessPlanningFromSketch(input.project.address, survey, canvas, symbols)
    : [];
  const flags = [
    // Mirrors formatPlanningFlagsForAi, including the output the flag suggests
    // drafting — the flat brief carried it and the assist should not lose it.
    ...planningFlags.map((f) => ({
      id: f.id,
      severity: f.severity,
      statement: `${f.title}: ${f.detail}${f.output_kind ? ` (draft: ${f.output_kind})` : ""}`,
    })),
    ...report.alerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      statement: `${a.title}: ${a.detail}`,
    })),
  ];

  /* ---- commercial: committed costing wins, else the live sketch estimate ---- */
  let quoteLines: BoardQuoteLine[] = [];
  let subtotal: number | null = null;
  let totalInclGst: number | null = null;
  if (input.costing) {
    quoteLines = input.costing.line_items.map(quoteLine);
    subtotal = input.costing.subtotal;
    totalInclGst = input.costing.total;
  } else if (survey && input.rateCard?.length && canvas?.placements.length) {
    const rates = new Map(input.rateCard.map((r) => [r.sku, r]));
    const lines = buildSketchLineItems(canvas.placements, symbols, survey, rates);
    if (lines.length > 0) {
      const totals = buildSketchCostingTotals(lines);
      quoteLines = lines.map(quoteLine);
      subtotal = totals.subtotal;
      totalInclGst = totals.total;
    }
  }

  const municipality = detectMunicipality(input.project.address);
  const pack = canvas?.presentation_pack;

  /* ---- provenance: never label traced or seed geometry as Vicmap ---- */
  const buildingSource = frame?.building_source;
  const provenance: Record<string, BoardProvenance> = {
    // A Vicmap fit lands the parcel and the dwelling together; anything else the
    // operator traced on the board.
    geometry:
      buildingSource === "vicmap"
        ? "vicmap"
        : boundary.length >= 3
          ? "operator"
          : "absent",
    building:
      buildingSource === "vicmap"
        ? "vicmap"
        : buildingSource === "traced"
          ? "operator"
          : "absent",
    planting: planting.length > 0 ? "operator" : "absent",
    surfaces:
      (canvas?.features?.length ?? 0) > 0
        ? "operator"
        : placementSurfaces.length > 0
          ? "derived"
          : "absent",
    levels: (frame?.levels?.length ?? 0) > 0 ? "operator" : "absent",
    systems:
      (frame?.services?.length ?? 0) +
        (frame?.easements?.length ?? 0) +
        (frame?.byda_assets?.length ?? 0) +
        (canvas?.irrigation_zones?.length ?? 0) +
        (canvas?.construction_trenches?.length ?? 0) >
      0
        ? "operator"
        : "absent",
    overlays: (frame?.keyless_overlays?.length ?? 0) > 0 ? "vicmap" : "absent",
    climate: input.sunHours != null ? "derived" : "absent",
    compliance: flags.length > 0 ? "derived" : "absent",
    commercial: quoteLines.length > 0 ? "derived" : "absent",
    meta: municipality === "unknown" ? "operator" : "derived",
    sheet: pack ? "operator" : "absent",
  };

  const assembled: BoardContextInput = {
    meta: {
      project_id: input.project.id,
      address: input.project.address,
      // Inferred from the address — confirm on Vicmap before lodgement.
      council: municipality === "unknown" ? null : municipality,
      // Vicmap parcel identifiers are not held on the studio board.
      pfi: null,
      spi: null,
      lat: input.project.lat,
      lng: input.project.lng,
      scale_m: scaleM,
      mode: input.mode ?? null,
      phase: input.phase ?? null,
    },
    geometry: {
      boundary,
      building,
      building_source: buildingSource ?? null,
      lot_m2: survey?.lot_area_m2 ?? null,
      outdoor_m2: outdoorM2,
      // house_area_m2 of 0 means the outline is unavailable — never infer it.
      coverage_pct:
        survey && survey.house_area_m2 > 0 && survey.lot_area_m2 > 0
          ? (survey.house_area_m2 / survey.lot_area_m2) * 100
          : null,
      levels: (frame?.levels ?? []).map((l) => ({
        rl_m: l.z_m,
        x: l.x_pct,
        y: l.y_pct,
      })),
      // No datum is authored on a Workflow 1 board — RLs are relative.
      datum_m: null,
    },
    planting,
    surfaces,
    systems: {
      irrigation_zones: canvas?.irrigation_zones ?? [],
      services: pctRings(frame?.services),
      trenches: canvas?.construction_trenches ?? [],
      byda_assets: frame?.byda_assets ?? [],
      lighting_fixtures: lighting,
      easements: pctRings(frame?.easements),
    },
    overlays: {
      keyless: (frame?.keyless_overlays ?? []).map((o) => ({
        kind: o.kind,
        label: o.label ?? null,
      })),
      // Planning scheme zoning is not fetched onto the board yet.
      zoning: null,
      tpz,
    },
    climate: {
      sun_hours: input.sunHours ?? null,
      shade_summary: input.shadeSummary ?? null,
      // Sun-date and growth-stage presets are client studio state.
      sun_date_preset: null,
      growth_stage: null,
      orientation_deg: null,
    },
    compliance: {
      flags,
      permeability_target: report.permeableMinPct,
      canopy_target: report.canopyTargetPct,
      setback_state:
        boundary.length < 3
          ? null
          : report.alerts.some((a) => a.code === "setback")
            ? "encroachment"
            : "clear",
    },
    commercial: {
      quote_lines: quoteLines,
      // Margin is held on the rate card, not on a costing scenario.
      margin_pct: null,
      subtotal,
      total_incl_gst: totalInclGst,
    },
    sheet: {
      // Paper, plot scale and pen weight are sheet-render state, not board state.
      paper: null,
      scale_denom: null,
      pen: null,
      theme: pack?.theme ?? null,
      widgets: (pack?.widgets ?? []).map((w) => w.type),
      elevations_chosen: [],
    },
    provenance,
  };

  return buildBoardContext(assembled);
}

/**
 * Prompt block for the design assist: the whole board as deterministic JSON,
 * the honest gap list, and the instruction to weight claims by provenance.
 *
 * Full fidelity by policy — arrays are not capped and coordinates are not
 * rounded. Consequence reasoning is the first thing to die when the board is
 * thinned, and the stable key order keeps the block cache-friendly.
 */
export function formatBoardContextForAi(ctx: BoardContext): string {
  const gaps = boardContextGaps(ctx);
  return [
    "BOARD CONTEXT (BoardContext v1 — the whole active board, not a summary):",
    JSON.stringify(ctx),
    "",
    gaps.length > 0
      ? `Not authored on this board: ${gaps.join("; ")}. Say so plainly — never infer these.`
      : "Every block on this board is authored.",
    "Weight what you read by `provenance`: vicmap is surveyed fact, operator is authored sketch, derived is estimate, seed is demo geometry. Cite the artefacts behind any claim, and keep coordinates in board percent.",
  ].join("\n");
}
