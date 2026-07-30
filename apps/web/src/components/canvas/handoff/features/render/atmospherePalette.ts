/**
 * Atmosphere Palette — curated pigments for Fit-sheet selective colour.
 * Render-only; never used as chrome accent.
 */

import type { AtmospherePigment } from "@workstream/contracts";
import { atmospherePigmentHex } from "@workstream/domain";

export function atmosphereCssVars(
  pigment: AtmospherePigment,
): Record<string, string> {
  const hex = atmospherePigmentHex(pigment);
  return {
    "--sheet-atmosphere": hex,
    "--sheet-atmosphere-wash": `color-mix(in srgb, ${hex} 28%, transparent)`,
    "--sheet-atmosphere-line": `color-mix(in srgb, ${hex} 72%, var(--sheet-ink))`,
  };
}

/** True when the plan should apply a selective accent wash. */
export function atmosphereHasAccent(pigment: AtmospherePigment): boolean {
  return pigment !== "graphite";
}
