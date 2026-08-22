import { describe, expect, it } from "vitest";
import { dialectStyleProfile } from "./style";

describe("annotation style profiles", () => {
  it("keeps boundary hierarchy stronger than guides", () => {
    const technical = dialectStyleProfile("technical");
    expect(technical.hierarchy.boundaryPx).toBeGreaterThan(technical.hierarchy.annotationPx);
    expect(technical.hierarchy.annotationPx).toBeGreaterThan(technical.hierarchy.guidePx);
    expect(technical.categories.property_line.strokeWidth).toBe(
      technical.hierarchy.boundaryPx,
    );
  });

  it("changes communication emphasis by dialect", () => {
    const technical = dialectStyleProfile("technical");
    const creative = dialectStyleProfile("creative");
    expect(technical.categories.elevation_rl.stroke).not.toBe(
      creative.categories.elevation_rl.stroke,
    );
    expect(technical.categories.scope_outline.dash).not.toBe(
      creative.categories.scope_outline.dash,
    );
  });
});
