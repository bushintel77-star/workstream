import { describe, expect, it } from "vitest";
import {
  AR_ALIGN_IOU_OK,
  AR_BIRDSEYE_HONESTY,
  arAlignLabel,
  buildArBirdseyeScene,
  polygonAreaPct,
  polygonIou,
} from "./ar-birdseye";

const SQUARE = [
  { x: 10, y: 10 },
  { x: 50, y: 10 },
  { x: 50, y: 50 },
  { x: 10, y: 50 },
];

const OVERLAP = [
  { x: 30, y: 30 },
  { x: 70, y: 30 },
  { x: 70, y: 70 },
  { x: 30, y: 70 },
];

describe("ar-birdseye", () => {
  it("computes area and iou for overlapping squares", () => {
    expect(polygonAreaPct(SQUARE)).toBeCloseTo(1600, 0);
    const iou = polygonIou(SQUARE, OVERLAP);
    expect(iou).toBeGreaterThan(0.1);
    expect(iou).toBeLessThan(0.5);
    expect(arAlignLabel(iou)).toBe("poor");
    expect(arAlignLabel(AR_ALIGN_IOU_OK)).toBe("fair");
    expect(arAlignLabel(0.6)).toBe("good");
  });

  it("builds a scene with footprint occlusion honesty", () => {
    const scene = buildArBirdseyeScene({
      boundary: SQUARE.map((p) => ({ x_pct: p.x, y_pct: p.y })),
      building: [
        { x_pct: 20, y_pct: 20 },
        { x_pct: 40, y_pct: 20 },
        { x_pct: 40, y_pct: 40 },
        { x_pct: 20, y_pct: 40 },
      ],
      placements: [
        { id: "a", x_pct: 60, y_pct: 60, symbol_id: "tree-hornbeam" },
        { id: "b", x_pct: 55, y_pct: 70, symbol_id: "paving-bluestone" },
      ],
    });
    expect(scene.occlusion).toBe("footprint");
    expect(scene.honesty).toBe(AR_BIRDSEYE_HONESTY);
    expect(scene.boundary).toHaveLength(4);
    expect(scene.building).toHaveLength(4);
    expect(scene.placements[0]?.kind).toBe("planting");
    expect(scene.placements[1]?.kind).toBe("hardscape");
  });

  it("returns empty geometry without inventing rings", () => {
    const scene = buildArBirdseyeScene({});
    expect(scene.boundary).toEqual([]);
    expect(scene.building).toEqual([]);
    expect(scene.placements).toEqual([]);
  });
});
