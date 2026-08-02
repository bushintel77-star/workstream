import { describe, expect, it } from "vitest";
import { decorativeGlyphShadowOffset } from "@workstream/domain";
import {
  elevationTextureUrl,
  hatchKindForSymbol,
  hatchUrlFor,
  ELEV_TEXTURE_IDS,
  HATCH_IDS,
  SUN_SHADOW,
  sunShadowFill,
  viewFromCast,
  type HatchKind,
} from "./renderTokens";

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
    expect(sunShadowFill(false)).toBe(
      "color-mix(in srgb, var(--text-primary) 12%, transparent)",
    );
    expect(sunShadowFill(true)).toBe(
      "color-mix(in srgb, var(--text-primary) 30%, transparent)",
    );
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

  it("covers every Curtis hardscape family day and night", () => {
    const kinds: HatchKind[] = [
      "bluestone",
      "deck",
      "gravel",
      "porcelain",
      "stepper",
      "crazypave",
      "aggregate",
      "hoggin",
    ];
    for (const kind of kinds) {
      expect(hatchUrlFor(kind, false)).toMatch(/^url\(#ws-hatch-[a-z]+\)$/);
      expect(hatchUrlFor(kind, true)).toMatch(/^url\(#ws-hatch-[a-z]+-night\)$/);
    }
    const ids = Object.values(HATCH_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves the hatch from the placed catalog symbol", () => {
    expect(hatchKindForSymbol("porcelain-tile", "bluestone")).toBe("porcelain");
    expect(hatchKindForSymbol("granite-stepper", "bluestone")).toBe("stepper");
    expect(hatchKindForSymbol("sandstone-crazy", "bluestone")).toBe("crazypave");
    expect(hatchKindForSymbol("exposed-aggregate", "bluestone")).toBe(
      "aggregate",
    );
    expect(hatchKindForSymbol("hoggin-path", "bluestone")).toBe("hoggin");
    expect(hatchKindForSymbol("curtis-deck-050", "bluestone")).toBe("deck");
  });

  it("falls back to the coarse type for legacy or untagged placements", () => {
    expect(hatchKindForSymbol(undefined, "bluestone")).toBe("bluestone");
    expect(hatchKindForSymbol("", "deck")).toBe("deck");
    expect(hatchKindForSymbol("some-future-symbol", "gravel")).toBe("gravel");
  });

  it("points elevation textures at their own defs ids", () => {
    expect(elevationTextureUrl("foliage", false)).toBe("url(#ws-elev-foliage)");
    expect(elevationTextureUrl("foliage", true)).toBe(
      "url(#ws-elev-foliage-night)",
    );
    expect(elevationTextureUrl("timber", false)).toBe("url(#ws-elev-timber)");
    expect(elevationTextureUrl("clip", true)).toBe("url(#ws-elev-clip-night)");
  });

  it("keeps elevation texture ids distinct from the plan hatches", () => {
    const elev = Object.values(ELEV_TEXTURE_IDS);
    const plan = Object.values(HATCH_IDS);
    expect(new Set(elev).size).toBe(elev.length);
    for (const id of elev) expect(plan).not.toContain(id);
  });
});
