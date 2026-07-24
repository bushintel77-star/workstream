import { describe, expect, it } from "vitest";
import { decorativeGlyphShadowOffset } from "@workstream/domain";
import { hatchUrlFor, SUN_SHADOW, sunShadowFill } from "./renderTokens";

describe("renderTokens", () => {
  it("keeps soft-shadow presentation factors stable", () => {
    expect(SUN_SHADOW.dxPct).toBe(0);
    expect(SUN_SHADOW.dyFactor).toBe(0.22);
    expect(SUN_SHADOW.opacity).toBe(0.12);
    expect(SUN_SHADOW.nightOpacity).toBe(0.3);
  });

  it("north sun still falls south via the cast vector helper", () => {
    const { dx, dy } = decorativeGlyphShadowOffset(0, 44, SUN_SHADOW.dyFactor);
    expect(Math.abs(dx)).toBeLessThan(0.01);
    expect(dy).toBeCloseTo(44 * SUN_SHADOW.dyFactor, 5);
  });

  it("returns multiply-friendly rgba fills", () => {
    expect(sunShadowFill(false)).toBe("rgba(28,25,23,0.12)");
    expect(sunShadowFill(true)).toBe("rgba(28,25,23,0.3)");
  });

  it("points hatch urls at shared defs ids", () => {
    expect(hatchUrlFor("bluestone", false)).toBe("url(#ws-hatch-bluestone)");
    expect(hatchUrlFor("deck", true)).toBe("url(#ws-hatch-deck-night)");
    expect(hatchUrlFor("gravel", false)).toBe("url(#ws-hatch-gravel)");
  });
});
