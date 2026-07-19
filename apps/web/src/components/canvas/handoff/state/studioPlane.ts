import type { StudioMode } from "../studioCatalog";

/** CAD + Sketch are parchment drafting plates — never aerial maps. */
export function isDraftingPlate(mode: StudioMode): boolean {
  return mode === "cad" || mode === "sketch";
}

/**
 * Resolve the single aerial URI that AerialSlot may paint.
 * Survey may show an optional user upload; CAD/Sketch/Stage 1 never do.
 */
export function resolveLiveAerial(opts: {
  mode: StudioMode;
  foundationCleanse: boolean;
  aerialSuppressed: boolean;
  aerialUri: string | null;
}): string | null {
  if (
    opts.foundationCleanse ||
    isDraftingPlate(opts.mode) ||
    opts.aerialSuppressed
  ) {
    return null;
  }
  return opts.aerialUri;
}

/** Aerial drop / underlay allowed only on Survey (and never Stage 1). */
export function allowAerialUnderlay(opts: {
  mode: StudioMode;
  foundationCleanse: boolean;
}): boolean {
  return opts.mode === "survey" && !opts.foundationCleanse;
}
