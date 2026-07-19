import { describe, expect, it } from "vitest";
import { inferRectangleCompletion } from "./trace-autocomplete";

describe("inferRectangleCompletion", () => {
  it("completes a rectangle from three corners", () => {
    const draft = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
    ];
    const result = inferRectangleCompletion(draft, null);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
      { x: 0, y: 8 },
    ]);
  });

  it("completes from two points and cursor when width exceeds threshold", () => {
    const draft = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ];
    const cursor = { x: 20, y: 12 };
    const result = inferRectangleCompletion(draft, cursor, 4);
    expect(result).toHaveLength(4);
    expect(result![2]).toEqual({ x: 20, y: 12 });
    expect(result![3]).toEqual({ x: 0, y: 12 });
  });

  it("returns null when width is below threshold", () => {
    const draft = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ];
    const cursor = { x: 20, y: 1 };
    expect(inferRectangleCompletion(draft, cursor, 4)).toBeNull();
  });
});
