import { describe, expect, it } from "vitest";
import {
  hatchUrlFor,
  SUN_SHADOW,
  sunShadowFill,
  viewFromCast,
} from "./renderTokens";

describe("renderTokens", () => {
  it("casts shadows south (+y) with a fixed dy factor", () => {
    expect(SUN_SHADOW.dxPct).toBe(0);
    expect(SUN_SHADOW.dyFactor).toBe(0.22);
    expect(SUN_SHADOW.opacity).toBe(0.12);
    expect(SUN_SHADOW.nightOpacity).toBe(0.3);
  });

  it("returns multiply-friendly rgba fills", () => {
    expect(sunShadowFill(false)).toBe("rgba(28,25,23,0.12)");
    expect(sunShadowFill(true)).toBe("rgba(28,25,23,0.3)");
  });

  it("viewFromCast falls back to static south when cast is null", () => {
    const v = viewFromCast(null);
    expect(v.dyFactor).toBe(SUN_SHADOW.dyFactor);
    expect(v.dyPct).toBe(SUN_SHADOW.dwellingDyPct);
  });

  it("viewFromCast maps live cast into glyph + dwelling offsets", () => {
    const v = viewFromCast({
      dxPct: -0.4,
      dyPct: 1.2,
      dxFactor: -0.1,
      dyFactor: 0.3,
      lengthM: 4,
      altitude_deg: 28,
      azimuth_deg: 40,
    });
    expect(v.dxPct).toBe(-0.4);
    expect(v.dyPct).toBe(1.2);
    expect(v.dxFactor).toBe(-0.1);
    expect(v.dyFactor).toBe(0.3);
  });

  it("points hatch urls at shared defs ids", () => {
    expect(hatchUrlFor("bluestone", false)).toBe("url(#ws-hatch-bluestone)");
    expect(hatchUrlFor("deck", true)).toBe("url(#ws-hatch-deck-night)");
    expect(hatchUrlFor("gravel", false)).toBe("url(#ws-hatch-gravel)");
  });
});
