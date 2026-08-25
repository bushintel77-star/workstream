import { describe, expect, it } from "vitest";
import { SiteEnvelopeSchema } from "@workstream/contracts";
import type { CatalogSymbol } from "@workstream/contracts";
import {
  buildSiteEnvelope,
  rankPaletteForEnvelope,
  sunClassFromHours,
  wetnessFromDrivers,
  worstSunClass,
} from "./planting-envelope";

const MELB = { lat: -37.8136, lng: 144.9631 };

const sym = (over: Partial<CatalogSymbol>): CatalogSymbol => ({
  id: over.id ?? "plant-1",
  label: over.label ?? "Test plant",
  category: over.category ?? "planting",
  path_d: "M0 0",
  ...over,
});

describe("sunClassFromHours / worstSunClass", () => {
  it("bands align with the flora exposure model", () => {
    expect(sunClassFromHours(1.9)).toBe("shade");
    expect(sunClassFromHours(2)).toBe("part_shade");
    expect(sunClassFromHours(4.4)).toBe("part_shade");
    expect(sunClassFromHours(4.5)).toBe("full_sun");
  });

  it("the winter bound wins — planting filters on the least-sun season", () => {
    expect(worstSunClass("full_sun", "shade")).toBe("shade");
    expect(worstSunClass("part_shade", "full_sun")).toBe("part_shade");
  });
});

describe("wetnessFromDrivers", () => {
  it("no drivers = dry; each driver class applies", () => {
    expect(wetnessFromDrivers([]).class).toBe("dry");
    expect(
      wetnessFromDrivers([{ kind: "streams", evidence: "D8 stream network" }]).class,
    ).toBe("moist");
    expect(
      wetnessFromDrivers([{ kind: "wetland_overlay", evidence: "Wetland (Vicmap)" }]).class,
    ).toBe("wet");
  });

  it("the flood overlay dominates every other driver", () => {
    const r = wetnessFromDrivers([
      { kind: "streams", evidence: "D8 stream network" },
      { kind: "flood_overlay", evidence: "LSIO overland flow (Vicmap)" },
      { kind: "wetland_overlay", evidence: "Wetland (Vicmap)" },
    ]);
    expect(r.class).toBe("flood_prone");
    expect(r.drivers).toHaveLength(3);
  });
});

describe("buildSiteEnvelope", () => {
  const env = buildSiteEnvelope({
    lat: MELB.lat,
    lng: MELB.lng,
    month: 9,
    wetnessDrivers: [{ kind: "ponding", evidence: "2 ponding points, max 0.11 m" }],
    slope: { slopeDeg: 4.2, aspect: "S" },
    acidSulfate: true,
    nativeVegetationLabel: "Plains Grassy Woodland",
  });

  it("computes winter ≤ summer sun at Melbourne (real solar geometry)", () => {
    expect(env.seasonalSun).toHaveLength(2);
    const [winter, summer] = env.seasonalSun;
    expect(winter!.preset).toBe("winter");
    expect(summer!.preset).toBe("summer");
    expect(winter!.meanHours).toBeLessThanOrEqual(summer!.meanHours);
    for (const s of env.seasonalSun) {
      const sum = s.classFractions.shade + s.classFractions.part_shade + s.classFractions.full_sun;
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("fuses wetness, slope and soil indicators into the envelope", () => {
    expect(env.wetness.class).toBe("wet");
    expect(env.slope).toEqual({ slopeDeg: 4.2, aspect: "S" });
    expect(env.acidSulfate).toBe(true);
    expect(env.nativeVegetationLabel).toBe("Plains Grassy Woodland");
    expect(env.summaryLine).toContain("·");
  });

  it("round-trips the zod contract — schema and builder cannot drift", () => {
    const parsed = SiteEnvelopeSchema.parse(env);
    expect(parsed.summaryLine).toBe(env.summaryLine);
    expect(parsed.seasonalSun[0]!.preset).toBe("winter");
  });
});

describe("rankPaletteForEnvelope", () => {
  const palette = [
    sym({ id: "lavender", label: "Lavender", sun: "full", water: "low" }),
    sym({ id: "lily-turf", label: "Liriope", sun: "shade", water: "moderate" }),
    sym({ id: "grevillea", label: "Grevillea", sun: "full", water: "low" }),
    sym({ id: "paving", label: "Bluestone", category: "hardscape" as CatalogSymbol["category"] }),
  ];

  it("a full-sun dry site ranks drought-lovers first and drops the shade plant", () => {
    const ranked = rankPaletteForEnvelope(palette, {
      plantingSunClass: "full_sun",
      wetness: { class: "dry" },
    });
    expect(ranked.map((r) => r.symbolId)).toEqual(["lavender", "grevillea", "lily-turf"]);
    const lily = ranked.find((r) => r.symbolId === "lily-turf")!;
    // Shade plant on a full-sun dry site: 0.1×0.65 + 0.55×0.35 = 0.2575 —
    // ranked last, deep in the poor-fit zone (surfaces drop < 0.25).
    expect(lily.fit).toBeLessThan(0.3);
    expect(lily.fit).toBeGreaterThanOrEqual(0.25);
    expect(ranked[ranked.length - 1]!.symbolId).toBe("lily-turf");
    expect(lily.why).toContain("Full sun site");
  });

  it("a flood-prone site flips the palette toward waterlogging-tolerant stock", () => {
    const melaleuca = sym({ id: "melaleuca", label: "Melaleuca", sun: "full", water: "high" });
    const ranked = rankPaletteForEnvelope([...palette.slice(0, 1), melaleuca], {
      plantingSunClass: "full_sun",
      wetness: { class: "flood_prone" },
    });
    expect(ranked[0]!.symbolId).toBe("melaleuca");
    // The drought-lover survives sun but is heavily penalised for water.
    const lavender = ranked.find((r) => r.symbolId === "lavender")!;
    expect(lavender.fit).toBeLessThan(0.7);
    expect(lavender.why).toContain("flood prone");
  });

  it("non-planting symbols never enter the palette", () => {
    const ranked = rankPaletteForEnvelope(palette, {
      plantingSunClass: "part_shade",
      wetness: { class: "moist" },
    });
    expect(ranked.some((r) => r.symbolId === "paving")).toBe(false);
  });
});
