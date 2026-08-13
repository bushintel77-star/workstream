/**
 * Subsurface Studio — data layer.
 *
 * Bridges the real design canvas (construction trenches, irrigation zones,
 * BYDA utility assets, title easements) into the 3D subsurface view. Every
 * conduit run, flow figure, and voltage-drop reading here comes from the
 * same domain math the 2D board already ships — `summarizeIrrigationZones`,
 * `assessLvRuns`, and the `pathsCross` dig-conflict test used by board
 * findings. No invented pressures, no invented strike risk.
 */

import type {
  CatalogPlacement,
  ConstructionTrench,
  ConstructionTrenchKind,
  DesignBydaAsset,
  DesignSiteFramePoint,
  IrrigationZone,
} from "@workstream/contracts";
import {
  CURTIS_CATALOG_SYMBOLS,
  assessLvRuns,
  pathsCross,
  summarizeIrrigationZones,
  type CanvasGroundScale,
  type LvRunsAssessment,
} from "@workstream/domain";

export type SubsurfaceTrenchInstance = {
  id: string;
  kind: ConstructionTrenchKind;
  points: Array<{ xPct: number; yPct: number }>;
  depthM: number;
  /** Crosses a located BYDA utility or a title easement — real geometry test. */
  conflict: boolean;
};

export type SubsurfaceCriticalZone = {
  id: string;
  /** BYDA utility kind, or "easement" for a title easement corridor. */
  kind: DesignBydaAsset["kind"] | "easement";
  label: string;
  points: Array<{ xPct: number; yPct: number }>;
};

export type SubsurfaceScene = {
  trenches: SubsurfaceTrenchInstance[];
  criticalZones: SubsurfaceCriticalZone[];
  irrigation: ReturnType<typeof summarizeIrrigationZones>;
  lighting: LvRunsAssessment;
};

const SYMBOL_BY_ID = new Map(CURTIS_CATALOG_SYMBOLS.map((s) => [s.id, s]));

/** Fallback board width (m) when the site frame has no calibrated scale yet. */
export const DEFAULT_BOARD_WIDTH_M = 20;

function toGroundScale(boardWidthM: number): CanvasGroundScale {
  // Treat the 0-100 percent canvas as a 100x100 "pixel" grid so 1 "px" of
  // scale = 1% of the board — metresPerXPx then converts % -> real metres.
  const metresPerPx = boardWidthM / 100;
  return {
    metresPerXPx: metresPerPx,
    metresPerYPx: metresPerPx,
    canvasWidthPx: 100,
    canvasHeightPx: 100,
  };
}

function toBoardPoints(
  points: ReadonlyArray<{ xPct: number; yPct: number }>,
): Array<{ x: number; y: number }> {
  return points.map((p) => ({ x: p.xPct, y: p.yPct }));
}

const BYDA_LABEL: Record<DesignBydaAsset["kind"], string> = {
  sewer: "Sewer",
  stormwater: "Stormwater",
  water: "Water main",
  gas: "Gas",
  power: "Power",
  nbn: "NBN",
  other: "Utility",
};

export function buildSubsurfaceScene(input: {
  trenches: readonly ConstructionTrench[] | null | undefined;
  irrigationZones: readonly IrrigationZone[] | null | undefined;
  bydaAssets: readonly DesignBydaAsset[] | null | undefined;
  easements: ReadonlyArray<readonly DesignSiteFramePoint[]> | null | undefined;
  placements: readonly CatalogPlacement[] | null | undefined;
  boardWidthM: number;
}): SubsurfaceScene {
  const scale = toGroundScale(input.boardWidthM);

  const criticalZones: SubsurfaceCriticalZone[] = [
    ...(input.bydaAssets ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      label: `${BYDA_LABEL[a.kind]} (BYDA)`,
      points: a.ring.map((p) => ({ xPct: p.x_pct, yPct: p.y_pct })),
    })),
    ...(input.easements ?? []).map((ring, i) => ({
      id: `easement-${i}`,
      kind: "easement" as const,
      label: "Legal easement",
      points: ring.map((p) => ({ xPct: p.x_pct, yPct: p.y_pct })),
    })),
  ];

  const criticalBoardPaths = criticalZones.map((z) => toBoardPoints(z.points));

  const trenches: SubsurfaceTrenchInstance[] = (input.trenches ?? []).map((t) => {
    const trenchPoints = t.points.map((p) => ({ xPct: p.x_pct, yPct: p.y_pct }));
    const trenchPath = toBoardPoints(trenchPoints);
    const conflict = criticalBoardPaths.some((zonePath) =>
      pathsCross(trenchPath, zonePath),
    );
    return {
      id: t.id,
      kind: t.kind,
      points: trenchPoints,
      depthM: t.depth_mm / 1000,
      conflict,
    };
  });

  const irrigationSourceZones = (input.irrigationZones ?? []).filter(
    (z) => z.kind === "drip" || z.kind === "spray" || z.kind === "agg_drain",
  );
  const irrigation = summarizeIrrigationZones(
    irrigationSourceZones as IrrigationZone[],
    scale,
  );

  const lightingZones = (input.irrigationZones ?? [])
    .filter((z) => z.kind === "lighting" || z.kind === "lighting_conduit")
    .map((z) => ({
      id: z.id,
      kind: z.kind as "lighting" | "lighting_conduit",
      points: z.points.map((p) => ({ x: p.x_pct, y: p.y_pct })),
      wire_gauge: z.wire_gauge,
      transformer_va: z.transformer_va,
    }));
  const lightingFixtures = (input.placements ?? [])
    .filter((p) => SYMBOL_BY_ID.get(p.symbol_id)?.category === "lighting")
    .map((p) => ({
      id: p.id,
      symbolId: p.symbol_id,
      x: p.x_pct,
      y: p.y_pct,
      rot: p.rotation_deg,
    }));
  const lighting = assessLvRuns({
    zones: lightingZones,
    fixtures: lightingFixtures,
    boardWidthM: input.boardWidthM,
  });

  return { trenches, criticalZones, irrigation, lighting };
}
