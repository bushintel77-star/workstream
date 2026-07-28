import { describe, expect, it } from "vitest";
import { wobbledPolylinePath } from "./handDrawnPen";

const SQUARE = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
  { x: 10, y: 10 },
];

describe("wobbledPolylinePath", () => {
  it("is deterministic for the same seed", () => {
    const a = wobbledPolylinePath(SQUARE, { seed: "proj-a:boundary" });
    const b = wobbledPolylinePath(SQUARE, { seed: "proj-a:boundary" });
    expect(a).toBe(b);
    expect(a.startsWith("M ")).toBe(true);
    expect(a.endsWith(" Z")).toBe(true);
  });

  it("changes when the seed changes", () => {
    const a = wobbledPolylinePath(SQUARE, { seed: "a" });
    const b = wobbledPolylinePath(SQUARE, { seed: "b" });
    expect(a).not.toBe(b);
  });

  it("returns empty for fewer than two points", () => {
    expect(wobbledPolylinePath([{ x: 1, y: 1 }], { seed: "x" })).toBe("");
  });

  it("closes rings that omit a repeated first vertex", () => {
    const open = [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ];
    const d = wobbledPolylinePath(open, { seed: "c", closed: true });
    expect(d.endsWith(" Z")).toBe(true);
  });
});
