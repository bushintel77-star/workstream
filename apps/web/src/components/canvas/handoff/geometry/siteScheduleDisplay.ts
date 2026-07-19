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
 * Outdoor is deterministic: lot − building footprint.
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
  const outdoorAreaM2 = Math.max(0, lotAreaM2 - buildingAreaM2);
  const siteCoveragePct =
    lotAreaM2 > 0 ? Math.round((buildingAreaM2 / lotAreaM2) * 100) : 0;
  return {
    lotAreaM2,
    buildingAreaM2,
    outdoorAreaM2,
    outdoorNaiveM2: outdoorAreaM2,
    outdoorDiffersFromNaive: false,
    siteCoveragePct,
    lotSource: cadastral != null ? "cadastral" : "drawing",
  };
}
