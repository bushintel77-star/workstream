import type { StudioMode } from "../studioCatalog";

/** CAD + Sketch are parchment drafting plates — never satellite aerial by default. */
export function isDraftingPlate(mode: StudioMode): boolean {
  return mode === "cad" || mode === "sketch";
}

/**
 * Resolve the underlay URI AerialSlot may paint.
 * Survey: optional aerial. CAD/Sketch: optional user-dropped survey plan
 * (SVG/PNG) when allowPlanUnderlay — still parchment-first, no map required.
 */
export function resolveLiveAerial(opts: {
  mode: StudioMode;
  foundationCleanse: boolean;
  aerialSuppressed: boolean;
  aerialUri: string | null;
  /** When true, CAD/Sketch may show a user-dropped plan underlay. */
  allowPlanUnderlay?: boolean;
}): string | null {
  if (opts.foundationCleanse || opts.aerialSuppressed) {
    return null;
  }
  if (isDraftingPlate(opts.mode)) {
    return opts.allowPlanUnderlay ? opts.aerialUri : null;
  }
  return opts.aerialUri;
}

/** Satellite aerial drop allowed only on Survey (and never Stage 1). */
export function allowAerialUnderlay(opts: {
  mode: StudioMode;
  foundationCleanse: boolean;
}): boolean {
  return opts.mode === "survey" && !opts.foundationCleanse;
}
