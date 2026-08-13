/**
 * Gold Standard 2026 — state bridge: StudioItem → RenderItem.
 *
 * The existing useStudioState reducer holds StudioItem[] in board-% space.
 * The WebGL scene graph consumes RenderItem[] — a strict subset that drops
 * the fields the 3D renderer doesn't need (why/conf/stale/symbolId/etc).
 *
 * No value math is needed: positions are already in board-% (0–100), and
 * the coordTransform layer (pctToWorld) handles the %→metre conversion.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §5 (state layer unchanged)
 */

import type { RenderItem } from "./sceneItems";
import type { PctPoint } from "./coordTransform";

/** The StudioItem fields the WebGL renderer needs (structural subset). */
interface StudioItemLike {
  id: string;
  t: RenderItem["t"];
  x: number;
  y: number;
  rot: number;
  scale: number;
  ghost: boolean;
  outlinePct?: Array<{ x: number; y: number }>;
  dbhM?: number;
  heightM?: number;
}

/**
 * Convert StudioItem[] → RenderItem[].
 * Structural pick — drops why/conf/stale/stemDbhM/symbolId/pathWidthM/etc.
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
  }));
}
