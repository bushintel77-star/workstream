/**
 * Gold Standard 2026 — Asset Palette (fan-out dock entries).
 *
 * Pure module: builds the curated palette the AssetFanOutDock offers. The
 * entries are the nine TYPE_TO_SYMBOL ids — the exact symbol ids the
 * placementsToItems hydrate round-trips guarantee, so anything placed from
 * the dock survives save → reload → rehydrate as the same studio type.
 *
 * Metadata comes from the real catalog (getCatalogSymbol) where entries
 * exist — botanical name, mature height, spread — "never invented" (the
 * mobile DiscoveryAssetCard law). Coarse ids without catalog entries fall
 * back to the studio type label; no fake botany.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { getCatalogSymbol } from "@workstream/domain";
import type { StudioItemType } from "../handoff/studioCatalog";
import { STUDIO_ITEM_TYPE_LABEL } from "../handoff/studioCatalog";
import { TYPE_TO_SYMBOL } from "../handoff/state/canvasBridge";

export type AssetPaletteCategory = "tree" | "shrub" | "groundcover" | "hardscape";

export const ASSET_CATEGORY_LABEL: Record<AssetPaletteCategory, string> = {
  tree: "Trees",
  shrub: "Shrubs",
  groundcover: "Groundcover",
  hardscape: "Hardscape",
};

export const ASSET_CATEGORIES: AssetPaletteCategory[] = [
  "tree",
  "shrub",
  "groundcover",
  "hardscape",
];

export interface AssetPaletteEntry {
  symbolId: string;
  /** The studio type the symbol hydrates to (drives the 3D glyph). */
  type: StudioItemType;
  label: string;
  botanicalName?: string;
  /** Mature height (m) — real catalog value only. */
  heightM?: number;
  /** Spread / radial footprint (m) — real catalog value only. */
  spreadM?: number;
  category: AssetPaletteCategory;
  /** Compact text glyph for the card face (no icon font in the GL studio). */
  glyph: string;
}

const CATEGORY_BY_TYPE: Record<StudioItemType, AssetPaletteCategory> = {
  canopy: "tree",
  exist: "tree",
  hedge: "shrub",
  feature: "shrub",
  bed: "groundcover",
  lawn: "groundcover",
  paving: "hardscape",
  deck: "hardscape",
  frenchdrain: "hardscape",
};

const GLYPH_BY_TYPE: Record<StudioItemType, string> = {
  canopy: "♠",
  feature: "✿",
  paving: "▦",
  deck: "▤",
  lawn: "≋",
  hedge: "❦",
  bed: "❀",
  frenchdrain: "≈",
  exist: "♣",
};

/** The dock's palette order — botanicals first, then hardscape. */
const DOCK_ORDER: StudioItemType[] = [
  "canopy",
  "hedge",
  "bed",
  "lawn",
  "feature",
  "paving",
  "deck",
  "frenchdrain",
];

/**
 * Build the curated palette. Deterministic: same output every call — safe
 * for useMemo dependency-free use and unit-pinned.
 */
export function buildAssetPalette(): AssetPaletteEntry[] {
  return DOCK_ORDER.map((type) => {
    const symbolId = TYPE_TO_SYMBOL[type];
    const catalog = getCatalogSymbol(symbolId);
    return {
      symbolId,
      type,
      label: catalog?.label ?? STUDIO_ITEM_TYPE_LABEL[type],
      botanicalName: catalog?.botanical_name,
      heightM: catalog?.mature_height_m,
      spreadM: catalog?.default_width_m,
      category: CATEGORY_BY_TYPE[type],
      glyph: GLYPH_BY_TYPE[type],
    };
  });
}

export function filterAssetPalette(
  palette: AssetPaletteEntry[],
  opts: { category?: AssetPaletteCategory | "all"; query?: string },
): AssetPaletteEntry[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  return palette.filter((e) => {
    if (opts.category && opts.category !== "all" && e.category !== opts.category) {
      return false;
    }
    if (!q) return true;
    return (
      e.label.toLowerCase().includes(q) ||
      (e.botanicalName?.toLowerCase().includes(q) ?? false) ||
      e.category.includes(q)
    );
  });
}
