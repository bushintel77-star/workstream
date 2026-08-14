import { describe, expect, it } from "vitest";
import type {
  ConstructionTrench,
  DesignBydaAsset,
  DesignSiteFrameLevel,
  IrrigationZone,
} from "@workstream/contracts";
import {
  bydaAssetsToSubsurfaceUtilities,
  trenchesToExcavations,
  computeStrikeAlerts,
  computeHydraulics,
  levelsToHeightmapPoints,
  computeLiveStudioData,
} from "./canvasBridges";

/* -------------------------------------------------------------------------- */
/* Test fixtures                                                               */
/* -------------------------------------------------------------------------- */

const SCALE_M = 100;
const BOARD_ASPECT = 1;

function makeBydaAsset(
  kind: DesignBydaAsset["kind"],
  ring: Array<{ x_pct: number; y_pct: number }>,
  id?: string,
): DesignBydaAsset {
  return {
    id: id ?? `byda-${kind}`,
    kind,
    ring: ring.map((p) => ({ x_pct: p.x_pct, y_pct: p.y_pct })),
    source: "traced",
  };
}

function makeTrench(
  points: Array<{ x_pct: number; y_pct: number }>,
  opts: Partial<ConstructionTrench> = {},
): ConstructionTrench {
  return {
    id: opts.id ?? "trench-1",
    name: opts.name ?? "Test Trench",
    kind: opts.kind ?? "irrig_main",
    points: points.map((p) => ({ x_pct: p.x_pct, y_pct: p.y_pct })),
    depth_mm: opts.depth_mm ?? 300,
    source: opts.source ?? "auto",
    ...(opts.ghost !== undefined ? { ghost: opts.ghost } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* BYDA → SubsurfaceUtility                                                   */
/* -------------------------------------------------------------------------- */

describe("bydaAssetsToSubsurfaceUtilities", () => {
  it("converts a BYDA gas asset to a subsurface utility", () => {
    const assets = [
      makeBydaAsset("gas", [
        { x_pct: 10, y_pct: 10 },
        { x_pct: 90, y_pct: 90 },
      ]),
    ];
    const result = bydaAssetsToSubsurfaceUtilities(assets, SCALE_M, BOARD_ASPECT);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("byda-gas");
    expect(result[0]!.type).toBe("gas");
    expect(result[0]!.depthM).toBe(0.45);
    expect(result[0]!.toleranceM).toBe(0.2);
  });

  it("maps all BYDA kinds to the correct UtilityType", () => {
    const kinds: DesignBydaAsset["kind"][] = [
      "sewer",
      "stormwater",
      "water",
      "gas",
      "power",
      "nbn",
      "other",
    ];
    const assets = kinds.map((k) =>
      makeBydaAsset(
        k,
        [
          { x_pct: 0, y_pct: 0 },
          { x_pct: 50, y_pct: 50 },
        ],
        `byda-${k}`,
      ),
    );
    const result = bydaAssetsToSubsurfaceUtilities(assets, SCALE_M, BOARD_ASPECT);
    const types = result.map((r) => r.type);
    expect(types).toEqual([
      "sewer",
      "reclaimed",
      "water",
      "gas",
      "electric",
      "comms",
      "comms",
    ]);
  });

  it("returns an empty array for no assets", () => {
    expect(bydaAssetsToSubsurfaceUtilities([], SCALE_M, BOARD_ASPECT)).toEqual([]);
  });

  it("converts board-% coordinates to metre-space", () => {
    const assets = [
      makeBydaAsset("water", [
        { x_pct: 0, y_pct: 0 },
        { x_pct: 100, y_pct: 100 },
      ]),
    ];
    const result = bydaAssetsToSubsurfaceUtilities(assets, 100, 1);
    // At scaleM=100, boardAspect=1: (0,0) → (-50,-50), (100,100) → (50,50)
    expect(result[0]!.start[0]).toBeCloseTo(-50);
    expect(result[0]!.start[1]).toBeCloseTo(-50);
    expect(result[0]!.end[0]).toBeCloseTo(50);
    expect(result[0]!.end[1]).toBeCloseTo(50);
  });
});

/* -------------------------------------------------------------------------- */
/* Construction Trenches → DesignExcavation                                   */
/* -------------------------------------------------------------------------- */

describe("trenchesToExcavations", () => {
  it("converts a trench to an excavation with correct depth", () => {
    const trenches = [
      makeTrench(
        [
          { x_pct: 10, y_pct: 10 },
          { x_pct: 90, y_pct: 90 },
        ],
        { depth_mm: 450 },
      ),
    ];
    const result = trenchesToExcavations(trenches, SCALE_M, BOARD_ASPECT);
    expect(result).toHaveLength(1);
    expect(result[0]!.depthM).toBe(0.45);
    expect(result[0]!.path).toHaveLength(2);
  });

  it("excludes ghost trenches (AI proposals)", () => {
    const trenches = [
      makeTrench([{ x_pct: 10, y_pct: 10 }, { x_pct: 90, y_pct: 90 }]),
      makeTrench(
        [{ x_pct: 20, y_pct: 20 }, { x_pct: 80, y_pct: 80 }],
        { id: "ghost-trench", ghost: true },
      ),
    ];
    const result = trenchesToExcavations(trenches, SCALE_M, BOARD_ASPECT);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("trench-1");
  });

  it("assigns width by trench kind", () => {
    const kinds: ConstructionTrench["kind"][] = [
      "irrig_main",
      "irrig_lateral",
      "lighting_conduit",
      "drainage",
    ];
    const trenches = kinds.map((k, i) =>
      makeTrench(
        [{ x_pct: 0, y_pct: 0 }, { x_pct: 50, y_pct: 50 }],
        { id: `trench-${i}`, kind: k },
      ),
    );
    const result = trenchesToExcavations(trenches, SCALE_M, BOARD_ASPECT);
    const widths = result.map((r) => r.widthM);
    expect(widths).toEqual([0.3, 0.2, 0.15, 0.4]);
  });
});

/* -------------------------------------------------------------------------- */
/* Strike Alerts                                                               */
/* -------------------------------------------------------------------------- */

describe("computeStrikeAlerts", () => {
  it("detects a direct strike when a trench crosses a utility at the same depth", () => {
    // A utility and a trench that cross at the centre, both at ~0.3m depth.
    const utilities = bydaAssetsToSubsurfaceUtilities(
      [makeBydaAsset("gas", [{ x_pct: 0, y_pct: 50 }, { x_pct: 100, y_pct: 50 }])],
      SCALE_M,
      BOARD_ASPECT,
    );
    // Override the depth to ensure overlap.
    utilities[0]!.depthM = 0.3;
    utilities[0]!.toleranceM = 0.3;

    const excavations = trenchesToExcavations(
      [makeTrench([{ x_pct: 50, y_pct: 0 }, { x_pct: 50, y_pct: 100 }], { depth_mm: 400 })],
      SCALE_M,
      BOARD_ASPECT,
    );

    const alerts = computeStrikeAlerts(excavations, utilities);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]!.utilityType).toBe("gas");
    expect(["direct", "near", "proximity"]).toContain(alerts[0]!.severity);
  });

  it("returns no alerts when there are no excavations", () => {
    const utilities = bydaAssetsToSubsurfaceUtilities(
      [makeBydaAsset("gas", [{ x_pct: 0, y_pct: 0 }, { x_pct: 100, y_pct: 100 }])],
      SCALE_M,
      BOARD_ASPECT,
    );
    expect(computeStrikeAlerts([], utilities)).toEqual([]);
  });

  it("returns no alerts when utilities are empty", () => {
    const excavations = trenchesToExcavations(
      [makeTrench([{ x_pct: 0, y_pct: 0 }, { x_pct: 100, y_pct: 100 }])],
      SCALE_M,
      BOARD_ASPECT,
    );
    expect(computeStrikeAlerts(excavations, [])).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Hydraulics                                                                  */
/* -------------------------------------------------------------------------- */

describe("computeHydraulics", () => {
  it("computes hydraulic results for drip zones", () => {
    const zones: IrrigationZone[] = [
      {
        id: "zone-1",
        name: "Garden Bed",
        kind: "drip",
        points: [
          { x_pct: 10, y_pct: 10 },
          { x_pct: 90, y_pct: 10 },
        ],
        emitter_spacing_cm: 30,
        emitter_flow_lph: 2,
      },
    ];
    const results = computeHydraulics(zones, SCALE_M, BOARD_ASPECT);
    expect(results).toHaveLength(1);
    expect(results[0]!.runId).toBe("zone-1");
    expect(results[0]!.valid).toBe(true);
    expect(results[0]!.pressureDropKpa).toBeGreaterThan(0);
    expect(results[0]!.velocityMs).toBeGreaterThan(0);
  });

  it("excludes non-irrigation zones (lighting, agg_drain)", () => {
    const zones: IrrigationZone[] = [
      {
        id: "zone-light",
        name: "Path Lights",
        kind: "lighting",
        points: [{ x_pct: 0, y_pct: 0 }, { x_pct: 50, y_pct: 0 }],
        emitter_spacing_cm: 30,
        emitter_flow_lph: 2,
      },
      {
        id: "zone-drain",
        name: "Ag Pipe",
        kind: "agg_drain",
        points: [{ x_pct: 0, y_pct: 0 }, { x_pct: 50, y_pct: 0 }],
        emitter_spacing_cm: 30,
        emitter_flow_lph: 2,
      },
    ];
    expect(computeHydraulics(zones, SCALE_M, BOARD_ASPECT)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Heightmap Points                                                            */
/* -------------------------------------------------------------------------- */

describe("levelsToHeightmapPoints", () => {
  it("converts spot levels to world-space heightmap points", () => {
    const levels: DesignSiteFrameLevel[] = [
      { x_pct: 0, y_pct: 0, z_m: 50 },
      { x_pct: 100, y_pct: 100, z_m: 51 },
    ];
    const result = levelsToHeightmapPoints(levels, 100, 1);
    expect(result).toHaveLength(2);
    // (0,0) → (-50, -50), z_m = 50
    expect(result[0]!.x).toBeCloseTo(-50);
    expect(result[0]!.z).toBeCloseTo(-50);
    expect(result[0]!.y).toBe(50);
  });

  it("returns empty for no levels", () => {
    expect(levelsToHeightmapPoints([], SCALE_M, BOARD_ASPECT)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Combined Live Data                                                          */
/* -------------------------------------------------------------------------- */

describe("computeLiveStudioData", () => {
  it("combines all bridge functions into one result", () => {
    const result = computeLiveStudioData({
      bydaAssets: [makeBydaAsset("gas", [{ x_pct: 0, y_pct: 0 }, { x_pct: 100, y_pct: 0 }])],
      trenches: [makeTrench([{ x_pct: 50, y_pct: 0 }, { x_pct: 50, y_pct: 100 }])],
      irrigationZones: [],
      levels: [{ x_pct: 50, y_pct: 50, z_m: 50 }],
      scaleM: SCALE_M,
      boardAspect: BOARD_ASPECT,
    });

    expect(result.subsurfaceUtilities).toHaveLength(1);
    expect(result.subsurfaceUtilities[0]!.type).toBe("gas");
    // The trench crosses the gas line → should detect a strike.
    expect(result.strikeAlerts.length).toBeGreaterThan(0);
    expect(result.heightmapPoints).toHaveLength(1);
  });

  it("handles empty canvas data gracefully", () => {
    const result = computeLiveStudioData({
      bydaAssets: [],
      trenches: [],
      irrigationZones: [],
      levels: [],
      scaleM: SCALE_M,
      boardAspect: BOARD_ASPECT,
    });
    expect(result.subsurfaceUtilities).toEqual([]);
    expect(result.strikeAlerts).toEqual([]);
    expect(result.heightmapPoints).toEqual([]);
  });
});
