import type { SiteSchedule } from "./types";

export type FitSheetAreaDisplay = {
  lotAreaM2: number;
  buildingAreaM2: number;
  outdoorAreaM2: number;
  outdoorNaiveM2: number;
  outdoorDiffersFromNaive: boolean;
  siteCoveragePct: number;
  /** Lot may come from Vicmap; footprint always from the drawn building. */
  lotSource: "cadastral" | "drawing";
};

export type DisplayLotResolution = {
  lotM2: number;
  lotSource: "cadastral" | "drawing";
};

/**
 * Single policy for which lot ("Title") area any surface may display.
 * Cadastral (Vicmap) wins only when it is coherent with the drawn plan —
 * a cadastral lot smaller than the drawn building means the drawing scale
 * and the parcel figure disagree, and showing the cadastral number next to
 * drawing-derived numbers (measures panel, on-plan callouts) produces
 * contradictory UI (e.g. "Title 185 m²" on-plan vs "Title 3013 m²" in
 * Site measures). Every Title figure must route through this resolver.
 */
export function resolveDisplayLotM2(args: {
  cadastralLotM2?: number | null;
  buildingAreaM2: number;
  drawnLotM2: number;
}): DisplayLotResolution {
  const cadastral =
    args.cadastralLotM2 != null &&
    args.cadastralLotM2 > 5 &&
    // Ignore Vicmap lot when it conflicts with drawn scale (building would exceed lot)
    args.cadastralLotM2 + 0.5 >= args.buildingAreaM2
      ? args.cadastralLotM2
      : null;
  if (cadastral != null) return { lotM2: cadastral, lotSource: "cadastral" };
  return { lotM2: args.drawnLotM2, lotSource: "drawing" };
}

/**
 * Site schedule numbers for the Fit sheet panel.
 * Building footprint always tracks the drawn polygon.
 * Outdoor prefers Turf boolean difference (schedule.outdoorAreaM2).
 * When a cadastral lot overrides the drawn lot, outdoor = cadastral − building
 * (naive) unless the schedule already subtracted extras at drawing scale.
 */
export function resolveFitSheetAreas(args: {
  schedule: SiteSchedule;
  cadastralLotM2?: number | null;
}): FitSheetAreaDisplay {
  const buildingAreaM2 = args.schedule.buildingAreaM2;
  const resolved = resolveDisplayLotM2({
    cadastralLotM2: args.cadastralLotM2,
    buildingAreaM2,
    drawnLotM2: args.schedule.lotAreaM2,
  });
  const cadastral = resolved.lotSource === "cadastral" ? resolved.lotM2 : null;

  if (cadastral != null) {
    const outdoorAreaM2 = Math.max(0, cadastral - buildingAreaM2);
    const siteCoveragePct =
      cadastral > 0 ? Math.round((buildingAreaM2 / cadastral) * 100) : 0;
    return {
      lotAreaM2: cadastral,
      buildingAreaM2,
      outdoorAreaM2,
      outdoorNaiveM2: outdoorAreaM2,
      outdoorDiffersFromNaive: false,
      siteCoveragePct,
      lotSource: "cadastral",
    };
  }

  // Drawing-scale schedule — keep boolean outdoor (lot − building − excludes).
  return {
    lotAreaM2: args.schedule.lotAreaM2,
    buildingAreaM2,
    outdoorAreaM2: args.schedule.outdoorAreaM2,
    outdoorNaiveM2: args.schedule.outdoorNaiveM2,
    outdoorDiffersFromNaive: args.schedule.outdoorDiffersFromNaive,
    siteCoveragePct: args.schedule.siteCoveragePct,
    lotSource: "drawing",
  };
}
