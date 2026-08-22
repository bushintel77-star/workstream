import { describe, expect, it } from "vitest";
import {
  pointInPolygonXZ,
  padStrokes,
  padCutFill,
  CUT_FILL_CELL_M,
} from "./cutFill";
import { VERTICAL_SCALE } from "./terrainMath";
import type { CanvasStroke, LandscapeFeature } from "@workstream/contracts";

/* -------------------------------------------------------------------------- */
/* pointInPolygonXZ                                                           */
/* -------------------------------------------------------------------------- */

const SQUARE = [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 10 },
  { x: 0, z: 10 },
];

describe("pointInPolygonXZ", () => {
  it("returns true for a point inside the polygon", () => {
    expect(pointInPolygonXZ(5, 5, SQUARE)).toBe(true);
  });

  it("returns false for a point outside the polygon", () => {
    expect(pointInPolygonXZ(15, 5, SQUARE)).toBe(false);
    expect(pointInPolygonXZ(-1, -1, SQUARE)).toBe(false);
  });

  it("returns false for degenerate polygons", () => {
    expect(pointInPolygonXZ(5, 5, [])).toBe(false);
    expect(pointInPolygonXZ(5, 5, SQUARE.slice(0, 2))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* padStrokes                                                                 */
/* -------------------------------------------------------------------------- */

function makeStroke(
  points: Array<[number, number]>,
  extrudeHeightM?: number,
): CanvasStroke {
  return {
    id: crypto.randomUUID(),
    points: points.map(([x, z]) => ({ x_pct: x, y_pct: z })),
    color: "#ff2ef6",
    width_px: 2.5,
    kind: "ink",
    ...(extrudeHeightM !== undefined ? { extrude_height_m: extrudeHeightM } : {}),
  };
}

function makeRegion(
  points: Array<[number, number]>,
  extrudeHeightM?: number,
): LandscapeFeature {
  return {
    id: crypto.randomUUID(),
    type: "LandscapeFeature",
    metadata: {
      layer: "other",
      timestamp_created: new Date().toISOString(),
      source_attribution: "human_drawn",
      user_modification_state: "human_locked",
    },
    geometry: {
      type: "Polygon",
      spatial_reference: "EPSG:3857",
      canvas_origin_pct: { x_pct: 0, y_pct: 0 },
      points: points.map(([x, y], i) => ({
        id: `v${i}`,
        pct: { x_pct: x, y_pct: y },
      })),
    },
    ...(extrudeHeightM !== undefined
      ? { extrude_height_m: extrudeHeightM }
      : {}),
  };
}

const REGION_SQUARE: Array<[number, number]> = [
  [25, 25],
  [75, 25],
  [75, 75],
  [25, 75],
];

describe("padStrokes", () => {
  it("selects closed strokes with a positive extrusion height", () => {
    // Closed square in board-% (25,25)→(75,25)→(75,75)→(25,75)→(25,25),
    // scaleM=100 → world (−25,−25)→(25,25).
    const closed = makeStroke(
      [
        [25, 25],
        [75, 25],
        [75, 75],
        [25, 75],
        [25, 25],
      ],
      1.5,
    );
    const pads = padStrokes([closed], 100, 1);
    expect(pads.length).toBe(1);
    expect(pads[0]!.id).toBe(closed.id);
    expect(pads[0]!.stroke).toBe(closed);
    expect(pads[0]!.feature).toBeUndefined();
    expect(pads[0]!.heightM).toBe(1.5);
    expect(pads[0]!.worldXZ[0]!.x).toBeCloseTo(-25, 5);
    expect(pads[0]!.worldXZ[0]!.z).toBeCloseTo(-25, 5);
    expect(pads[0]!.worldXZ.length).toBe(5);
  });

  it("also selects Polygon regions carrying a height (drafted Areas)", () => {
    const region = makeRegion(REGION_SQUARE, 0.9);
    const pads = padStrokes([], 100, 1, [region]);
    expect(pads.length).toBe(1);
    expect(pads[0]!.id).toBe(region.id);
    expect(pads[0]!.feature).toBe(region);
    expect(pads[0]!.stroke).toBeUndefined();
    expect(pads[0]!.heightM).toBe(0.9);
    // The ring is stored open; every vertex converts, none is duplicated.
    expect(pads[0]!.worldXZ.length).toBe(4);
    expect(pads[0]!.worldXZ[0]!.x).toBeCloseTo(-25, 5);
  });

  it("keeps extruded ink AND elevated regions as pads together", () => {
    const stroke = makeStroke(
      [...REGION_SQUARE, REGION_SQUARE[0]!],
      1.2,
    );
    const pads = padStrokes([stroke], 100, 1, [
      makeRegion(REGION_SQUARE, 0.5),
    ]);
    expect(pads).toHaveLength(2);
    expect(pads.filter((p) => p.stroke)).toHaveLength(1);
    expect(pads.filter((p) => p.feature)).toHaveLength(1);
  });

  it("ignores regions with no height, short rings, and LineStrings", () => {
    const flat = makeRegion(REGION_SQUARE);
    const zero = makeRegion(REGION_SQUARE, 0);
    const tiny = makeRegion(REGION_SQUARE.slice(0, 2), 1);
    const line: LandscapeFeature = {
      ...makeRegion(REGION_SQUARE, 1),
      geometry: {
        ...makeRegion(REGION_SQUARE, 1).geometry,
        type: "LineString",
      },
    };
    expect(padStrokes([], 100, 1, [flat, zero, tiny, line])).toEqual([]);
  });

  it("omitting features keeps the ink-only call site unchanged", () => {
    const stroke = makeStroke([...REGION_SQUARE, REGION_SQUARE[0]!], 1.2);
    expect(padStrokes([stroke], 100, 1)).toHaveLength(1);
  });

  it("rejects open strokes, zero heights, and short outlines", () => {
    const open = makeStroke(
      [
        [10, 10],
        [50, 10],
        [50, 50],
        [10, 55], // last point far from first → open
      ],
      1.5,
    );
    const flat = makeStroke(
      [
        [25, 25],
        [75, 25],
        [75, 75],
        [25, 75],
        [25, 25],
      ],
      0,
    );
    const tiny = makeStroke(
      [
        [25, 25],
        [30, 25],
      ],
      1.5,
    );
    expect(padStrokes([open, flat, tiny], 100, 1)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* padCutFill                                                                 */
/* -------------------------------------------------------------------------- */

describe("padCutFill", () => {
  it("flat terrain below the pad is pure fill: area × real height", () => {
    // Sampler returns 0 everywhere (exaggerated). Pad top at 3 world metres
    // → real height 3 / VERTICAL_SCALE = 1 m over the 10×10 m square.
    const result = padCutFill(() => 0, SQUARE, 3, 1);
    expect(result.areaM2).toBeCloseTo(100, 5);
    expect(result.fillM3).toBeCloseTo(100 * (3 / VERTICAL_SCALE), 5);
    expect(result.cutM3).toBeCloseTo(0, 5);
    expect(result.maxFillM).toBeCloseTo(3 / VERTICAL_SCALE, 5);
    expect(result.maxCutM).toBe(0);
    // 10×10 cells at 1 m resolution, all inside.
    expect(result.cells.length).toBe(100);
    expect(result.cells.every((c) => c.diffM > 0)).toBe(true);
  });

  it("terrain above the pad is pure cut, integrated over the footprint", () => {
    // Sampler = 3x (exaggerated) → real elevation x. Pad top 0 over [0,10]².
    // diffReal = −x → cut = Σ|x|·dA = 10 rows × (0.5+1.5+…+9.5) = 500 m³.
    const result = padCutFill((x) => 3 * x, SQUARE, 0, 1);
    expect(result.cutM3).toBeCloseTo(500, 0);
    expect(result.fillM3).toBeCloseTo(0, 5);
    expect(result.maxCutM).toBeCloseTo(9.5, 5);
  });

  it("a crossing surface splits cut and fill symmetrically", () => {
    // Sampler = 3(x−5) → real elevation (x−5). diffReal = 5−x: fill west of
    // x=5, cut east of it. Each half integrates to ≈ 125 m³.
    const result = padCutFill((x) => 3 * (x - 5), SQUARE, 0, 1);
    expect(result.fillM3).toBeCloseTo(125, 0);
    expect(result.cutM3).toBeCloseTo(125, 0);
  });

  it("excludes cells outside the polygon (triangle area check)", () => {
    const triangle = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 0, z: 10 },
    ];
    const result = padCutFill(() => 0, triangle, 3, 1);
    // Centres with x+z < 10: rows 0..8 → 45 cells of 1 m².
    expect(result.cells.length).toBe(45);
    expect(result.areaM2).toBeCloseTo(45, 5);
  });

  it("returns zeros for degenerate polygons", () => {
    const result = padCutFill(() => 5, SQUARE.slice(0, 2), 3, 1);
    expect(result.cells).toEqual([]);
    expect(result.areaM2).toBe(0);
    expect(result.cutM3).toBe(0);
    expect(result.fillM3).toBe(0);
  });

  it("default cell size is the module constant", () => {
    // Sanity: the default parameter threads through (1 call, no throw).
    const result = padCutFill(() => 0, SQUARE, 1);
    expect(result.areaM2).toBeGreaterThan(0);
    expect(CUT_FILL_CELL_M).toBe(0.75);
  });
});
