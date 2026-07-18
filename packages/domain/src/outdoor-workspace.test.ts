import { describe, expect, it } from "vitest";
import { outdoorWorkspaceSpan } from "./geometry";

describe("outdoorWorkspaceSpan", () => {
  it("sizes CAD template from title ring metres", () => {
    // ~20 m E-W × ~15 m N-S near Melbourne
    const ring: [number, number][] = [
      [145.0, -37.85],
      [145.00022, -37.85],
      [145.00022, -37.85014],
      [145.0, -37.85014],
      [145.0, -37.85],
    ];
    const span = outdoorWorkspaceSpan({
      titleRing: ring,
      garden_area_m2: 240,
    });
    expect(span.outdoor_area_m2).toBe(240);
    expect(span.width_m).toBeGreaterThan(15);
    expect(span.width_m).toBeLessThan(30);
    expect(span.height_m).toBeGreaterThan(10);
    expect(span.height_m).toBeLessThan(25);
  });

  it("falls back to garden area square when no ring", () => {
    const span = outdoorWorkspaceSpan({
      titleRing: null,
      garden_area_m2: 400,
    });
    expect(span.outdoor_area_m2).toBe(400);
    expect(span.width_m * span.height_m).toBeGreaterThan(200);
  });
});
