import { describe, expect, it } from "vitest";
import {
  MATERIALS,
  MATERIAL_GROUPS,
  BUILD_UP_RAMP,
  materialsByGroup,
  materialById,
  mmToPx,
  dashSignaturePx,
  greyscaleLuminance,
  isGreyscaleDistinguishable,
} from "./materials";

describe("materialPalette — Phase M.1: 21-material palette", () => {
  it("has exactly 21 materials", () => {
    expect(MATERIALS).toHaveLength(21);
  });

  it("has 4 groups", () => {
    expect(MATERIAL_GROUPS).toHaveLength(4);
  });

  it("every material has a unique id", () => {
    const ids = MATERIALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every material has a valid group", () => {
    const validGroups = new Set(MATERIAL_GROUPS.map((g) => g.id));
    for (const m of MATERIALS) {
      expect(validGroups.has(m.group)).toBe(true);
    }
  });

  it("softscape has 6 materials", () => {
    expect(materialsByGroup("softscape")).toHaveLength(6);
  });

  it("hardscape has 6 materials", () => {
    expect(materialsByGroup("hardscape")).toHaveLength(6);
  });

  it("soilWater has 4 materials", () => {
    expect(materialsByGroup("soilWater")).toHaveLength(4);
  });

  it("markup has 5 materials", () => {
    expect(materialsByGroup("markup")).toHaveLength(5);
  });
});

describe("materialPalette — Phase M.2: build-up ramp", () => {
  it("has 5 alpha steps", () => {
    expect(BUILD_UP_RAMP).toHaveLength(5);
  });

  it("ramp values are 0.22 / 0.42 / 0.62 / 0.82 / 1.0", () => {
    expect([...BUILD_UP_RAMP]).toEqual([0.22, 0.42, 0.62, 0.82, 1.0]);
  });
});

describe("materialPalette — Phase M.3: dash signatures mandatory for markup", () => {
  it("every markup material has a dash array", () => {
    for (const m of materialsByGroup("markup")) {
      expect(m.dash).toBeDefined();
    }
  });

  /**
   * §8c with no exception. This used to read "every markup material except
   * drafting", which is not the rule — the rule is that a SEMANTIC line must
   * carry a signature. Drafting is a plain construction line and is not
   * semantic, so the exception disappears rather than being written down.
   */
  it("every semantic material carries a non-empty dash signature", () => {
    const semantic = MATERIALS.filter((m) => m.semantic);
    expect(semantic.length).toBeGreaterThan(0);
    for (const m of semantic) {
      expect(m.dash, `${m.id} is semantic with no dash`).toBeDefined();
      expect(m.dash!.length, `${m.id} is semantic with an empty dash`).toBeGreaterThan(0);
    }
  });

  it("a material with no dash signature is not semantic", () => {
    for (const m of MATERIALS) {
      if (m.dash && m.dash.length === 0) {
        expect(m.semantic, `${m.id} claims semantics it cannot encode`).toBe(false);
      }
    }
  });

  it("every markup material has dash ends defined", () => {
    for (const m of materialsByGroup("markup")) {
      expect(m.dashEnds).toBeDefined();
    }
  });

  it("softscape materials are NOT semantic (hue-only)", () => {
    for (const m of materialsByGroup("softscape")) {
      expect(m.semantic).toBe(false);
      expect(m.dash).toBeUndefined();
    }
  });
});

describe("materialPalette — Phase M.4: signature scales with weight, not zoom", () => {
  it("dashSignaturePx returns scaled dash array", () => {
    const setback = materialById("setback")!;
    const dash = dashSignaturePx(setback, 2);
    expect(dash).toHaveLength(2);
    expect(dash[0]).toBeGreaterThan(0);
  });

  it("dashSignaturePx returns empty for solid (drafting)", () => {
    const drafting = materialById("drafting")!;
    expect(dashSignaturePx(drafting, 2)).toEqual([]);
  });

  it("mmToPx converts mm at scale to px", () => {
    // (0.5 / 25.4) * 96 * (200 / 200) = 1.8898
    expect(mmToPx(0.5, 200)).toBeCloseTo(1.8898, 3);
  });
});

describe("materialPalette — Phase M.5: greyscale proof", () => {
  it("every semantic markup material is distinguishable from every other in greyscale", () => {
    const markup = materialsByGroup("markup");
    for (let i = 0; i < markup.length; i++) {
      for (let j = i + 1; j < markup.length; j++) {
        const a = markup[i]!;
        const b = markup[j]!;
        expect(
          isGreyscaleDistinguishable(a, b),
          `${a.label} and ${b.label} are not distinguishable in greyscale`,
        ).toBe(true);
      }
    }
  });

  it("greyscaleLuminance returns 0-1 for oklch", () => {
    expect(greyscaleLuminance("oklch(0.48 0.11 145)")).toBeCloseTo(0.48, 2);
  });

  it("greyscaleLuminance returns 0-1 for hex", () => {
    const l = greyscaleLuminance("#f2f0ea");
    expect(l).toBeGreaterThan(0.9);
  });
});
