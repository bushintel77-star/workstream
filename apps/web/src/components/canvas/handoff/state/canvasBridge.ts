/**
 * Bridge StudioItem / SketchStroke ↔ DesignCanvas CatalogPlacement / CanvasStroke.
 * Ghosts never persist. Non-UUID demo ids are remapped for the contracts schema.
 */

import type { CatalogPlacement, CanvasStroke } from "@workstream/contracts";
import type { SketchStroke, StudioItem, StudioItemType } from "../studioCatalog";
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
      label: i.t,
    }));
}

export function placementsToItems(
  placements: CatalogPlacement[],
): StudioItem[] {
  return placements.map((p) => ({
    id: p.id,
    t: mapSymbolToStudioType(p.symbol_id),
    x: p.x_pct,
    y: p.y_pct,
    rot: p.rotation_deg ?? 0,
    scale: p.scale ?? 1,
    ghost: false,
  }));
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
