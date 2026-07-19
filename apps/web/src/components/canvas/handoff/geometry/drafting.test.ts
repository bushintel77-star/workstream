import { describe, expect, it } from "vitest";
import {
  deleteVertex,
  formatSegmentTip,
  insertVertexAfter,
  replaceVertex,
} from "./drafting";

describe("formatSegmentTip", () => {
  it("reports length and bearing for a horizontal segment", () => {
    const tip = formatSegmentTip({ x: 0, y: 50 }, { x: 50, y: 50 }, 100);
    expect(tip.lengthM).toBeCloseTo(50, 5);
    expect(tip.angleDeg).toBeCloseTo(0, 5);
    expect(tip.text).toContain("m");
  });
});

describe("polygon vertex helpers", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("refuses to delete below a triangle", () => {
    expect(deleteVertex(square.slice(0, 3), 1)).toBeNull();
  });

  it("deletes a vertex when four or more remain", () => {
    const next = deleteVertex(square, 1);
    expect(next).toHaveLength(3);
    expect(next?.[1]).toEqual({ x: 10, y: 10 });
  });

  it("inserts a mid-edge vertex", () => {
    const next = insertVertexAfter(square, 0);
    expect(next).toHaveLength(5);
    expect(next[1]).toEqual({ x: 5, y: 0 });
  });

  it("replaces a vertex immutably", () => {
    const next = replaceVertex(square, 2, { x: 12, y: 12 });
    expect(next[2]).toEqual({ x: 12, y: 12 });
    expect(square[2]).toEqual({ x: 10, y: 10 });
  });
});
