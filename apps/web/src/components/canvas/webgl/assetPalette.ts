/**
 * Gold Standard 2026 — Asset Palette (fan-out dock entries).
 *
 * Pure module: builds the palette the AssetFanOutDock offers.
 *
 * Two faces, one hydrate guarantee:
 *   - `buildAssetPalette()` — the curated eight TYPE_TO_SYMBOL ids. This is
 *     the dock's default face and the fastest path to the Curtis palette.
 *   - `buildCatalogAssetPalette()` — the curated eight followed by every
 *     gold-standard catalog symbol that resolves to a real studio type.
 *     Reachable through search / the category chips.
 *
 * The hydrate guarantee: `placementsToItems` rebuilds a studio item from the
 * persisted `symbol_id` via `mapSymbolToStudioType`, so an entry is only safe
 * to offer if that function returns the same type the dock advertised. Every
 * entry here takes its `type` FROM `mapSymbolToStudioType`, and the catalog
 * face is filtered by `catalogSymbolStudioType` — symbols the catalog cannot
 * class (planning hatches, POI glyphs) are not offered at all rather than
 * silently rehydrating as canopy trees.
 *
 * Metadata comes from the real catalog (getCatalogSymbol) where entries
 * exist — botanical name, mature height, spread — "never invented" (the
 * mobile DiscoveryAssetCard law). Coarse ids without catalog entries fall
 * back to the studio type label; no fake botany.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { CURTIS_CATALOG_SYMBOLS, getCatalogSymbol, isSketchGoldStandard } from "@workstream/domain";
import type { StudioItemType } from "../handoff/studioCatalog";
import { STUDIO_ITEM_TYPE_LABEL } from "../handoff/studioCatalog";
import { TYPE_TO_SYMBOL } from "../handoff/state/canvasBridge";
import {
  catalogSymbolStudioType,
  mapSymbolToStudioType,
} from "../handoff/state/studioAiEngine";

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

/** Cards rendered in one dock strip before the operator must refine. */
export const MAX_DOCK_RESULTS = 24;

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
  /** True for the eight curated cards — the dock's default face. */
  curated: boolean;
}

const CATEGORY_BY_TYPE: Record<StudioItemType, AssetPaletteCategory> = {
  canopy: "tree",
  exist: "tree",
  hedge: "shrub",
  feature: "tree",
  bed: "groundcover",
  lawn: "groundcover",
  paving: "hardscape",
  deck: "hardscape",
  frenchdrain: "hardscape",
};

export const GLYPH_BY_TYPE: Record<StudioItemType, string> = {
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

/** Category order for the wider catalog face (plan-reading order). */
const CATEGORY_RANK: Record<AssetPaletteCategory, number> = {
  tree: 0,
  shrub: 1,
  groundcover: 2,
  hardscape: 3,
};

function entryFor(symbolId: string, type: StudioItemType, curated: boolean): AssetPaletteEntry {
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
    curated,
  };
}

/**
 * Build the curated palette. Deterministic: same output every call — safe
 * for useMemo dependency-free use and unit-pinned.
 */
export function buildAssetPalette(): AssetPaletteEntry[] {
  return DOCK_ORDER.map((type) => entryFor(TYPE_TO_SYMBOL[type], type, true));
}

/**
 * Build the full reachable palette: the curated eight, then every gold
 * catalog symbol whose type the catalog can resolve. Existing trees are
 * surveyed, not palette-placed, so `exist` never enters the dock.
 * Deterministic (the catalog array is static and the sort is total).
 */
export function buildCatalogAssetPalette(): AssetPaletteEntry[] {
  const curated = buildAssetPalette();
  const seen = new Set(curated.map((e) => e.symbolId));
  const extra: AssetPaletteEntry[] = [];
  for (const sym of CURTIS_CATALOG_SYMBOLS) {
    if (seen.has(sym.id)) continue;
    if (!isSketchGoldStandard(sym)) continue;
    // Eligibility: the catalog record must class the symbol. Structures,
    // water bodies, furniture, lighting and planning hatches have no honest
    // studio render, so they are not offered rather than rehydrating as trees.
    if (!catalogSymbolStudioType(sym.id)) continue;
    // The card advertises what hydrate will actually rebuild — the same
    // function placementsToItems runs, so the two cannot drift.
    const type = mapSymbolToStudioType(sym.id);
    if (type === "exist") continue;
    seen.add(sym.id);
    extra.push(entryFor(sym.id, type, false));
  }
  extra.sort(
    (a, b) =>
      CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] ||
      a.label.localeCompare(b.label, "en-AU") ||
      a.symbolId.localeCompare(b.symbolId),
  );
  return [...curated, ...extra];
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
      e.symbolId.toLowerCase().includes(q) ||
      e.category.includes(q)
    );
  });
}
