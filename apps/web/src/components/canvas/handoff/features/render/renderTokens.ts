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

/** Hatch pattern ids — defined once in RenderDefs. */
export const HATCH_IDS = {
  bluestone: "ws-hatch-bluestone",
  bluestoneNight: "ws-hatch-bluestone-night",
  deck: "ws-hatch-deck",
  deckNight: "ws-hatch-deck-night",
  gravel: "ws-hatch-gravel",
  gravelNight: "ws-hatch-gravel-night",
} as const;

export function hatchUrlFor(
  kind: "bluestone" | "deck" | "gravel",
  night: boolean,
): string {
  if (kind === "bluestone") {
    return `url(#${night ? HATCH_IDS.bluestoneNight : HATCH_IDS.bluestone})`;
  }
  if (kind === "deck") {
    return `url(#${night ? HATCH_IDS.deckNight : HATCH_IDS.deck})`;
  }
  return `url(#${night ? HATCH_IDS.gravelNight : HATCH_IDS.gravel})`;
}
