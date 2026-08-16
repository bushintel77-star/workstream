import { describe, expect, it } from "vitest";
import { canvasLayerPolicy } from "./layerPolicy";

describe("canvasLayerPolicy (mode-driven layer law)", () => {
  it("CAD keeps the site image below accepted geometry without a murky drafting ground", () => {
    const p = canvasLayerPolicy("cad");
    expect(p.aerialOpacity).toBeGreaterThan(0);
    expect(p.subsurface).toBe(false);
    expect(p.utilities).toBe(false);
    expect(p.easements).toBe(true);
    expect(p.draftingSurface).toBe(false);
  });

  it("SKETCH is trace-friendly — full aerial/photo base under the ink", () => {
    const p = canvasLayerPolicy("sketch");
    expect(p.aerialOpacity).toBeGreaterThan(0.7);
    expect(p.subsurface).toBe(false);
    expect(p.utilities).toBe(false);
    // The title line stays legible while tracing.
    expect(p.easements).toBe(true);
  });

  it("SURVEY owns the subsurface works — blueprint ground + utilities", () => {
    const p = canvasLayerPolicy("survey");
    expect(p.subsurface).toBe(true);
    expect(p.utilities).toBe(true);
    expect(p.easements).toBe(true);
    // Aerial recedes so the utility ink reads.
    expect(p.aerialOpacity).toBeLessThan(canvasLayerPolicy("sketch").aerialOpacity);
  });

  it("presentation contexts keep the full aerial and utilities available", () => {
    for (const mode of ["garden", "quote", "present", "share"] as const) {
      const p = canvasLayerPolicy(mode);
      expect(p.aerialOpacity).toBeGreaterThan(0.7);
      expect(p.utilities).toBe(true);
      expect(p.draftingSurface).toBe(false);
    }
  });
});
