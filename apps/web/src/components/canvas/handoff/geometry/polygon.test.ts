import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED } from "../studioCatalog";
import { snapTracePointer } from "./snap";
import {
  buildSiteSchedule,
  edgeSegments,
  normalizeRing,
  pointInPolygon,
  polygonAreaM2,
  tpzRadiusPct,
} from "./polygon";

const SCALE = 110;

describe("polygon metrics", () => {
  it("computes a positive lot area for Wrights seed boundary", () => {
    const area = polygonAreaM2(WRIGHTS_SEED.boundary, SCALE);
    expect(area).toBeGreaterThan(100);
    expect(area).toBeLessThan(800);
  });

  it("builds a site schedule with boolean outdoor close to naive when contained", () => {
    const s = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      SCALE,
    );
    expect(s.outdoorAreaM2).toBeCloseTo(s.outdoorNaiveM2, 0);
    expect(s.outdoorDiffersFromNaive).toBe(false);
    expect(s.siteCoveragePct).toBeGreaterThan(0);
    expect(s.siteCoveragePct).toBeLessThan(100);
    expect(s.boundaryPerimeterM).toBeGreaterThan(20);
  });

  it("flags outdoor when a building overhangs the lot", () => {
    const lot = [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 },
    ];
    // Building straddles the east edge (half outside).
    const overhang = [
      { x: 65, y: 40 },
      { x: 95, y: 40 },
      { x: 95, y: 60 },
      { x: 65, y: 60 },
    ];
    const s = buildSiteSchedule(lot, overhang, SCALE);
    expect(s.outdoorDiffersFromNaive).toBe(true);
    expect(s.outdoorAreaM2).toBeGreaterThan(s.outdoorNaiveM2);
  });

  it("subtracts exclude rings from workable outdoor", () => {
    const lot = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const house = [
      { x: 40, y: 40 },
      { x: 70, y: 40 },
      { x: 70, y: 70 },
      { x: 40, y: 70 },
    ];
    const easement = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 100 },
      { x: 0, y: 100 },
    ];
    const without = buildSiteSchedule(lot, house, SCALE);
    const withExclude = buildSiteSchedule(lot, house, SCALE, 1, [easement]);
    expect(withExclude.outdoorAreaM2).toBeLessThan(without.outdoorAreaM2);
  });

  it("labels boundary edges B1…Bn", () => {
    const segs = edgeSegments(WRIGHTS_SEED.boundary, "B", SCALE);
    expect(segs).toHaveLength(4);
    expect(segs.map((s) => s.key)).toEqual(["B1", "B2", "B3", "B4"]);
    for (const s of segs) {
      expect(s.lengthM).toBeGreaterThan(1);
    }
  });

  it("AS 4970-2025 NRZ for 450 mm DBH is 5.4 m with SRZ inside", () => {
    const { radiusM, rxPct, srzRadiusM, srzRxPct } = tpzRadiusPct(0.45, SCALE);
    expect(radiusM).toBeCloseTo(5.4, 5);
    expect(rxPct).toBeCloseTo((5.4 / SCALE) * 100, 5);
    expect(srzRadiusM).toBeGreaterThanOrEqual(1.5);
    expect(srzRadiusM).toBeLessThan(radiusM);
    expect(srzRxPct).toBeLessThan(rxPct);
  });

  it("point-in-polygon detects interior of a square", () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon({ x: 5, y: 5 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, sq)).toBe(false);
  });
});

describe("normalizeRing", () => {
  const quad = [
    { x: 10, y: 10 },
    { x: 40, y: 10 },
    { x: 40, y: 40 },
    { x: 10, y: 40 },
  ];

  it("drops a trailing duplicate of the first vertex", () => {
    const dup = [...quad, { x: 10, y: 10 }];
    expect(normalizeRing(dup)).toEqual(quad);
  });

  it("keeps an already-closed ring unchanged", () => {
    expect(normalizeRing(quad)).toEqual(quad);
  });

  it("leaves short open polylines untouched", () => {
    const two = [quad[0]!, quad[1]!];
    expect(normalizeRing(two)).toEqual(two);
  });
});

describe("trace close → valid B1–B4 ring", () => {
  it("a close click on a 4-vertex trace finishes a labelled closed ring", () => {
    const b1 = { x: 10, y: 10 };
    const b2 = { x: 40, y: 10 };
    const b3 = { x: 40, y: 40 };
    const b4 = { x: 10, y: 40 };
    const poly = [b1, b2, b3, b4];

    // Closing click near B1 — the trace tool's pointer-down uses this.
    const click = snapTracePointer(
      { x: 10.2, y: 10.1 },
      poly,
      [],
      { boardW: 1000, boardH: 800 },
    );
    expect(click.kind).toBe("close");

    // finishTrace normalises the ring and labels it B1…B4.
    const ring = normalizeRing(poly);
    expect(ring).toHaveLength(4);
    const segs = edgeSegments(ring, "B", SCALE);
    expect(segs.map((s) => s.key)).toEqual(["B1", "B2", "B3", "B4"]);
    // Closed ring: last edge returns to the first vertex.
    expect(segs[3]!.b).toEqual(b1);
    // Area is computable (no degenerate ring).
    expect(polygonAreaM2(ring, SCALE)).toBeGreaterThan(0);
  });

  it("normalises a 5th duplicate closing vertex back to 4 edges", () => {
    const poly = [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 10, y: 40 },
      { x: 10, y: 10 },
    ];
    const ring = normalizeRing(poly);
    expect(ring).toHaveLength(4);
    expect(edgeSegments(ring, "B", SCALE).map((s) => s.key)).toEqual([
      "B1",
      "B2",
      "B3",
      "B4",
    ]);
  });
});
