import { describe, expect, it } from "vitest";
import { strokePointsToPathD } from "./studio-strokes";

describe("strokePointsToPathD", () => {
  it("returns empty path for fewer than two points", () => {
    expect(strokePointsToPathD([{ x_pct: 50, y_pct: 50 }], 400, 240)).toBe("");
  });

  it("returns SVG path for a short stroke", () => {
    const d = strokePointsToPathD(
      [
        { x_pct: 10, y_pct: 10 },
        { x_pct: 30, y_pct: 20 },
        { x_pct: 50, y_pct: 15 },
      ],
      400,
      240,
    );
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });
});
