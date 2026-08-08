/**
 * Shared presentation tokens for plan geometry (shadows, hatches).
 * Keep deterministic — no Math.random.
 */

import type { BoardShadowCast } from "@workstream/domain";

/**
 * Soft-shadow presentation factors. Direction comes from live sun azimuth
 * (`decorativeGlyphShadowOffset` / SunShadowProvider) — same opposite-sun
 * vector as timed cast. Defaults below match north-sun → south-fall.
 */
export const SUN_SHADOW = {
  /** @deprecated Prefer live azimuth via SunShadowProvider. */
  dxPct: 0,
  dyFactor: 0.22,
  opacity: 0.12,
  /** Night board — stronger chalk shadow under multiply. */
  nightOpacity: 0.3,
  /** Dwelling envelope soft offset length in plan % units. */
  dwellingDyPct: 0.55,
} as const;

/** Resolved shadow for glyphs + dwelling (static or live sun cast). */
export type SunShadowView = {
  dxPct: number;
  dyPct: number;
  dxFactor: number;
  dyFactor: number;
  opacity: number;
  nightOpacity: number;
};

export function viewFromCast(cast: BoardShadowCast | null): SunShadowView {
  if (!cast || cast.lengthM <= 0) {
    return {
      dxPct: SUN_SHADOW.dxPct,
      dyPct: SUN_SHADOW.dwellingDyPct,
      dxFactor: 0,
      dyFactor: SUN_SHADOW.dyFactor,
      opacity: SUN_SHADOW.opacity,
      nightOpacity: SUN_SHADOW.nightOpacity,
    };
  }
  // Low sun → slightly stronger multiply; high sun → soft.
  const boost = Math.min(0.1, Math.max(0, (45 - cast.altitude_deg) / 400));
  return {
    dxPct: cast.dxPct,
    dyPct: cast.dyPct,
    dxFactor: cast.dxFactor,
    dyFactor: cast.dyFactor,
    opacity: SUN_SHADOW.opacity + boost,
    nightOpacity: SUN_SHADOW.nightOpacity,
  };
}

export function sunShadowFillFrom(
  view: Pick<SunShadowView, "opacity" | "nightOpacity">,
  night: boolean,
): string {
  const o = night ? view.nightOpacity : view.opacity;
  const pct = Math.round(o * 100);
  return `color-mix(in srgb, var(--text-primary) ${pct}%, transparent)`;
}

/** Dwelling envelope hatch pattern ids — defined in CadPlanBoard defs (board-space scale). */
export const DWELLING_HATCH_IDS = {
  light: "ws-dwelling-hatch",
  night: "ws-dwelling-hatch-night",
} as const;

export function sunShadowFill(night: boolean): string {
  return sunShadowFillFrom(
    {
      opacity: SUN_SHADOW.opacity,
      nightOpacity: SUN_SHADOW.nightOpacity,
    },
    night,
  );
}

/**
 * Paving / surface material families that carry a plan hatch.
 * One entry per Curtis hardscape family — the plan, palette swatch and fit
 * sheet all read the same pattern so a material looks like itself everywhere.
 */
export type HatchKind =
  | "bluestone"
  | "deck"
  | "gravel"
  | "porcelain"
  | "stepper"
  | "crazypave"
  | "aggregate"
  | "hoggin";

/** Hatch pattern ids — defined once in RenderDefs. */
export const HATCH_IDS = {
  bluestone: "ws-hatch-bluestone",
  bluestoneNight: "ws-hatch-bluestone-night",
  deck: "ws-hatch-deck",
  deckNight: "ws-hatch-deck-night",
  gravel: "ws-hatch-gravel",
  gravelNight: "ws-hatch-gravel-night",
  porcelain: "ws-hatch-porcelain",
  porcelainNight: "ws-hatch-porcelain-night",
  stepper: "ws-hatch-stepper",
  stepperNight: "ws-hatch-stepper-night",
  crazypave: "ws-hatch-crazypave",
  crazypaveNight: "ws-hatch-crazypave-night",
  aggregate: "ws-hatch-aggregate",
  aggregateNight: "ws-hatch-aggregate-night",
  hoggin: "ws-hatch-hoggin",
  hogginNight: "ws-hatch-hoggin-night",
} as const;

const HATCH_PAIRS: Record<HatchKind, { day: string; night: string }> = {
  bluestone: { day: HATCH_IDS.bluestone, night: HATCH_IDS.bluestoneNight },
  deck: { day: HATCH_IDS.deck, night: HATCH_IDS.deckNight },
  gravel: { day: HATCH_IDS.gravel, night: HATCH_IDS.gravelNight },
  porcelain: { day: HATCH_IDS.porcelain, night: HATCH_IDS.porcelainNight },
  stepper: { day: HATCH_IDS.stepper, night: HATCH_IDS.stepperNight },
  crazypave: { day: HATCH_IDS.crazypave, night: HATCH_IDS.crazypaveNight },
  aggregate: { day: HATCH_IDS.aggregate, night: HATCH_IDS.aggregateNight },
  hoggin: { day: HATCH_IDS.hoggin, night: HATCH_IDS.hogginNight },
};

export function hatchUrlFor(kind: HatchKind, night: boolean): string {
  const pair = HATCH_PAIRS[kind] ?? HATCH_PAIRS.gravel;
  return `url(#${night ? pair.night : pair.day})`;
}

/**
 * Elevation silhouette textures. Separate from the plan hatches because the
 * elevation board works in a much smaller viewBox (bars are ~2–6 units wide),
 * so the tiles have to be finer than the plan patterns to read at all.
 * Mount `ElevationTextureDefs` once inside the elevation SVG before using them.
 */
export type ElevationTextureKind = "foliage" | "timber" | "clip";

export const ELEV_TEXTURE_IDS = {
  foliage: "ws-elev-foliage",
  foliageNight: "ws-elev-foliage-night",
  timber: "ws-elev-timber",
  timberNight: "ws-elev-timber-night",
  clip: "ws-elev-clip",
  clipNight: "ws-elev-clip-night",
} as const;

const ELEV_TEXTURE_PAIRS: Record<
  ElevationTextureKind,
  { day: string; night: string }
> = {
  foliage: { day: ELEV_TEXTURE_IDS.foliage, night: ELEV_TEXTURE_IDS.foliageNight },
  timber: { day: ELEV_TEXTURE_IDS.timber, night: ELEV_TEXTURE_IDS.timberNight },
  clip: { day: ELEV_TEXTURE_IDS.clip, night: ELEV_TEXTURE_IDS.clipNight },
};

export function elevationTextureUrl(
  kind: ElevationTextureKind,
  night: boolean,
): string {
  const pair = ELEV_TEXTURE_PAIRS[kind] ?? ELEV_TEXTURE_PAIRS.foliage;
  return `url(#${night ? pair.night : pair.day})`;
}

/** Curtis catalog symbol id → plan hatch family (paving + deck materials). */
const HATCH_BY_SYMBOL_ID: Record<string, HatchKind> = {
  "bluestone-paver": "bluestone",
  "bluestone-step": "bluestone",
  "basalt-grid": "bluestone",
  "limestone-coping": "bluestone",
  "granite-stepper": "stepper",
  "sandstone-crazy": "crazypave",
  "porcelain-tile": "porcelain",
  "exposed-aggregate": "aggregate",
  "gravel-mulch": "gravel",
  "hoggin-path": "hoggin",
  "timber-deck": "deck",
  "timber-edging": "deck",
  "curtis-deck-050": "deck",
};

/**
 * Resolve the hatch for a placed asset. Falls back to the coarse studio type
 * so untagged / legacy placements keep their current look.
 */
export function hatchKindForSymbol(
  symbolId: string | undefined,
  fallback: HatchKind,
): HatchKind {
  if (!symbolId) return fallback;
  return HATCH_BY_SYMBOL_ID[symbolId.trim().toLowerCase()] ?? fallback;
}
