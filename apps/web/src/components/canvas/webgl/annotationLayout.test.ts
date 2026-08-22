import { describe, expect, it } from "vitest";
import { layoutPerimeterAnnotations } from "./annotationLayout";

describe("layoutPerimeterAnnotations", () => {
  const options = { width: 1000, height: 700, labelWidth: 160, labelHeight: 32, padding: 24 };

  it("places every annotation with a three-point leader", () => {
    const result = layoutPerimeterAnnotations([
      { id: "title", x: 420, y: 300 },
      { id: "easement", x: 700, y: 420 },
    ], options);
    expect(result).toHaveLength(2);
    expect(result.every((item) => item.leader.length === 3)).toBe(true);
  });

  it("avoids reserved chrome and earlier labels when alternatives exist", () => {
    const result = layoutPerimeterAnnotations([
      { id: "a", x: 500, y: 40 },
      { id: "b", x: 520, y: 45 },
    ], {
      ...options,
      reserved: [{ x: 400, y: 0, width: 200, height: 80 }],
    });
    expect(result[0]!.label.y).toBeGreaterThanOrEqual(24);
    expect(result[1]!.label.x !== result[0]!.label.x || result[1]!.label.y !== result[0]!.label.y).toBe(true);
  });

  it("limits visible annotations by priority", () => {
    const result = layoutPerimeterAnnotations([
      { id: "low", x: 300, y: 300, priority: 1 },
      { id: "high", x: 700, y: 300, priority: 10 },
    ], { ...options, maxVisible: 1 });
    expect(result.map((item) => item.id)).toEqual(["high"]);
  });

  it("is deterministic", () => {
    const anchors = [{ id: "one", x: 10, y: 20 }, { id: "two", x: 900, y: 600 }];
    expect(layoutPerimeterAnnotations(anchors, options)).toEqual(layoutPerimeterAnnotations(anchors, options));
  });
});
