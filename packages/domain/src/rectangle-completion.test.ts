import { describe, expect, it } from "vitest";
import { inferRectangleCompletion } from "./rectangle-completion";

describe("inferRectangleCompletion", () => {
  it("completes a parallelogram from 3 points", () => {
    const pts = inferRectangleCompletion([
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 30 },
    ]);
    expect(pts).toEqual([
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 30 },
      { x: 10, y: 30 },
    ]);
  });

  it("projects a perpendicular rectangle from 2 points + cursor", () => {
    const pts = inferRectangleCompletion(
      [
        { x: 10, y: 20 },
        { x: 40, y: 20 },
      ],
      { x: 40, y: 35 },
    );
    expect(pts).not.toBeNull();
    expect(pts![0]).toEqual({ x: 10, y: 20 });
    expect(pts![1]).toEqual({ x: 40, y: 20 });
    expect(pts![2]!.y).toBeCloseTo(35, 5);
    expect(pts![3]!.y).toBeCloseTo(35, 5);
    expect(pts![2]!.x).toBeCloseTo(40, 5);
    expect(pts![3]!.x).toBeCloseTo(10, 5);
  });

  it("returns null when offset is too small", () => {
    expect(
      inferRectangleCompletion(
        [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
        ],
        { x: 40, y: 20.5 },
      ),
    ).toBeNull();
  });

  it("returns null for fewer than 2 points", () => {
    expect(inferRectangleCompletion([{ x: 1, y: 1 }])).toBeNull();
  });
});
