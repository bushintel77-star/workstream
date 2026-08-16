/**
 * Gold Standard 2026 — Canvas Data Bridges.
 *
 * Pure functions that convert persisted canvas data (contract types in board-%
 * space) into the renderer + domain input shapes the WebGL studio consumes
 * (metre-space SubsurfaceUtility[], DesignExcavation[], HydraulicRun[]).
 *
 * These bridges are the wiring layer that replaces the hardcoded sample data
 * in WebGLStudioPreview.tsx with REAL project data from the design canvas.
 *
 * All functions are pure (no side effects) and depend only on:
 *   - @workstream/contracts types (DesignBydaAsset, ConstructionTrench, etc.)
 *   - @workstream/domain algorithms (detectStrikes, calculateHydraulicRuns)
 *   - The coordTransform helpers (pctToWorld)
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (live data wiring)
 */

import type {
  BydaAssetKind,
  ConstructionTrench,
  DesignBydaAsset,
  DesignSiteFrameLevel,
  IrrigationZone,
} from "@workstream/contracts";
import {
  detectStrikes,
  calculateHydraulicRuns,
  type DesignExcavation,
  type HydraulicResult,
  type HydraulicRun,
  type StrikeAlert,
  type UtilityLine,
  type UtilityType,
} from "@workstream/domain";
import { pctToWorld, type HeightmapPoint } from "./coordTransform";
import type { SubsurfaceUtility, StrikeAlertData } from "./features/SubsurfaceEngine";

/* -------------------------------------------------------------------------- */
/* BYDA → SubsurfaceUtility bridge                                            */
/* -------------------------------------------------------------------------- */

/**
 * Map BYDA asset kinds to the domain UtilityType enum.
 * The two enums have different vocabularies — this is the translation table.
 */
const BYDA_KIND_TO_UTILITY_TYPE: Record<BydaAssetKind, UtilityType> = {
  sewer: "sewer",
  stormwater: "reclaimed", // stormwater is reclaimed water infrastructure
  water: "water",
  gas: "gas",
  power: "electric",
  nbn: "comms",
  other: "comms",
};

/**
 * Convert BYDA assets from the canvas (board-% ring polylines) to the renderer's
 * SubsurfaceUtility[] (metre-space line segments with depth + tolerance).
 *
 * Each BYDA asset is a ring of ≥2 points. For a 2-point ring (a line), we use
 * those points directly. For longer rings, we use the first and last points as
 * the start/end of the segment (the renderer draws straight conduit lines).
 *
 * @param assets      BYDA assets from canvas.site_frame.byda_assets
 * @param scaleM      Lot scale in metres
 * @param boardAspect Board aspect (height / width)
 */
export function bydaAssetsToSubsurfaceUtilities(
  assets: DesignBydaAsset[],
  scaleM: number,
  boardAspect: number,
): SubsurfaceUtility[] {
  return assets.flatMap((asset) => {
    if (asset.depth_m == null || asset.tolerance_m == null) return [];
    const ring = asset.ring;
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    const startWorld = pctToWorld(
      { x: first.x_pct, y: first.y_pct },
      scaleM,
      boardAspect,
    );
    const endWorld = pctToWorld(
      { x: last.x_pct, y: last.y_pct },
      scaleM,
      boardAspect,
    );
    return {
      id: asset.id,
      type: BYDA_KIND_TO_UTILITY_TYPE[asset.kind] ?? "comms",
      start: startWorld,
      end: endWorld,
      depthM: asset.depth_m,
      toleranceM: asset.tolerance_m,
      depthSource:
        asset.source === "assumed"
          ? ("assumed" as const)
          : ("measured" as const),
      source: asset.source,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Construction Trenches → DesignExcavation + detectStrikes bridge            */
/* -------------------------------------------------------------------------- */

/**
 * Default trench width (metres) by kind — used when the trench doesn't carry
 * an explicit width (the ConstructionTrench schema has no width field).
 */
const TRENCH_WIDTH_M: Record<ConstructionTrench["kind"], number> = {
  irrig_main: 0.3,
  irrig_lateral: 0.2,
  lighting_conduit: 0.15,
  drainage: 0.4,
};

/**
 * Convert construction trenches from the canvas (board-% polylines) to the
 * domain's DesignExcavation[] (metre-space paths with depth + width).
 *
 * Ghost trenches are excluded — they are AI proposals, not committed geometry.
 */
export function trenchesToExcavations(
  trenches: ConstructionTrench[],
  scaleM: number,
  boardAspect: number,
): DesignExcavation[] {
  return trenches
    .filter((t) => !t.ghost && t.depth_mm != null)
    .map((t) => ({
      id: t.id,
      path: t.points.map((p) =>
        pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect),
      ),
      depthM: t.depth_mm! / 1000,
      widthM: TRENCH_WIDTH_M[t.kind] ?? 0.3,
    }));
}

/**
 * Detect strike alerts between committed trenches and subsurface utilities.
 * Wraps the domain detectStrikes() and maps the results to the renderer's
 * StrikeAlertData[] shape.
 */
export function computeStrikeAlerts(
  excavations: DesignExcavation[],
  utilities: SubsurfaceUtility[],
): StrikeAlertData[] {
  // SubsurfaceUtility and the domain UtilityLine are structurally identical
  // (same fields, same types). Cast once so the compiler validates the shape
  // — if either type drifts, this becomes a compile error rather than a
  // silent field drop.
  const utilityLines = utilities as unknown as UtilityLine[];

  const alerts: StrikeAlert[] = detectStrikes(excavations, utilityLines);

  // Map domain StrikeAlert → renderer StrikeAlertData (drops the join IDs and
  // distanceM the renderer doesn't consume). Explicit return type above keeps
  // the mapping honest.
  return alerts.map((a: StrikeAlert) => ({
    id: a.id,
    utilityType: a.utilityType,
    point: a.point,
    severity: a.severity,
  }));
}

/* -------------------------------------------------------------------------- */
/* Irrigation Zones → HydraulicRun bridge                                     */
/* -------------------------------------------------------------------------- */

/**
 * Derive the total run length (metres) from an irrigation zone's point polyline.
 */
function zoneLengthM(
  zone: IrrigationZone,
  scaleM: number,
  boardAspect: number,
): number {
  const pts = zone.points;
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x1, z1] = pctToWorld(
      { x: pts[i - 1]!.x_pct, y: pts[i - 1]!.y_pct },
      scaleM,
      boardAspect,
    );
    const [x2, z2] = pctToWorld(
      { x: pts[i]!.x_pct, y: pts[i]!.y_pct },
      scaleM,
      boardAspect,
    );
    total += Math.hypot(x2 - x1, z2 - z1);
  }
  return total;
}

/**
 * Estimate the flow rate (L/s) for an irrigation zone based on emitter count
 * and flow rate. This is an indicative figure for hydraulic screening.
 *
 * emitter_count ≈ zone_length / emitter_spacing
 * flow_lps = emitter_count × emitter_flow_lph / 3600
 */
function estimateZoneFlowLps(zone: IrrigationZone, lengthM: number): number {
  const emitterSpacingM = (zone.emitter_spacing_cm ?? 30) / 100;
  if (emitterSpacingM <= 0) return 0;
  const emitterCount = Math.max(1, Math.round(lengthM / emitterSpacingM));
  const flowLph = zone.emitter_flow_lph ?? 2;
  return (emitterCount * flowLph) / 3600;
}

/**
 * Convert irrigation zones from the canvas to domain HydraulicRun[] and compute
 * the hydraulic results (Hazen-Williams pressure drop, velocity, etc.).
 *
 * Only drip and spray zones are irrigation runs. Lighting/lighting_conduit and
 * agg_drain zones are excluded (they aren't water-flow circuits).
 */
export function computeHydraulics(
  zones: IrrigationZone[],
  scaleM: number,
  boardAspect: number,
) {
  const runs: Array<HydraulicRun & { startIsOrigin?: boolean }> = zones
    .filter(
      (z) =>
        (z.kind === "drip" || z.kind === "spray") &&
        z.pipe_diameter_mm != null &&
        z.hazen_williams_c != null,
    )
    .map((z) => {
      const lengthM = zoneLengthM(z, scaleM, boardAspect);
      return {
        id: z.id,
        flowLps: estimateZoneFlowLps(z, lengthM),
        pipeDiameterMm: z.pipe_diameter_mm!,
        lengthM,
        cFactor: z.hazen_williams_c!,
      };
    });

  return calculateHydraulicRuns(runs);
}

/* -------------------------------------------------------------------------- */
/* Spot levels → terrain heightmap points                                     */
/* -------------------------------------------------------------------------- */

/**
 * Convert site_frame.levels to world-space heightmap sample points for the
 * TerrainMesh IDW interpolation.
 */
export function levelsToHeightmapPoints(
  levels: DesignSiteFrameLevel[],
  scaleM: number,
  boardAspect: number,
): HeightmapPoint[] {
  return levels.map((lv) => {
    const [x, z] = pctToWorld(
      { x: lv.x_pct, y: lv.y_pct },
      scaleM,
      boardAspect,
    );
    return { x, z, y: lv.z_m };
  });
}

/* -------------------------------------------------------------------------- */
/* Combined bridge — all live data in one call                                */
/* -------------------------------------------------------------------------- */

export interface LiveStudioData {
  subsurfaceUtilities: SubsurfaceUtility[];
  strikeAlerts: StrikeAlertData[];
  heightmapPoints: HeightmapPoint[];
  /** Hazen-Williams results per irrigation run (Drainage HUD telemetry). */
  hydraulicResults: HydraulicResult[];
}

/**
 * Compute all derived studio data from the raw canvas fields. This is the
 * single function the page calls to replace the hardcoded sample data.
 */
export function computeLiveStudioData(params: {
  bydaAssets: DesignBydaAsset[];
  trenches: ConstructionTrench[];
  irrigationZones: IrrigationZone[];
  levels: DesignSiteFrameLevel[];
  scaleM: number;
  boardAspect: number;
}): LiveStudioData {
  const { bydaAssets, trenches, irrigationZones, levels, scaleM, boardAspect } =
    params;

  const subsurfaceUtilities = bydaAssetsToSubsurfaceUtilities(
    bydaAssets,
    scaleM,
    boardAspect,
  );
  const excavations = trenchesToExcavations(trenches, scaleM, boardAspect);
  const strikeAlerts = computeStrikeAlerts(excavations, subsurfaceUtilities);
  const heightmapPoints = levelsToHeightmapPoints(levels, scaleM, boardAspect);
  const hydraulicResults = computeHydraulics(irrigationZones, scaleM, boardAspect);

  return { subsurfaceUtilities, strikeAlerts, heightmapPoints, hydraulicResults };
}
