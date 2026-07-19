/**
 * Bridge StudioItem / SketchStroke ↔ DesignCanvas CatalogPlacement / CanvasStroke.
 * Ghosts never persist. Non-UUID demo ids are remapped for the contracts schema.
 */

import type {
  CatalogPlacement,
  CanvasStroke,
  DesignSiteFrame,
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

export function strokesToCanvas(strokes: SketchStroke[]): CanvasStroke[] {
  return strokes.map((s) => ({
    id: ensureUuid(s.id),
    points: s.points.map((p) => ({
      x_pct: clampPct(p.x),
      y_pct: clampPct(p.y),
    })),
    color: "#c2455f",
    width_px: 2,
  }));
}

export function canvasToStrokes(strokes: CanvasStroke[]): SketchStroke[] {
  return strokes.map((s) => ({
    id: s.id,
    points: s.points.map((p) => ({ x: p.x_pct, y: p.y_pct })),
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
  };
}

/** Hydrate site_frame onto seed rings when present and non-empty. */
export function siteFrameToSnapshot(frame: DesignSiteFrame | null | undefined): {
  boundary?: PctPoint[];
  building?: PctPoint[];
  easements?: PctPoint[][];
  services?: PctPoint[][];
  levels?: SpotLevel[];
} {
  if (!frame) return {};
  const out: {
    boundary?: PctPoint[];
    building?: PctPoint[];
    easements?: PctPoint[][];
    services?: PctPoint[][];
    levels?: SpotLevel[];
  } = {};
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
  return out;
}
