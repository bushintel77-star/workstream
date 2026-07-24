/**
 * Shared presentation tokens for plan geometry (shadows, hatches).
 * Keep deterministic — no Math.random.
 */

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

/** Dwelling envelope hatch pattern ids — defined in CadPlanBoard defs (board-space scale). */
export const DWELLING_HATCH_IDS = {
  light: "ws-dwelling-hatch",
  night: "ws-dwelling-hatch-night",
} as const;

export function sunShadowFill(night: boolean): string {
  const o = night ? SUN_SHADOW.nightOpacity : SUN_SHADOW.opacity;
  return `rgba(28,25,23,${o})`;
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
