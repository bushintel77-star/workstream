/**
 * Gold Standard 2026 — state bridge: StudioItem → RenderItem.
 *
 * The existing useStudioState reducer holds StudioItem[] in board-% space.
 * The WebGL scene graph consumes RenderItem[] — a strict subset that drops
 * the fields the 3D renderer doesn't need (why/conf/stale/etc).
 *
 * No value math is needed: positions are already in board-% (0–100), and
 * the coordTransform layer (pctToWorld) handles the %→metre conversion.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §5 (state layer unchanged)
 */

import type { RenderItem } from "./sceneItems";
import type { PctPoint } from "./coordTransform";
import type { StudioItem } from "../handoff/studioCatalog";
import { getCatalogSymbol } from "@workstream/domain";

/**
 * The StudioItem fields the WebGL renderer needs — derived from the canonical
 * handoff-layer StudioItem so field drift surfaces as a compile error (a new
 * required field on StudioItem, or a renamed one, will fail the Omit).
 *
 * outlinePct is StudioItem.Pt[] ({x,y}) which is structurally identical to
 * PctPoint — the cast below is safe and compiler-checked.
 */
type StudioItemLike = Omit<
  StudioItem,
  "why" | "conf" | "stale" | "stemDbhM" | "pathWidthM" | "edgeType" | "pathFilletM" | "source"
>;

/** Leaf retention from the catalog symbol's keywords, when the species
 *  declares it. Undefined keeps the existing-vs-new planting heuristic. */
function leafRetentionFor(
  symbolId: string | undefined,
): RenderItem["leafRetention"] {
  if (!symbolId) return undefined;
  const keywords = getCatalogSymbol(symbolId)?.keywords ?? [];
  if (keywords.includes("deciduous")) return "deciduous";
  if (keywords.includes("evergreen")) return "evergreen";
  return undefined;
}

/**
 * Convert StudioItem[] → RenderItem[].
 * Structural pick — drops why/conf/stale/stemDbhM/pathWidthM/etc.
 * outlinePct Pt[] → PctPoint[] is structurally identical ({x,y}).
 */
export function toRenderItems(items: StudioItemLike[]): RenderItem[] {
  return items.map((i) => ({
    id: i.id,
    t: i.t,
    x: i.x,
    y: i.y,
    rot: i.rot,
    scale: i.scale,
    ghost: i.ghost,
    outlinePct: i.outlinePct as PctPoint[] | undefined,
    dbhM: i.dbhM,
    heightM: i.heightM,
    leafRetention: leafRetentionFor(i.symbolId),
  }));
}
