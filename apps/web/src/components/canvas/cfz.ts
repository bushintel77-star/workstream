/*
 * Companion to apps/web/src/styles/globals.css — the four-slot CSS z-token
 * ladder ("--cf-z-canvas|spatial|chrome|app") plus the drei
 * `<Html zIndexRange>` pair registry. Every numeric value in this module is
 * derived from the four SDS tokens so all overrides remain in ONE place
 * (globals.css). Do not introduce additional hard-coded numbers here; if
 * the lattice needs a new rung, add it to globals.css first and then add
 * the matching accessor.
 *
 * See also:
 *   - docs/CANVAS-FIRST-Z-STACK-CONTRACT.md — full contract, three-way
 *     guard, four-step tier-bump migration recipe.
 *   - ./cfz.migration.ts — programmatic version of the recipe; emits the
 *     same four-step list as `formatMigrationRecipe()`.
 *
 * Layout tiers (CSS):
 *   canvas  → --cf-z-canvas  (0)
 *   spatial → --cf-z-spatial (10)
 *   chrome  → --cf-z-chrome  (20)
 *   app     → --cf-z-app     (30)
 *
 * Drei zIndexRange pairs (near, far):
 *   spatialLabel      → [spatial,   canvas + 1]   // pins / single-row callouts
 *   spatialAnnotation → [chrome,    spatial]      // dimensions, irrigation zones, etc.
 *   chromeChip        → [app,       spatial + 5]  // meta chips / status badges
 *   chromeZone        → [app,       chrome]       // flora rings / zone rings
 *
 * SSR note: `document` is undefined during Next.js server render, so the
 * first call falls back to a record that matches the CSS defaults exactly.
 * Client-side hydration reads from CSSOM and caches per tier. The cache is
 * permanent for the lifetime of the page — token values are static.
 */

export type CfTier = "canvas" | "spatial" | "chrome" | "app";

const VAR_NAMES: Record<CfTier, string> = {
  canvas: "--cf-z-canvas",
  spatial: "--cf-z-spatial",
  chrome: "--cf-z-chrome",
  app: "--cf-z-app",
};

// Authoritative fallback when the CSSOM is unavailable (server render,
// unit tests, RSC). Must mirror the values declared in globals.css.
//
// Exported so the CSS/JS parity test in cfz.parity.test.ts can read the
// JS side directly without re-declaring the constants. Drift between
// this export and the four `--cf-z-*` declarations in globals.css is
// the bug — caught by that test.
export const CF_Z_FALLBACK: Record<CfTier, number> = {
  canvas: 0,
  spatial: 10,
  chrome: 20,
  app: 30,
};

const cache = new Map<CfTier, number>();

/** Resolve a single SDS tier token from the document CSSOM, with a cache. */
export function readCfZ(tier: CfTier): number {
  const cached = cache.get(tier);
  if (cached !== undefined) return cached;
  if (typeof document === "undefined") return CF_Z_FALLBACK[tier];
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(VAR_NAMES[tier])
    .trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return CF_Z_FALLBACK[tier];
  cache.set(tier, n);
  return n;
}

/** Drop-in for `<Html zIndexRange={cfZPair("spatialAnnotation")} />`. */
export type CfPair =
  | "spatialLabel"
  | "spatialAnnotation"
  | "chromeChip"
  | "chromeZone";

// Drei's `<Html zIndexRange>` prop accepts a mutable `number[]`, NOT a
// readonly tuple — verified by tsc against the @react-three/drei type
// declarations. Returning a fresh `[number, number]` from each helper
// call dodges the TS4104 "readonly not assignable to mutable" error
// without forcing consumers to spread the result.
//
// Computed once at module load so consumers can either pick the value out
// of the record (constant across the page) or call the helper for late
// overrides. Both paths are SSR-safe via the fallback.
function computePairs(): Record<CfPair, [number, number]> {
  const canvas = readCfZ("canvas");
  const spatial = readCfZ("spatial");
  const chrome = readCfZ("chrome");
  const app = readCfZ("app");

  return {
    spatialLabel: [spatial, canvas + 1],
    spatialAnnotation: [chrome, spatial],
    chromeChip: [app, spatial + 5],
    chromeZone: [app, chrome],
  };
}

export const CF_Z_PAIRS: Record<CfPair, [number, number]> = computePairs();

/** Functional accessor — preferred call form. Re-resolves on demand. */
export function cfZPair(kind: CfPair): [number, number] {
  switch (kind) {
    case "spatialLabel":
      return [readCfZ("spatial"), readCfZ("canvas") + 1];
    case "spatialAnnotation":
      return [readCfZ("chrome"), readCfZ("spatial")];
    case "chromeChip":
      return [readCfZ("app"), readCfZ("spatial") + 5];
    case "chromeZone":
      return [readCfZ("app"), readCfZ("chrome")];
  }
}
