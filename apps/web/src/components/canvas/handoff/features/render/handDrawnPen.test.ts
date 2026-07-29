import { describe, expect, it } from "vitest";
import {
  roughCirclePath,
  roughEllipsePath,
  wobbledPolylinePath,
} from "./handDrawnPen";

const SQUARE = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
  { x: 10, y: 10 },
];

describe("wobbledPolylinePath (Rough.js)", () => {
  it("is deterministic for the same seed", () => {
    const a = wobbledPolylinePath(SQUARE, { seed: "proj-a:boundary" });
    const b = wobbledPolylinePath(SQUARE, { seed: "proj-a:boundary" });
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(20);
    expect(a.startsWith("M")).toBe(true);
  });

  it("changes when the seed changes", () => {
    const a = wobbledPolylinePath(SQUARE, { seed: "a" });
    const b = wobbledPolylinePath(SQUARE, { seed: "b" });
    expect(a).not.toBe(b);
  });

  it("returns empty for fewer than two points", () => {
    expect(wobbledPolylinePath([{ x: 1, y: 1 }], { seed: "x" })).toBe("");
  });

  it("draws closed rings that omit a repeated first vertex", () => {
    const open = [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ];
    const d = wobbledPolylinePath(open, { seed: "c", closed: true });
    expect(d.length).toBeGreaterThan(20);
    expect(d.startsWith("M")).toBe(true);
  });
});

describe("roughEllipsePath", () => {
  it("is deterministic", () => {
    const a = roughEllipsePath(50, 50, 8, 6, "canopy:1");
    const b = roughEllipsePath(50, 50, 8, 6, "canopy:1");
    expect(a).toBe(b);
    expect(a.startsWith("M")).toBe(true);
  });

  it("roughCirclePath delegates", () => {
    const a = roughCirclePath(40, 40, 5, "disc");
    expect(a).toBe(roughEllipsePath(40, 40, 5, 5, "disc"));
  });
});
