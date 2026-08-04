import type { SiteSchedule } from "./types";

/** Footprint coverage over this fraction of lot is treated as corrupt geometry. */
export const MAX_FOOTPRINT_COVERAGE_FRAC = 0.8;

/**
 * Largest ratio between the cadastral lot area and the drawn shoelace at which
 * the two are still considered to describe the same polygon. Beyond this, the
 * Vicmap figure is a different parcel (whole-farm parent, neighbour, or stale
 * ring) than what the boundary labels measure, and the display follows the
 * drawing — a landscape architect stakes liability on the polygon actually
 * drawn, and the quote is driven by its area. Observed in the wild: a rural
 * lot whose edges bound ~1.1M m^2 while the Vicmap label read 10.3M m^2
 * (~9.4x) — mathematically impossible for that perimeter, so the label was
 * describing a different polygon.
 *
 * This is a SYMPTOM guard, not a root fix. The root cause is that the title-
 * block route (`/cadastral-title`) and the boundary auto-trace
 * (`/boundary/auto-trace`) make independent Vicmap WFS calls with potentially
 * different pins: the title-block geocodes `displayAddress` (which may differ
 * from `project.address`), while the boundary auto-trace uses
 * `project.lat/lng`. For rural parcels exceeding `MAX_SANE_TITLE_AREA_M2`
 * (80 000 m²), `pickTitleRingForPin` falls through to `containingAny` and
 * different pins can land in different rings of a Vicmap MultiPolygon — a
 * subset lot vs a parent/aggregate parcel. The proper fix is to join the two
 * calls via a shared ring identifier (PFI) or ring-geometry comparison at the
 * API level; until then, this guard + the `lotDisagreement` provenance flag
 * surface the mismatch so the architect decides whether they traced the wrong
 * parcel or the title covers multiple lots.
 */
export const LOT_AGREEMENT_FACTOR = 2;

/**
 * Provenance flag for when the title-block lot area and the drawn shoelace
 * disagree. Surfaces both numbers so the architect can reconcile — same
 * discipline as "Vicmap footprint" vs "operator-traced envelope".
 */
export type LotDisagreement = {
  /** Title-block / Vicmap lot area (m²), or null when no cadastral fetch. */
  cadastralLotM2: number | null;
  /** Shoelace area of the drawn boundary ring (m²). */
  drawnLotM2: number;
  /** True when the two differ by more than {@link LOT_AGREEMENT_FACTOR}. */
  mismatch: boolean;
};

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
  /** Title vs drawn lot-area provenance — null when no cadastral figure was supplied. */
  lotDisagreement: LotDisagreement | null;
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
  // The cadastral figure must describe the SAME polygon as the drawn ring.
  // When the drawn shoelace is positive and the title area is more than
  // LOT_AGREEMENT_FACTOR times it, the title is a different (larger) polygon
  // than the boundary labels measure — a Vicmap whole-parcel/parent figure
  // while the drawn ring is a subset — so keep the drawing. The smaller-title
  // direction is already guarded by the building-coverage check below (a title
  // too small for the dwelling loses), so this is intentionally asymmetric.
  const areaConsistent =
    args.drawnLotM2 > 5 &&
    cadastral / args.drawnLotM2 <= LOT_AGREEMENT_FACTOR;
  if ((buildingOk || houseOk) && areaConsistent) {
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
  const drawnLotM2 = args.schedule.lotAreaM2;
  const cadastralLotM2 =
    args.cadastralLotM2 != null && args.cadastralLotM2 > 5
      ? args.cadastralLotM2
      : null;
  const lotResolved = resolveDisplayLotM2({
    cadastralLotM2: args.cadastralLotM2,
    buildingAreaM2: drawnBuilding,
    drawnLotM2,
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
    drawnLotM2 > 0
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

  // Provenance: surface title-vs-drawn disagreement so the architect decides
  // whether they traced the wrong parcel or the title covers multiple lots.
  const lotDisagreement: LotDisagreement | null =
    cadastralLotM2 != null && drawnLotM2 > 5
      ? {
        cadastralLotM2,
        drawnLotM2,
        mismatch: cadastralLotM2 / drawnLotM2 > LOT_AGREEMENT_FACTOR,
      }
      : null;

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
    lotDisagreement,
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
