import { describe, expect, it } from "vitest";
import {
  bearingDeg,
  distanceToRing,
  edgeLengths,
  generateGhosts,
  inwardNormal,
  parsePrompt,
  placeAlongBoundary,
  placeInMass,
  pointAroundRing,
  pointInPolygon,
  signedArea,
} from "./aiGeneration";
import type { PctPoint } from "./coordTransform";

/** 60×40 m lot analogue in board-% (clockwise in screen space). */
const LOT: PctPoint[] = [
  { x: 20, y: 15 },
  { x: 80, y: 15 },
  { x: 80, y: 85 },
  { x: 20, y: 85 },
];

/** L-shaped lot — concavity is where naive normals break. */
const L_SHAPE: PctPoint[] = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 50 },
  { x: 50, y: 50 },
  { x: 50, y: 90 },
  { x: 10, y: 90 },
];

const BUILDING: PctPoint[] = [
  { x: 40, y: 30 },
  { x: 60, y: 30 },
  { x: 60, y: 45 },
  { x: 40, y: 45 },
];

const EASEMENT: PctPoint[] = [
  { x: 20, y: 70 },
  { x: 80, y: 70 },
  { x: 80, y: 78 },
  { x: 20, y: 78 },
];

describe("aiGeneration — polygon substrate", () => {
  it("edgeLengths matches the ring's per-edge hypotenuses", () => {
    expect(edgeLengths(LOT)).toEqual([60, 70, 60, 70]);
  });

  it("pointAroundRing walks the perimeter by arc length", () => {
    // t=0 → first vertex; halfway around a 260-length ring lands on the
    // edge opposite the start.
    const start = pointAroundRing(LOT, 0);
    expect(start.pt).toEqual(LOT[0]);
    const opposite = pointAroundRing(LOT, 0.5);
    // total = 260; 130 arc-length → 60 along edge 0, 70 along edge 1 → exactly vertex 2.
    expect(opposite.pt.x).toBeCloseTo(80);
    expect(opposite.pt.y).toBeCloseTo(85);
    expect(opposite.edgeIndex).toBe(1);
  });

  it("inwardNormal points into the lot on convex and concave rings", () => {
    // Top edge (20,15)→(80,15): interior is BELOW (+y). This ring is
    // counter-clockwise in math space (positive signedArea) — the normal
    // must still point into the lot regardless of winding.
    expect(signedArea(LOT)).toBeGreaterThan(0);
    const n = inwardNormal(LOT, 0);
    expect(n.y).toBeGreaterThan(0);
    // Sample slightly inside along the normal: must be in the polygon.
    const probe = { x: 50 + n.x * 5, y: 15 + n.y * 5 };
    expect(pointInPolygon(probe, LOT)).toBe(true);
    // Concave notch edge 2 (90,50)→(50,50) on the L: the interior below it
    // (the wide arm) is the valid side; the probe must land inside.
    const nl = inwardNormal(L_SHAPE, 2);
    const probeL = { x: 70 + nl.x * 5, y: 50 + nl.y * 5 };
    expect(pointInPolygon(probeL, L_SHAPE)).toBe(true);
  });

  it("pointInPolygon and distanceToRing behave on the lot", () => {
    expect(pointInPolygon({ x: 50, y: 50 }, LOT)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 50 }, LOT)).toBe(false);
    expect(distanceToRing({ x: 20, y: 50 }, LOT)).toBeCloseTo(0, 5);
    expect(distanceToRing({ x: 14, y: 50 }, LOT)).toBeCloseTo(6, 5);
  });
});

describe("aiGeneration — constraint-sampled placement", () => {
  it("placeAlongBoundary returns inset points with edge refs facing inward", () => {
    const slots = placeAlongBoundary(LOT, 6, 4);
    expect(slots).toHaveLength(6);
    for (const s of slots) {
      // Inset from the edge → strictly inside the lot.
      expect(pointInPolygon(s.pt, LOT)).toBe(true);
      expect(s.ref.insetPct).toBe(4);
      expect(s.ref.edgeIndex).toBeGreaterThanOrEqual(0);
      expect(s.ref.tAlongEdge).toBeGreaterThanOrEqual(0);
      expect(s.ref.tAlongEdge).toBeLessThanOrEqual(1);
      // Rotation is a normalised compass bearing.
      expect(s.rotationDeg).toBeGreaterThanOrEqual(0);
      expect(s.rotationDeg).toBeLessThan(360);
    }
  });

  it("placeInMass never lands in the building, the easement, or outside the lot", () => {
    const pts = placeInMass({
      boundary: LOT,
      building: BUILDING,
      easements: [EASEMENT],
      existingTrees: [{ x_pct: 30, y_pct: 25, canopy_radius_m: 4 }],
      count: 20,
      seed: 42,
    });
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      expect(pointInPolygon(p, LOT)).toBe(true);
      expect(pointInPolygon(p, BUILDING)).toBe(false);
      expect(distanceToRing(p, BUILDING)).toBeGreaterThanOrEqual(2);
      expect(pointInPolygon(p, EASEMENT)).toBe(false);
      const tree = { x: 30, y: 25 };
      expect(Math.hypot(p.x - tree.x, p.y - tree.y)).toBeGreaterThanOrEqual(
        (4 / 110) * 100 - 1e-6,
      );
    }
  });

  it("placeInMass is deterministic for a given seed", () => {
    const a = placeInMass({
      boundary: LOT,
      building: BUILDING,
      existingTrees: [],
      count: 10,
      seed: 7,
    });
    const b = placeInMass({
      boundary: LOT,
      building: BUILDING,
      existingTrees: [],
      count: 10,
      seed: 7,
    });
    expect(a).toEqual(b);
  });
});

describe("aiGeneration — intent parsing", () => {
  it("recognises the A2-6 compliance intent", () => {
    const intent = parsePrompt("fill the canopy shortfall for A2-6 compliance");
    expect(intent.category).toBe("compliance-fill");
  });

  it("keeps the legacy intents", () => {
    expect(parsePrompt("native screening along the boundary").category).toBe("screening");
    expect(parsePrompt("native screening along the boundary").placement).toBe("boundary");
    expect(parsePrompt("native screening along the boundary").style).toBe("native");
  });
});

describe("aiGeneration — generateGhosts", () => {
  it("returns boundary-referenced ghosts for a screening prompt (species may be empty offline)", () => {
    const out = generateGhosts({
      prompt: "native screening along the boundary",
      boundary: LOT,
      building: BUILDING,
      existingTrees: [],
      envelope: null,
    });
    // The flora ranker is catalogue-driven; when it yields candidates every
    // ghost must be a valid placement inside the lot with a prompt label.
    for (const g of out) {
      expect(g.placement.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(g.placement.label).toContain("AI:");
      expect(g.placement.x_pct).toBeGreaterThanOrEqual(2);
      expect(g.placement.x_pct).toBeLessThanOrEqual(98);
      if (g.ref) expect(g.ref.insetPct).toBeGreaterThan(0);
    }
  });

  it("same prompt + site → identical ghosts (steerable determinism)", () => {
    const input = {
      prompt: "mass planting of natives",
      boundary: LOT,
      building: BUILDING,
      existingTrees: [],
      envelope: null,
    };
    const a = generateGhosts(input);
    const b = generateGhosts(input);
    expect(a.map((g) => g.placement.x_pct)).toEqual(
      b.map((g) => g.placement.x_pct),
    );
  });

  it("bearingDeg normalises to [0,360)", () => {
    expect(bearingDeg(1, 0)).toBeCloseTo(0);
    expect(bearingDeg(0, 1)).toBeCloseTo(90);
    expect(bearingDeg(-1, -1)).toBeCloseTo(225);
  });
});
