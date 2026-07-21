import { describe, expect, it } from "vitest";
import {
  findSketchStrokeAtPoint,
  shouldAppendSketchPoint,
  sketchWidthForPointer,
} from "./sketchInput";
import { sketchEraserCursor, sketchPenCursor } from "./sketchCursors";

describe("sketch input", () => {
  it("decimates tiny pointer moves but keeps intentional movement", () => {
    expect(shouldAppendSketchPoint({ x: 10, y: 10 }, { x: 10.1, y: 10.1 })).toBe(
      false,
    );
    expect(shouldAppendSketchPoint({ x: 10, y: 10 }, { x: 10.5, y: 10 })).toBe(
      true,
    );
  });

  it("grades pen pressure inside the chosen tip band", () => {
    expect(sketchWidthForPointer("pen", 0, "fine")).toBe(1.05);
    expect(sketchWidthForPointer("pen", 1, "fine")).toBe(2.25);
    expect(sketchWidthForPointer("pen", 0, "marker")).toBe(2.85);
    expect(sketchWidthForPointer("pen", 1, "marker")).toBe(5.5);
    expect(sketchWidthForPointer("mouse", null, "medium")).toBeGreaterThan(1.7);
    expect(sketchWidthForPointer("touch", null, "medium")).toBeGreaterThan(
      sketchWidthForPointer("mouse", null, "medium"),
    );
  });

  it("builds pen and eraser cursors", () => {
    expect(sketchPenCursor("fine")).toContain("data:image/svg+xml");
    expect(sketchPenCursor("marker")).toContain("data:image/svg+xml");
    expect(sketchEraserCursor()).toContain("data:image/svg+xml");
    expect(sketchEraserCursor()).toContain("cell");
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
