/**
 * Bridge StudioItem / SketchStroke ↔ DesignCanvas CatalogPlacement / CanvasStroke.
 * Ghosts never persist. Non-UUID demo ids are remapped for the contracts schema.
 */

import {
  clampBoardPct,
  type CatalogPlacement,
  type CanvasStroke,
  type DesignSiteFrame,
  type DesignSiteFrameInput,
  type LandscapeFeature,
} from "@workstream/contracts";
import { symbolMatureHeightM } from "@workstream/domain";
import type {
  SketchStroke,
  SpotLevel,
  StudioItem,
  StudioItemType,
} from "../studioCatalog";
import type { PctPoint } from "../geometry";
import { mapSymbolToStudioType } from "./studioAiEngine";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Stable catalog symbol for each studio type (Curtis palette). */
export const TYPE_TO_SYMBOL: Record<StudioItemType, string> = {
  canopy: "olive-standard",
  feature: "feature",
  paving: "bluestone-paver",
  deck: "deck",
  lawn: "lawn",
  hedge: "hornbeam-pleached",
  bed: "lomandra-mass",
  frenchdrain: "frenchdrain",
  exist: "existing-tree-retain",
};

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export function ensureUuid(id: string): string {
  return isUuid(id) ? id : crypto.randomUUID();
}

/** Remap non-UUID item/stroke ids so PUT /design-canvas validates. */
export function withContractIds(args: {
  items: StudioItem[];
  strokes: SketchStroke[];
}): { items: StudioItem[]; strokes: SketchStroke[]; remapped: boolean } {
  let remapped = false;
  const items = args.items.map((it) => {
    if (isUuid(it.id)) return it;
    remapped = true;
    return { ...it, id: crypto.randomUUID() };
  });
  const strokes = args.strokes.map((s) => {
    if (isUuid(s.id)) return s;
    remapped = true;
    return { ...s, id: crypto.randomUUID() };
  });
  return { items, strokes, remapped };
}

/** Pack optional authored DBH / multi-stem into placement label for round-trip. */
function placementLabel(i: StudioItem): string {
  if (i.t !== "exist") return i.t;
  const stems = (i.stemDbhM ?? []).filter((d) => Number.isFinite(d) && d > 0);
  if (stems.length > 1) {
    return `exist:stems=${stems.join(",")}`;
  }
  const dbh = stems[0] ?? i.dbhM;
  if (dbh != null && Number.isFinite(dbh)) {
    return `exist:dbh=${dbh}`;
  }
  return i.t;
}

function stemsFromLabel(label: string | undefined): number[] | undefined {
  if (!label) return undefined;
  const multi = /^exist:stems=([\d.,]+)$/.exec(label);
  if (multi) {
    const stems = multi[1]!
      .split(",")
      .map((s) => Number.parseFloat(s))
      .filter((n) => Number.isFinite(n) && n > 0);
    return stems.length > 0 ? stems : undefined;
  }
  const single = /^exist:dbh=([\d.]+)$/.exec(label);
  if (!single) return undefined;
  const n = Number.parseFloat(single[1]!);
  return Number.isFinite(n) && n > 0 ? [n] : undefined;
}

function dbhFromLabel(label: string | undefined): number | undefined {
  const stems = stemsFromLabel(label);
  if (!stems?.length) return undefined;
  if (stems.length === 1) return stems[0];
  const sumSq = stems.reduce((acc, d) => acc + d * d, 0);
  return Math.sqrt(sumSq);
}

/** Accepted (non-ghost) items → catalog placements. */
export function itemsToPlacements(items: StudioItem[]): CatalogPlacement[] {
  return items
    .filter((i) => !i.ghost)
    .map((i) => ({
      id: ensureUuid(i.id),
      symbol_id: i.symbolId?.trim() || TYPE_TO_SYMBOL[i.t],
      x_pct: clampBoardPct(i.x),
      y_pct: clampBoardPct(i.y),
      rotation_deg: ((i.rot % 360) + 360) % 360,
      scale: Math.max(0.05, i.scale),
      label: placementLabel(i),
      // Persist tree provenance so it survives a reload (not just the ghost
      // id prefix, which is stripped on accept).
      ...(i.source ? { source: i.source } : {}),
    }));
}

/**
 * Hydrate placements back into studio items.
 *
 * `CatalogPlacement` carries no height, so the mature height is re-derived
 * from the persisted `symbol_id` — one symbol always means one height, which
 * is what keeps the plan and the elevation agreeing after a reload. Symbols
 * with no catalogued height leave `heightM` unset and fall back to the coarse
 * studio type in `resolveItemHeightM`.
 */
export function placementsToItems(
  placements: CatalogPlacement[],
): StudioItem[] {
  return placements.map((p) => {
    const t = mapSymbolToStudioType(p.symbol_id);
    const stemDbhM = t === "exist" ? stemsFromLabel(p.label) : undefined;
    const dbhM = t === "exist" ? dbhFromLabel(p.label) : undefined;
    const heightM = symbolMatureHeightM(p.symbol_id);
    return {
      id: p.id,
      t,
      x: p.x_pct,
      y: p.y_pct,
      rot: p.rotation_deg ?? 0,
      scale: p.scale ?? 1,
      ghost: false,
      symbolId: p.symbol_id,
      ...(dbhM != null ? { dbhM } : {}),
      ...(stemDbhM && stemDbhM.length > 1 ? { stemDbhM } : {}),
      ...(heightM != null ? { heightM } : {}),
      // Hydrate tree provenance — a Vicmap tree or detected canopy keeps its
      // source after a reload so the plan/elevation/share still distinguish it.
      ...(p.source ? { source: p.source } : {}),
    };
  });
}

/** Feature layer for area types whose drawn outline persists as a region. */
const FEATURE_LAYER_BY_TYPE: Partial<
  Record<StudioItemType, "softscape_beds" | "hardscape">
> = {
  bed: "softscape_beds",
  lawn: "softscape_beds",
  paving: "hardscape",
  deck: "hardscape",
};

/**
 * Accepted items with a drawn region outline → LandscapeFeatures.
 * Feature id mirrors the item id so hydrate can re-attach the outline.
 */
export function itemsToFeatures(items: StudioItem[]): LandscapeFeature[] {
  const now = new Date().toISOString();
  const out: LandscapeFeature[] = [];
  for (const i of items) {
    if (i.ghost) continue;
    const layer = FEATURE_LAYER_BY_TYPE[i.t];
    if (!layer) continue;
    const outline = i.outlinePct ?? [];
    if (outline.length < 3) continue;
    out.push({
      id: ensureUuid(i.id),
      type: "LandscapeFeature",
      metadata: {
        layer,
        timestamp_created: now,
        source_attribution: "human_drawn",
        user_modification_state: "accepted",
      },
      geometry: {
        type: "Polygon",
        spatial_reference: "EPSG:3857",
        canvas_origin_pct: { x_pct: 0, y_pct: 0 },
        points: outline.map((p, idx) => ({
          id: `v${idx}`,
          pct: { x_pct: clampBoardPct(p.x), y_pct: clampBoardPct(p.y) },
        })),
      },
      material_fill: {
        type: "surface",
        sku: TYPE_TO_SYMBOL[i.t],
        depth_m: 0.075,
        waste_allocation_pct: 10,
      },
    });
  }
  return out;
}

/** Hydrate: re-attach persisted region outlines onto items by matching id. */
export function featuresOntoItems(
  items: StudioItem[],
  features: LandscapeFeature[],
): StudioItem[] {
  if (features.length === 0) return items;
  const byId = new Map(features.map((f) => [f.id, f]));
  return items.map((i) => {
    const f = byId.get(i.id);
    if (!f || f.geometry.type !== "Polygon" || f.geometry.points.length < 3) {
      return i;
    }
    return {
      ...i,
      outlinePct: f.geometry.points.map((v) => ({
        x: v.pct.x_pct,
        y: v.pct.y_pct,
      })),
    };
  });
}

/** Features that are not mirrored by a studio item id (structured Instant Planner). */
export function orphanLandscapeFeatures(
  features: LandscapeFeature[],
  items: StudioItem[],
): LandscapeFeature[] {
  if (features.length === 0) return [];
  const itemIds = new Set(items.map((i) => i.id));
  return features.filter((f) => !itemIds.has(f.id));
}

/** Merge item-derived outlines with structured extras (extras lose on id clash). */
export function mergeCanvasFeatures(
  fromItems: LandscapeFeature[],
  extras: LandscapeFeature[],
): LandscapeFeature[] {
  const byId = new Map(fromItems.map((f) => [f.id, f]));
  for (const f of extras) {
    if (!byId.has(f.id)) byId.set(f.id, f);
  }
  return [...byId.values()];
}

export function strokesToCanvas(strokes: SketchStroke[]): CanvasStroke[] {
  return strokes.map((s) => ({
    id: ensureUuid(s.id),
    points: s.points.map((p) => ({
      x_pct: clampBoardPct(p.x),
      y_pct: clampBoardPct(p.y),
    })),
    color: s.color ?? "var(--text-primary)",
    width_px: s.widthPx ?? 2,
    // Shape-tool strokes round-trip their crisp geometry so a reload keeps
    // the line/rect/circle look instead of degrading to freehand ink.
    ...(s.kind ? { kind: s.kind } : {}),
    ...(s.shapeTool ? { shape_tool: s.shapeTool } : {}),
    ...(s.shapeStart
      ? { shape_start: { x_pct: clampBoardPct(s.shapeStart.x), y_pct: clampBoardPct(s.shapeStart.y) } }
      : {}),
    ...(s.shapeEnd
      ? { shape_end: { x_pct: clampBoardPct(s.shapeEnd.x), y_pct: clampBoardPct(s.shapeEnd.y) } }
      : {}),
  }));
}

export function canvasToStrokes(strokes: CanvasStroke[]): SketchStroke[] {
  return strokes.map((s) => ({
    id: s.id,
    points: s.points.map((p) => ({ x: p.x_pct, y: p.y_pct })),
    color: s.color,
    widthPx: s.width_px,
    ...(s.kind ? { kind: s.kind } : {}),
    ...(s.shape_tool ? { shapeTool: s.shape_tool } : {}),
    ...(s.shape_start
      ? { shapeStart: { x: s.shape_start.x_pct, y: s.shape_start.y_pct } }
      : {}),
    ...(s.shape_end
      ? { shapeEnd: { x: s.shape_end.x_pct, y: s.shape_end.y_pct } }
      : {}),
  }));
}

function ringToFrame(pts: PctPoint[]) {
  return pts.map((p) => ({
    x_pct: clampBoardPct(p.x),
    y_pct: clampBoardPct(p.y),
  }));
}

function frameToRing(
  pts: Array<{ x_pct: number; y_pct: number }>,
): PctPoint[] {
  return pts.map((p) => ({ x: p.x_pct, y: p.y_pct }));
}

/** Studio site geometry → durable DesignCanvas.site_frame. */
export function snapshotToSiteFrame(args: {
  boundary: PctPoint[];
  building: PctPoint[];
  easements: PctPoint[][];
  services: PctPoint[][];
  levels: SpotLevel[];
  drainageRuns?: Array<{
    id: string;
    points: Array<{ x: number; y: number; z: number }>;
    source: "indicative";
  }>;
  bydaAssets?: DesignSiteFrame["byda_assets"];
  keylessOverlays?: DesignSiteFrame["keyless_overlays"];
  /** Metres per 100% board width (Vicmap fit or operator calibration). */
  boardWidthM?: number | null;
  buildingSource?: DesignSiteFrame["building_source"];
  sitePack?: DesignSiteFrame["site_pack"];
  /** Operator-measured side-corridor width (mm) — wins over computed. */
  machineAccessOverrideMm?: number;
  machineAccessSource?: "computed" | "measured";
}): DesignSiteFrame {
  return {
    boundary: ringToFrame(args.boundary),
    building: ringToFrame(args.building),
    easements: args.easements.map(ringToFrame),
    services: args.services.map(ringToFrame),
    levels: args.levels.map((lv) => ({
      x_pct: clampBoardPct(lv.x),
      y_pct: clampBoardPct(lv.y),
      z_m: lv.z,
      source: "authored" as const,
    })),
    drainage_runs: (args.drainageRuns ?? []).map((run) => ({
      id: run.id,
      source: "indicative" as const,
      points: run.points.map((pt) => ({
        x_pct: clampBoardPct(pt.x),
        y_pct: clampBoardPct(pt.y),
        z_m: pt.z,
      })),
    })),
    byda_assets: (args.bydaAssets ?? []).map((a) => ({
      ...a,
      ring: a.ring.map((pt) => ({
        x_pct: clampBoardPct(pt.x_pct),
        y_pct: clampBoardPct(pt.y_pct),
      })),
    })),
    keyless_overlays: (args.keylessOverlays ?? []).map((overlay) => ({
      ...overlay,
      rings: overlay.rings.map((ring) =>
        ring.map((pt) => ({
          x_pct: clampBoardPct(pt.x_pct),
          y_pct: clampBoardPct(pt.y_pct),
        })),
      ),
    })),
    ...(args.boardWidthM != null &&
      Number.isFinite(args.boardWidthM) &&
      args.boardWidthM > 0
      ? { board_width_m: args.boardWidthM }
      : {}),
    ...(args.buildingSource != null
      ? { building_source: args.buildingSource }
      : {}),
    ...(args.sitePack != null ? { site_pack: args.sitePack } : {}),
    ...(args.machineAccessOverrideMm != null &&
      Number.isFinite(args.machineAccessOverrideMm) &&
      args.machineAccessOverrideMm >= 0
      ? { machine_access_override_mm: args.machineAccessOverrideMm }
      : {}),
    ...(args.machineAccessSource != null
      ? { machine_access_source: args.machineAccessSource }
      : {}),
    neighbour_buildings: [],
  };
}

/** Hydrate site_frame onto seed rings when present and non-empty. */
export function siteFrameToSnapshot(
  frame: DesignSiteFrame | DesignSiteFrameInput | null | undefined,
): {
  boundary?: PctPoint[];
  building?: PctPoint[];
  easements?: PctPoint[][];
  services?: PctPoint[][];
  levels?: SpotLevel[];
  bydaAssets?: DesignSiteFrame["byda_assets"];
  keylessOverlays?: DesignSiteFrame["keyless_overlays"];
  boardWidthM?: number;
  buildingSource?: DesignSiteFrame["building_source"];
  drainageRuns?: Array<{
    id: string;
    points: Array<{ x: number; y: number; z: number }>;
    source: "indicative";
  }>;
  machineAccessOverrideMm?: number;
  machineAccessSource?: "computed" | "measured";
} {
  if (!frame) return {};
  const out: {
    boundary?: PctPoint[];
    building?: PctPoint[];
    easements?: PctPoint[][];
    services?: PctPoint[][];
    levels?: SpotLevel[];
    bydaAssets?: DesignSiteFrame["byda_assets"];
    keylessOverlays?: DesignSiteFrame["keyless_overlays"];
    boardWidthM?: number;
    buildingSource?: DesignSiteFrame["building_source"];
    drainageRuns?: Array<{
      id: string;
      points: Array<{ x: number; y: number; z: number }>;
      source: "indicative";
    }>;
    machineAccessOverrideMm?: number;
    machineAccessSource?: "computed" | "measured";
  } = {};
  if (frame.board_width_m != null && frame.board_width_m > 0) {
    out.boardWidthM = frame.board_width_m;
  }
  if (frame.building_source) out.buildingSource = frame.building_source;
  const boundary = frame.boundary ?? [];
  const building = frame.building ?? [];
  const easements = frame.easements ?? [];
  if (boundary.length >= 3) out.boundary = frameToRing(boundary);
  if (building.length >= 3) out.building = frameToRing(building);
  if (easements.length > 0) {
    out.easements = easements.map(frameToRing);
  }
  const services = frame.services ?? [];
  const levels = frame.levels ?? [];
  if (services.length > 0) {
    out.services = services.map(frameToRing);
  }
  if (levels.length > 0) {
    out.levels = levels.map((lv) => ({
      x: lv.x_pct,
      y: lv.y_pct,
      z: lv.z_m,
    }));
  }
  if (frame.drainage_runs?.length) {
    out.drainageRuns = frame.drainage_runs.map((run) => ({
      id: run.id,
      source: "indicative" as const,
      points: run.points.map((pt) => ({
        x: pt.x_pct,
        y: pt.y_pct,
        z: pt.z_m,
      })),
    }));
  }
  if ((frame.byda_assets ?? []).length > 0) {
    // Input form may omit defaults; cast to parsed DesignSiteFrame shape.
    out.bydaAssets = frame.byda_assets as DesignSiteFrame["byda_assets"];
  }
  if ((frame.keyless_overlays ?? []).length > 0) {
    out.keylessOverlays =
      frame.keyless_overlays as DesignSiteFrame["keyless_overlays"];
  }
  if (frame.machine_access_override_mm != null) {
    out.machineAccessOverrideMm = frame.machine_access_override_mm;
  }
  if (frame.machine_access_source) {
    out.machineAccessSource = frame.machine_access_source;
  }
  return out;
}

/**
 * Resolve the dwelling ring on boot.
 *
 * - Persisted `site_frame.building` wins when present.
 * - A real site frame with no building → empty (never seed).
 * - Live projects (have a projectId) with no frame → empty until Vicmap hydrate.
 * - Demo / no project → seed fallback is allowed.
 */
export function resolveHydratedBuilding(
  frame: DesignSiteFrame | DesignSiteFrameInput | null | undefined,
  hydratedBuilding: PctPoint[] | undefined,
  fallbackBuilding: PctPoint[],
  opts?: { liveProject?: boolean },
): PctPoint[] {
  if (hydratedBuilding) return hydratedBuilding;
  if (frame) return [];
  if (opts?.liveProject) return [];
  return fallbackBuilding;
}
