import { describe, expect, it } from "vitest";
import { tidySketchPoints, tidySketchStrokes } from "./tidy-sketch";

describe("tidySketchPoints", () => {
  it("keeps endpoints and reduces point count jitter path", () => {
    const jagged = [
      { x: 10, y: 10 },
      { x: 10.4, y: 12.2 },
      { x: 11.1, y: 14.8 },
      { x: 12, y: 18 },
      { x: 14, y: 22 },
      { x: 18, y: 28 },
      { x: 24, y: 34 },
      { x: 30, y: 40 },
    ];
    const tidied = tidySketchPoints(jagged);
    expect(tidied.length).toBeGreaterThan(3);
    expect(tidied[0]).toEqual(jagged[0]);
    expect(tidied[tidied.length - 1]!.x).toBeCloseTo(30, 0);
    expect(tidied[tidied.length - 1]!.y).toBeCloseTo(40, 0);
  });

  it("maps over stroke collections without changing ids", () => {
    const out = tidySketchStrokes([
      { id: "a", points: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }] },
    ]);
    expect(out[0]!.id).toBe("a");
    expect(out[0]!.points.length).toBeGreaterThan(2);
  });
});
