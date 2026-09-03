/**
 * Phase M.6 — Asset bento (spec §7.2 / 5b).
 *
 * Bento grid, not a list: categories CANOPY / SHRUB / HARD / FURN / SYM.
 * One hero tile spanning two columns. Each asset shows a plan(+elevation)
 * symbol and real dimensions (spread 9.0m · ht 14m).
 *
 * Category mapping follows the existing assetPalette.ts approach: the
 * catalog's `category` string is coarse ("planting", "structure",
 * "furniture", "paving", "water", "annotation", "lighting"), so we resolve
 * each symbol to its StudioItemType via `mapSymbolToStudioType` and derive
 * the bento category from that. Symbols that do not resolve to a studio
 * type (planning hatches, POI glyphs, annotation) fall into SYM.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase M.6.
 * Reference: design_handoff §7.2, BUILD_CHECKLIST 8.6.
 */

import { CURTIS_CATALOG_SYMBOLS, getCatalogSymbol, isSketchGoldStandard } from "@workstream/domain";
import type { CatalogSymbol } from "@workstream/contracts";
import type { StudioItemType } from "../handoff/studioCatalog";
import { STUDIO_ITEM_TYPE_LABEL } from "../handoff/studioCatalog";
import { TYPE_TO_SYMBOL } from "../handoff/state/canvasBridge";
import {
  catalogSymbolStudioType,
  mapSymbolToStudioType,
} from "../handoff/state/studioAiEngine";

/** The spec's five asset bento categories. */
export type BentoCategory = "CANOPY" | "SHRUB" | "HARD" | "FURN" | "SYM";

export const BENTO_CATEGORIES: BentoCategory[] = ["CANOPY", "SHRUB", "HARD", "FURN", "SYM"];

export const BENTO_CATEGORY_LABEL: Record<BentoCategory, string> = {
  CANOPY: "Canopy trees",
  SHRUB: "Shrubs & groundcover",
  HARD: "Hardscape",
  FURN: "Furniture",
  SYM: "Symbols",
};

/** Map a studio type to a bento category. */
const BENTO_BY_STUDIO_TYPE: Record<StudioItemType, BentoCategory> = {
  canopy: "CANOPY",
  exist: "CANOPY",
  feature: "CANOPY",
  hedge: "SHRUB",
  bed: "SHRUB",
  lawn: "SHRUB",
  paving: "HARD",
  deck: "HARD",
  frenchdrain: "HARD",
};

/** Map a catalog symbol to a bento category via its studio type, falling
 * back to the raw catalog category for furniture/lighting (which have no
 * studio type), and SYM for everything else.
 *
 * Classification goes through `catalogSymbolStudioType`, NOT
 * `mapSymbolToStudioType`. The latter is the hydrate function: it is typed
 * `=> StudioItemType` and ends in `return "canopy"`, so it never reports
 * "this symbol has no studio type". Guarding on it made the FURN and SYM
 * branches unreachable and filed benches, bollards and planning hatches as
 * canopy trees — the exact silent rehydration assetPalette.ts avoids the
 * same way. */
function bentoCategoryFor(sym: CatalogSymbol): BentoCategory {
  const studioType = catalogSymbolStudioType(sym.id);
  if (studioType) return BENTO_BY_STUDIO_TYPE[studioType];
  if (sym.category === "furniture" || sym.category === "lighting") return "FURN";
  return "SYM";
}

/** A bento tile — one asset with real dimensions. */
export interface BentoTile {
  symbolId: string;
  label: string;
  botanicalName?: string;
  category: BentoCategory;
  /** Mature spread (m) — real catalog value, never invented. */
  spreadM?: number;
  /** Mature height (m) — real catalog value, never invented. */
  heightM?: number;
  /** Plan symbol glyph (text). */
  planGlyph: string;
  /** Elevation symbol glyph (text). */
  elevGlyph: string;
  /** True if this is the hero tile (spans two columns). */
  hero: boolean;
}

/** Plan glyphs by bento category. */
const PLAN_GLYPH: Record<BentoCategory, string> = {
  CANOPY: "\u2660",
  SHRUB: "\u2766",
  HARD: "\u25A6",
  FURN: "\u25A4",
  SYM: "\u25C7",
};

/** Elevation glyphs by bento category. */
const ELEV_GLYPH: Record<BentoCategory, string> = {
  CANOPY: "\u2663",
  SHRUB: "\u2767",
  HARD: "\u2550",
  FURN: "\u2502",
  SYM: "\u25CB",
};

/** Build a bento tile from a catalog symbol. */
function tileFromCatalog(sym: CatalogSymbol, hero: boolean): BentoTile {
  const category = bentoCategoryFor(sym);
  return {
    symbolId: sym.id,
    label: sym.label,
    botanicalName: sym.botanical_name,
    category,
    spreadM: sym.default_width_m,
    heightM: sym.mature_height_m,
    planGlyph: PLAN_GLYPH[category],
    elevGlyph: ELEV_GLYPH[category],
    hero,
  };
}

/** Format dimensions for the tile face. */
export function formatDimensions(tile: BentoTile): string {
  const parts: string[] = [];
  if (tile.spreadM != null) parts.push(`spread ${tile.spreadM.toFixed(1)}m`);
  if (tile.heightM != null) parts.push(`ht ${tile.heightM.toFixed(1)}m`);
  return parts.join(" \u00b7 ");
}

/**
 * Build the bento grid from the catalog. The first canopy tree is the hero
 * tile (spans two columns). Categories are grouped in spec order.
 *
 * Eligibility mirrors assetPalette.ts: only gold-standard symbols that
 * resolve to a real studio type are offered as CANOPY/SHRUB/HARD tiles;
 * furniture/lighting tiles are offered even without a studio type (they
 * are placed as catalog glyphs); annotation/hatch symbols are excluded
 * entirely rather than silently rehydrating as trees.
 */
export function buildBentoGrid(): BentoTile[] {
  const tiles: BentoTile[] = [];
  let heroAssigned = false;
  for (const cat of BENTO_CATEGORIES) {
    for (const sym of CURTIS_CATALOG_SYMBOLS) {
      if (!isSketchGoldStandard(sym)) continue;
      const bentoCat = bentoCategoryFor(sym);
      if (bentoCat !== cat) continue;
      // Exclude SYM tiles that are annotation/hatch (no honest render)
      if (bentoCat === "SYM" && sym.category === "annotation") continue;
      const isHero = !heroAssigned && cat === "CANOPY";
      if (isHero) heroAssigned = true;
      tiles.push(tileFromCatalog(sym, isHero));
    }
  }
  return tiles;
}

/** Filter bento tiles by category. */
export function filterBentoByCategory(
  tiles: BentoTile[],
  category: BentoCategory | "all",
): BentoTile[] {
  if (category === "all") return tiles;
  return tiles.filter((t) => t.category === category);
}

/** Count tiles per category. */
export function bentoCategoryCounts(tiles: BentoTile[]): Record<BentoCategory, number> {
  const counts: Record<BentoCategory, number> = {
    CANOPY: 0,
    SHRUB: 0,
    HARD: 0,
    FURN: 0,
    SYM: 0,
  };
  for (const t of tiles) counts[t.category]++;
  return counts;
}

/** Get a tile by symbol id. */
export function bentoTileById(tiles: BentoTile[], symbolId: string): BentoTile | undefined {
  return tiles.find((t) => t.symbolId === symbolId);
}

/** The curated hero symbol id (the first canopy tree in the dock order). */
export function bentoHeroSymbolId(): string | undefined {
  return TYPE_TO_SYMBOL.canopy;
}

/** Look up the catalog label for a symbol id, falling back to the studio
 * type label, then the id itself. Never invents a label. */
export function bentoLabelFor(symbolId: string): string {
  const catalog = getCatalogSymbol(symbolId);
  if (catalog) return catalog.label;
  const studioType = mapSymbolToStudioType(symbolId);
  if (studioType) return STUDIO_ITEM_TYPE_LABEL[studioType];
  return symbolId;
}
