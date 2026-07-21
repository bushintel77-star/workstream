import { describe, expect, it } from "vitest";
import {
  findSketchStrokeAtPoint,
  shouldAppendSketchPoint,
  sketchWidthForPointer,
} from "./sketchInput";

describe("sketch input", () => {
  it("decimates tiny pointer moves but keeps intentional movement", () => {
    expect(shouldAppendSketchPoint({ x: 10, y: 10 }, { x: 10.1, y: 10.1 })).toBe(
      false,
    );
    expect(shouldAppendSketchPoint({ x: 10, y: 10 }, { x: 10.5, y: 10 })).toBe(
      true,
    );
  });

  it("maps pen pressure to a restrained stroke width", () => {
    expect(sketchWidthForPointer("pen", 0)).toBe(1.35);
    expect(sketchWidthForPointer("pen", 1)).toBe(3.6);
    expect(sketchWidthForPointer("touch", 0.8)).toBe(2.35);
  });

  it("erases the latest stroke under the pointer", () => {
    const strokes = [
      { id: "first", points: [{ x: 10, y: 20 }, { x: 90, y: 20 }] },
      { id: "latest", points: [{ x: 10, y: 22 }, { x: 90, y: 22 }] },
    ];
    expect(findSketchStrokeAtPoint(strokes, { x: 50, y: 22 }, 1000, 500)).toBe(
      "latest",
    );
    expect(findSketchStrokeAtPoint(strokes, { x: 50, y: 80 }, 1000, 500)).toBeNull();
  });
});
