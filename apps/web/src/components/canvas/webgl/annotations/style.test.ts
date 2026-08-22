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

  it("changes communication emphasis by dialect — weight, density and dash", () => {
    const technical = dialectStyleProfile("technical");
    const creative = dialectStyleProfile("creative");
    expect(technical.hierarchy.boundaryPx).not.toBe(creative.hierarchy.boundaryPx);
    expect(technical.categories.material_hatch.stroke).not.toBe(
      creative.categories.material_hatch.stroke,
    );
    expect(technical.categories.scope_outline.dash).not.toBe(
      creative.categories.scope_outline.dash,
    );
  });

  it("does not use hue as a dialect axis", () => {
    // This assertion inverts the one it replaced. Hue used to vary per dialect,
    // which is how the CAD default ended up painting the title boundary in
    // design ink and design elements in survey blue — see style.invariant.test.
    const technical = dialectStyleProfile("technical");
    const creative = dialectStyleProfile("creative");
    expect(technical.categories.elevation_rl.stroke).toBe(
      creative.categories.elevation_rl.stroke,
    );
    expect(technical.categories.detail_callout.stroke).toBe(
      creative.categories.detail_callout.stroke,
    );
    expect(technical.categories.property_line.stroke).toBe(
      creative.categories.property_line.stroke,
    );
  });
});
