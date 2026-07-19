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
  const cadastral =
    args.cadastralLotM2 != null &&
    args.cadastralLotM2 > 5 &&
    // Ignore Vicmap lot when it conflicts with drawn scale (building would exceed lot)
    args.cadastralLotM2 + 0.5 >= buildingAreaM2
      ? args.cadastralLotM2
      : null;

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
