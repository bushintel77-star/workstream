/**
 * BoardContext v1 — whole-board snapshot for the AI-aware canvas.
 *
 * Workstream is already board-aware (design-assist serialises the active board on
 * every call). The prior ceiling was payload *depth*: the flat sketch brief carried
 * label/category/count/position/SKU only, so the model could describe the board but
 * not reason about consequence (time, level, system, cost).
 *
 * Policy (operator decision 2026-07-27): **context-aware, not context-reduced.**
 * Where fidelity and token economy conflict, fidelity wins — consequence reasoning
 * dies first when arrays are capped or coordinates rounded away. Guards that cost no
 * fidelity: no duplicated blobs (reference by `code`), stable key order (deterministic
 * serialisation for cache reuse + snapshot tests), and `provenance` so the model can
 * weight Vicmap fact above seed geometry.
 *
 * Domain-pure: no server imports, unit-testable without a server.
 */

export const BOARD_CONTEXT_VERSION = "board-context/1" as const;

/** Where a block's data came from — lets the model weight what it reads. */
export type BoardProvenance = "vicmap" | "operator" | "derived" | "seed" | "absent";

export type BoardPoint = { x: number; y: number };

export type BoardMeta = {
  project_id: string;
  address: string | null;
  council: string | null;
  pfi: string | null;
  spi: string | null;
  lat: number | null;
  lng: number | null;
  /** Ground metres across the board frame — the key to all real-world reasoning. */
  scale_m: number | null;
  mode: string | null;
  /** ASLA/SILA lifecycle phase when known (concept → post-occupancy). */
  phase: string | null;
};

export type BoardLevel = {
  /** Reduced level (m) at a surveyed/authored spot. */
  rl_m: number;
  x: number;
  y: number;
  label?: string | null;
};

export type BoardGeometry = {
  boundary: BoardPoint[];
  building: BoardPoint[];
  building_source: string | null;
  lot_m2: number | null;
  outdoor_m2: number | null;
  coverage_pct: number | null;
  levels: BoardLevel[];
  datum_m: number | null;
};

export type BoardPlanting = {
  /** Schedule code keyed to the plan label (e.g. B14). */
  code: string;
  species: string | null;
  category: string | null;
  count: number;
  x: number;
  y: number;
  scale: number;
  rotation_deg: number;
  /** Mature spread — required for Year-10 canopy closure / competition reasoning. */
  mature_spread_m: number | null;
  height_m: number | null;
  dbh_m: number | null;
  growth_stage_now: string | null;
  rate_card_sku: string | null;
};

export type BoardSurface = {
  type: string;
  area_m2: number | null;
  material: string | null;
  permeable: boolean | null;
};

export type BoardSystems = {
  irrigation_zones: unknown[];
  services: BoardPoint[][];
  trenches: unknown[];
  byda_assets: unknown[];
  lighting_fixtures: unknown[];
  easements: BoardPoint[][];
};

export type BoardOverlays = {
  keyless: Array<{ kind: string; label?: string | null }>;
  zoning: string | null;
  tpz: Array<{ code?: string | null; radius_m?: number | null; x?: number; y?: number }>;
};

export type BoardClimate = {
  sun_hours: number | null;
  shade_summary: string | null;
  sun_date_preset: string | null;
  growth_stage: string | null;
  orientation_deg: number | null;
};

export type BoardCompliance = {
  flags: Array<{ id?: string; severity?: string; statement?: string }>;
  permeability_target: number | null;
  canopy_target: number | null;
  setback_state: string | null;
};

export type BoardQuoteLine = {
  label: string;
  qty: number;
  unit: string;
  total: number;
};

export type BoardCommercial = {
  quote_lines: BoardQuoteLine[];
  subtotal: number | null;
  margin_pct: number | null;
  total_incl_gst: number | null;
};

export type BoardSheet = {
  paper: string | null;
  scale_denom: number | null;
  pen: string | null;
  theme: string | null;
  widgets: string[];
  elevations_chosen: string[];
};

export type BoardContext = {
  version: typeof BOARD_CONTEXT_VERSION;
  meta: BoardMeta;
  geometry: BoardGeometry;
  planting: BoardPlanting[];
  surfaces: BoardSurface[];
  systems: BoardSystems;
  overlays: BoardOverlays;
  climate: BoardClimate;
  compliance: BoardCompliance;
  commercial: BoardCommercial;
  sheet: BoardSheet;
  provenance: Record<string, BoardProvenance>;
};

/** Loose input — callers pass what they have; absent blocks are marked in provenance. */
export type BoardContextInput = {
  meta?: Partial<BoardMeta> & { project_id: string };
  geometry?: Partial<BoardGeometry>;
  planting?: Array<Partial<BoardPlanting> & { code: string }>;
  surfaces?: Array<Partial<BoardSurface> & { type: string }>;
  systems?: Partial<BoardSystems>;
  overlays?: Partial<BoardOverlays>;
  climate?: Partial<BoardClimate>;
  compliance?: Partial<BoardCompliance>;
  commercial?: Partial<BoardCommercial>;
  sheet?: Partial<BoardSheet>;
  provenance?: Record<string, BoardProvenance>;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

/** Points are preserved at full precision — fidelity over thrift (see header). */
function points(v: unknown): BoardPoint[] {
  if (!Array.isArray(v)) return [];
  const out: BoardPoint[] = [];
  for (const p of v) {
    if (!p || typeof p !== "object") continue;
    const x = num((p as BoardPoint).x);
    const y = num((p as BoardPoint).y);
    if (x == null || y == null) continue;
    out.push({ x, y });
  }
  return out;
}

function rings(v: unknown): BoardPoint[][] {
  if (!Array.isArray(v)) return [];
  return v.map((r) => points(r)).filter((r) => r.length > 0);
}

/**
 * Assemble a deterministic BoardContext. Same board in → byte-identical JSON out
 * (stable key order, stable array order), so it snapshot-tests and caches cleanly.
 */
export function buildBoardContext(input: BoardContextInput): BoardContext {
  const m = input.meta ?? { project_id: "" };
  const g = input.geometry ?? {};
  const sys = input.systems ?? {};
  const ov = input.overlays ?? {};
  const cl = input.climate ?? {};
  const cmp = input.compliance ?? {};
  const com = input.commercial ?? {};
  const sh = input.sheet ?? {};

  const boundary = points(g.boundary);
  const building = points(g.building);

  /* Planting sorted by code so ordering never depends on placement order. */
  const planting: BoardPlanting[] = (input.planting ?? [])
    .map((p) => ({
      code: p.code,
      species: str(p.species),
      category: str(p.category),
      count: num(p.count) ?? 1,
      x: num(p.x) ?? 0,
      y: num(p.y) ?? 0,
      scale: num(p.scale) ?? 1,
      rotation_deg: num(p.rotation_deg) ?? 0,
      mature_spread_m: num(p.mature_spread_m),
      height_m: num(p.height_m),
      dbh_m: num(p.dbh_m),
      growth_stage_now: str(p.growth_stage_now),
      rate_card_sku: str(p.rate_card_sku),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const surfaces: BoardSurface[] = (input.surfaces ?? [])
    .map((s) => ({
      type: s.type,
      area_m2: num(s.area_m2),
      material: str(s.material),
      permeable: typeof s.permeable === "boolean" ? s.permeable : null,
    }))
    .sort((a, b) => a.type.localeCompare(b.type));

  const quoteLines: BoardQuoteLine[] = (com.quote_lines ?? []).map((l) => ({
    label: str(l?.label) ?? "",
    qty: num(l?.qty) ?? 0,
    unit: str(l?.unit) ?? "",
    total: num(l?.total) ?? 0,
  }));

  const levels: BoardLevel[] = (g.levels ?? [])
    .map((l) => ({
      rl_m: num(l?.rl_m) ?? 0,
      x: num(l?.x) ?? 0,
      y: num(l?.y) ?? 0,
      label: str(l?.label),
    }))
    .sort((a, b) => a.x - b.x || a.y - b.y);

  const provenance: Record<string, BoardProvenance> = {
    geometry: boundary.length >= 3 ? "vicmap" : "absent",
    building: building.length >= 3 ? "vicmap" : "absent",
    planting: planting.length > 0 ? "operator" : "absent",
    surfaces: surfaces.length > 0 ? "operator" : "absent",
    levels: levels.length > 0 ? "operator" : "absent",
    climate: cl.sun_hours != null ? "derived" : "absent",
    compliance: (cmp.flags ?? []).length > 0 ? "derived" : "absent",
    commercial: quoteLines.length > 0 ? "derived" : "absent",
    ...(input.provenance ?? {}),
  };

  return {
    version: BOARD_CONTEXT_VERSION,
    meta: {
      project_id: m.project_id ?? "",
      address: str(m.address),
      council: str(m.council),
      pfi: str(m.pfi),
      spi: str(m.spi),
      lat: num(m.lat),
      lng: num(m.lng),
      scale_m: num(m.scale_m),
      mode: str(m.mode),
      phase: str(m.phase),
    },
    geometry: {
      boundary,
      building,
      building_source: str(g.building_source),
      lot_m2: num(g.lot_m2),
      outdoor_m2: num(g.outdoor_m2),
      coverage_pct: num(g.coverage_pct),
      levels,
      datum_m: num(g.datum_m),
    },
    planting,
    surfaces,
    systems: {
      irrigation_zones: Array.isArray(sys.irrigation_zones) ? sys.irrigation_zones : [],
      services: rings(sys.services),
      trenches: Array.isArray(sys.trenches) ? sys.trenches : [],
      byda_assets: Array.isArray(sys.byda_assets) ? sys.byda_assets : [],
      lighting_fixtures: Array.isArray(sys.lighting_fixtures)
        ? sys.lighting_fixtures
        : [],
      easements: rings(sys.easements),
    },
    overlays: {
      keyless: (ov.keyless ?? [])
        .map((k) => ({ kind: str(k?.kind) ?? "", label: str(k?.label) }))
        .filter((k) => k.kind.length > 0)
        .sort((a, b) => a.kind.localeCompare(b.kind)),
      zoning: str(ov.zoning),
      tpz: ov.tpz ?? [],
    },
    climate: {
      sun_hours: num(cl.sun_hours),
      shade_summary: str(cl.shade_summary),
      sun_date_preset: str(cl.sun_date_preset),
      growth_stage: str(cl.growth_stage),
      orientation_deg: num(cl.orientation_deg),
    },
    compliance: {
      flags: cmp.flags ?? [],
      permeability_target: num(cmp.permeability_target),
      canopy_target: num(cmp.canopy_target),
      setback_state: str(cmp.setback_state),
    },
    commercial: {
      quote_lines: quoteLines,
      subtotal: num(com.subtotal),
      margin_pct: num(com.margin_pct),
      total_incl_gst: num(com.total_incl_gst),
    },
    sheet: {
      paper: str(sh.paper),
      scale_denom: num(sh.scale_denom),
      pen: str(sh.pen),
      theme: str(sh.theme),
      widgets: (sh.widgets ?? []).filter((w): w is string => typeof w === "string"),
      elevations_chosen: (sh.elevations_chosen ?? []).filter(
        (e): e is string => typeof e === "string",
      ),
    },
    provenance,
  };
}

/**
 * Blocks a model can't reason about because the data is absent. Surfacing this keeps
 * the assist honest — it should say "no levels authored" rather than invent a grade.
 */
export function boardContextGaps(ctx: BoardContext): string[] {
  const gaps: string[] = [];
  if (ctx.geometry.building.length < 3) gaps.push("no dwelling envelope");
  if (ctx.geometry.levels.length === 0) gaps.push("no spot levels / datum");
  if (ctx.planting.length === 0) gaps.push("no planting placed");
  if (ctx.surfaces.length === 0) gaps.push("no surfaces measured");
  if (ctx.commercial.quote_lines.length === 0) gaps.push("no priced lines");
  if (ctx.systems.services.length === 0 && ctx.systems.easements.length === 0) {
    gaps.push("no services / easements traced");
  }
  if (ctx.meta.scale_m == null) gaps.push("no ground scale — metres unreliable");
  return gaps;
}
