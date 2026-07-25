import type { SiteSchedule } from "./types";

/** Footprint coverage over this fraction of lot is treated as corrupt geometry. */
export const MAX_FOOTPRINT_COVERAGE_FRAC = 0.8;

export type FitSheetAreaDisplay = {
  lotAreaM2: number;
  buildingAreaM2: number;
  outdoorAreaM2: number;
  outdoorNaiveM2: number;
  outdoorDiffersFromNaive: boolean;
  /** Footprint coverage — always clamped to ≤100%. */
  siteCoveragePct: number;
  /** Lot may come from Vicmap; footprint prefers drawn, falls back when absurd. */
  lotSource: "cadastral" | "drawing";
  buildingSource: "drawing" | "cadastral" | "clamped";
  /** True when drawn dwelling m² was rejected as impossible vs lot. */
  buildingSanitized: boolean;
};

export type DisplayLotResolution = {
  lotM2: number;
  lotSource: "cadastral" | "drawing";
};

/**
 * Shared schedule area formatting — same precision on Fit Sheet, Measures,
 * and Sketch Concept cards so Outdoor/Lot never drift by rounding alone.
 */
export function formatScheduleAreaM2(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  return n.toFixed(2);
}

/**
 * Single policy for which lot ("Title") area any surface may display.
 *
 * Cadastral wins when the drawn dwelling is a plausible footprint on that
 * parcel, OR when a cadastral house area can replace an absurd dwelling ring.
 * Otherwise keep the drawn lot so a tiny Vicmap figure cannot override a
 * coherent plan (classic 185 m² title vs ~3000 m² drawing mismatch).
 */
export function resolveDisplayLotM2(args: {
  cadastralLotM2?: number | null;
  buildingAreaM2: number;
  drawnLotM2: number;
  /** Optional Vicmap/survey house — unlocks cadastral lot when dwelling ring is absurd. */
  cadastralHouseM2?: number | null;
}): DisplayLotResolution {
  const cadastral =
    args.cadastralLotM2 != null && args.cadastralLotM2 > 5
      ? args.cadastralLotM2
      : null;
  if (cadastral == null) {
    return { lotM2: args.drawnLotM2, lotSource: "drawing" };
  }
  const cap = cadastral * MAX_FOOTPRINT_COVERAGE_FRAC;
  const buildingOk = args.buildingAreaM2 <= cap + 0.5;
  const houseOk =
    args.cadastralHouseM2 != null &&
    args.cadastralHouseM2 > 5 &&
    args.cadastralHouseM2 <= cap + 0.5;
  if (buildingOk || houseOk) {
    return { lotM2: cadastral, lotSource: "cadastral" };
  }
  return { lotM2: args.drawnLotM2, lotSource: "drawing" };
}

function footprintCapM2(lotM2: number): number {
  return Math.max(0, lotM2 * MAX_FOOTPRINT_COVERAGE_FRAC);
}

/**
 * Resolve dwelling footprint for display.
 * Drawn ring wins when it is a plausible fraction of the lot; otherwise prefer
 * Vicmap/survey house area; else clamp so coverage can never print >100%.
 */
export function resolveBuildingAreaM2(args: {
  drawnBuildingM2: number;
  lotM2: number;
  cadastralHouseM2?: number | null;
}): {
  buildingAreaM2: number;
  buildingSource: FitSheetAreaDisplay["buildingSource"];
  buildingSanitized: boolean;
} {
  const cap = footprintCapM2(args.lotM2);
  const drawn = args.drawnBuildingM2;
  if (args.lotM2 <= 0) {
    return {
      buildingAreaM2: Math.max(0, drawn),
      buildingSource: "drawing",
      buildingSanitized: false,
    };
  }
  if (drawn > 0 && drawn <= cap + 0.5) {
    return {
      buildingAreaM2: drawn,
      buildingSource: "drawing",
      buildingSanitized: false,
    };
  }
  const house =
    args.cadastralHouseM2 != null &&
    args.cadastralHouseM2 > 5 &&
    args.cadastralHouseM2 <= cap + 0.5
      ? args.cadastralHouseM2
      : null;
  if (house != null) {
    return {
      buildingAreaM2: house,
      buildingSource: "cadastral",
      buildingSanitized: true,
    };
  }
  if (drawn > cap + 0.5) {
    return {
      buildingAreaM2: cap,
      buildingSource: "clamped",
      buildingSanitized: true,
    };
  }
  return {
    buildingAreaM2: Math.max(0, drawn),
    buildingSource: "drawing",
    buildingSanitized: false,
  };
}

/**
 * Canonical site schedule numbers for Fit Sheet, Live Measures, and on-plan chips.
 * Lot + dwelling + outdoor + coverage share one policy so modes cannot drift.
 */
export function resolveSiteAreaDisplay(args: {
  schedule: SiteSchedule;
  cadastralLotM2?: number | null;
  cadastralHouseM2?: number | null;
}): FitSheetAreaDisplay {
  const drawnBuilding = args.schedule.buildingAreaM2;
  const lotResolved = resolveDisplayLotM2({
    cadastralLotM2: args.cadastralLotM2,
    buildingAreaM2: drawnBuilding,
    drawnLotM2: args.schedule.lotAreaM2,
    cadastralHouseM2: args.cadastralHouseM2,
  });
  const lotAreaM2 = lotResolved.lotM2;
  const building = resolveBuildingAreaM2({
    drawnBuildingM2: drawnBuilding,
    lotM2: lotAreaM2,
    cadastralHouseM2: args.cadastralHouseM2,
  });

  const outdoorNaiveM2 = Math.max(0, lotAreaM2 - building.buildingAreaM2);
  let outdoorAreaM2 = outdoorNaiveM2;
  let outdoorDiffersFromNaive = false;

  if (
    !building.buildingSanitized &&
    lotResolved.lotSource === "drawing"
  ) {
    // Keep Turf boolean outdoor (lot − building − excludes) at drawing scale.
    outdoorAreaM2 = args.schedule.outdoorAreaM2;
    outdoorDiffersFromNaive = args.schedule.outdoorDiffersFromNaive;
  } else if (
    building.buildingSanitized &&
    lotResolved.lotSource === "drawing" &&
    args.schedule.lotAreaM2 > 0
  ) {
    // Drawn lot kept, but dwelling was clamped — outdoor must follow the
    // sanitized footprint so coverage never implies negative outdoor.
    outdoorAreaM2 = outdoorNaiveM2;
    outdoorDiffersFromNaive = false;
  }

  const siteCoveragePct =
    lotAreaM2 > 0
      ? Math.min(
          100,
          Math.round((building.buildingAreaM2 / lotAreaM2) * 100),
        )
      : 0;

  return {
    lotAreaM2,
    buildingAreaM2: building.buildingAreaM2,
    outdoorAreaM2,
    outdoorNaiveM2,
    outdoorDiffersFromNaive,
    siteCoveragePct,
    lotSource: lotResolved.lotSource,
    buildingSource: building.buildingSource,
    buildingSanitized: building.buildingSanitized,
  };
}

/**
 * @deprecated Prefer {@link resolveSiteAreaDisplay} — kept as a thin alias.
 */
export function resolveFitSheetAreas(args: {
  schedule: SiteSchedule;
  cadastralLotM2?: number | null;
  cadastralHouseM2?: number | null;
}): FitSheetAreaDisplay {
  return resolveSiteAreaDisplay(args);
}
