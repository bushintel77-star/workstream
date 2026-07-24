/**
 * Bridge StudioItem / SketchStroke ↔ DesignCanvas CatalogPlacement / CanvasStroke.
 * Ghosts never persist. Non-UUID demo ids are remapped for the contracts schema.
 */

import type {
  CatalogPlacement,
  CanvasStroke,
  DesignSiteFrame,
  LandscapeFeature,
} from "@workstream/contracts";
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

/** Pack optional authored DBH into placement label for durable round-trip. */
function placementLabel(i: StudioItem): string {
  if (i.t === "exist" && i.dbhM != null && Number.isFinite(i.dbhM)) {
    return `exist:dbh=${i.dbhM}`;
  }
  return i.t;
}

function dbhFromLabel(label: string | undefined): number | undefined {
  if (!label) return undefined;
  const m = /^exist:dbh=([\d.]+)$/.exec(label);
  if (!m) return undefined;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Accepted (non-ghost) items → catalog placements. */
export function itemsToPlacements(items: StudioItem[]): CatalogPlacement[] {
  return items
    .filter((i) => !i.ghost)
    .map((i) => ({
      id: ensureUuid(i.id),
      symbol_id: TYPE_TO_SYMBOL[i.t],
      x_pct: clampPct(i.x),
      y_pct: clampPct(i.y),
      rotation_deg: ((i.rot % 360) + 360) % 360,
      scale: Math.max(0.05, i.scale),
      label: placementLabel(i),
    }));
}

export function placementsToItems(
  placements: CatalogPlacement[],
): StudioItem[] {
  return placements.map((p) => {
    const t = mapSymbolToStudioType(p.symbol_id);
    const dbhM = t === "exist" ? dbhFromLabel(p.label) : undefined;
    return {
      id: p.id,
      t,
      x: p.x_pct,
      y: p.y_pct,
      rot: p.rotation_deg ?? 0,
      scale: p.scale ?? 1,
      ghost: false,
      ...(dbhM != null ? { dbhM } : {}),
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
          pct: { x_pct: clampPct(p.x), y_pct: clampPct(p.y) },
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

export function strokesToCanvas(strokes: SketchStroke[]): CanvasStroke[] {
  return strokes.map((s) => ({
    id: ensureUuid(s.id),
    points: s.points.map((p) => ({
      x_pct: clampPct(p.x),
      y_pct: clampPct(p.y),
    })),
    color: s.color ?? "#1c1917",
    width_px: s.widthPx ?? 2,
  }));
}

export function canvasToStrokes(strokes: CanvasStroke[]): SketchStroke[] {
  return strokes.map((s) => ({
    id: s.id,
    points: s.points.map((p) => ({ x: p.x_pct, y: p.y_pct })),
    color: s.color,
    widthPx: s.width_px,
  }));
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function ringToFrame(pts: PctPoint[]) {
  return pts.map((p) => ({
    x_pct: clampPct(p.x),
    y_pct: clampPct(p.y),
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
  bydaAssets?: DesignSiteFrame["byda_assets"];
  keylessOverlays?: DesignSiteFrame["keyless_overlays"];
  /** Metres per 100% board width (Vicmap fit or operator calibration). */
  boardWidthM?: number | null;
  buildingSource?: DesignSiteFrame["building_source"];
}): DesignSiteFrame {
  return {
    boundary: ringToFrame(args.boundary),
    building: ringToFrame(args.building),
    easements: args.easements.map(ringToFrame),
    services: args.services.map(ringToFrame),
    levels: args.levels.map((lv) => ({
      x_pct: clampPct(lv.x),
      y_pct: clampPct(lv.y),
      z_m: lv.z,
    })),
    byda_assets: (args.bydaAssets ?? []).map((a) => ({
      ...a,
      ring: a.ring.map((p) => ({
        x_pct: clampPct(p.x_pct),
        y_pct: clampPct(p.y_pct),
      })),
    })),
    keyless_overlays: args.keylessOverlays ?? [],
    ...(args.boardWidthM != null &&
    Number.isFinite(args.boardWidthM) &&
    args.boardWidthM > 0
      ? { board_width_m: args.boardWidthM }
      : {}),
    ...(args.buildingSource != null
      ? { building_source: args.buildingSource }
      : {}),
  };
}

/** Hydrate site_frame onto seed rings when present and non-empty. */
export function siteFrameToSnapshot(frame: DesignSiteFrame | null | undefined): {
  boundary?: PctPoint[];
  building?: PctPoint[];
  easements?: PctPoint[][];
  services?: PctPoint[][];
  levels?: SpotLevel[];
  bydaAssets?: DesignSiteFrame["byda_assets"];
  keylessOverlays?: DesignSiteFrame["keyless_overlays"];
  boardWidthM?: number;
  buildingSource?: DesignSiteFrame["building_source"];
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
  } = {};
  if (frame.board_width_m != null && frame.board_width_m > 0) {
    out.boardWidthM = frame.board_width_m;
  }
  if (frame.building_source) out.buildingSource = frame.building_source;
  if (frame.boundary.length >= 3) out.boundary = frameToRing(frame.boundary);
  if (frame.building.length >= 3) out.building = frameToRing(frame.building);
  if (frame.easements.length > 0) {
    out.easements = frame.easements.map(frameToRing);
  }
  if (frame.services.length > 0) {
    out.services = frame.services.map(frameToRing);
  }
  if (frame.levels.length > 0) {
    out.levels = frame.levels.map((lv) => ({
      x: lv.x_pct,
      y: lv.y_pct,
      z: lv.z_m,
    }));
  }
  if ((frame.byda_assets ?? []).length > 0) {
    out.bydaAssets = frame.byda_assets;
  }
  if ((frame.keyless_overlays ?? []).length > 0) {
    out.keylessOverlays = frame.keyless_overlays;
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
  frame: DesignSiteFrame | null | undefined,
  hydratedBuilding: PctPoint[] | undefined,
  fallbackBuilding: PctPoint[],
  opts?: { liveProject?: boolean },
): PctPoint[] {
  if (hydratedBuilding) return hydratedBuilding;
  if (frame) return [];
  if (opts?.liveProject) return [];
  return fallbackBuilding;
}
