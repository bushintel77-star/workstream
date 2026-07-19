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
 * Outdoor uses Turf boolean difference from {@link SiteSchedule} (not
 * naive lot − building). When a cadastral lot overrides the drawn lot
 * area, outdoor stays the boolean garden from the drawing — cadastral
 * is only applied to the lot figure / coverage denominator.
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
  const lotAreaM2 = cadastral ?? args.schedule.lotAreaM2;
  const outdoorAreaM2 = args.schedule.outdoorAreaM2;
  const outdoorNaiveM2 = args.schedule.outdoorNaiveM2;
  const outdoorDiffersFromNaive = args.schedule.outdoorDiffersFromNaive;
  const siteCoveragePct =
    lotAreaM2 > 0 ? Math.round((buildingAreaM2 / lotAreaM2) * 100) : 0;
  return {
    lotAreaM2,
    buildingAreaM2,
    outdoorAreaM2,
    outdoorNaiveM2,
    outdoorDiffersFromNaive,
    siteCoveragePct,
    lotSource: cadastral != null ? "cadastral" : "drawing",
  };
}
