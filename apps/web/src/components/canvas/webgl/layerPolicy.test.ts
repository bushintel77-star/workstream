import { describe, expect, it } from "vitest";
import { canvasLayerPolicy } from "./layerPolicy";

describe("canvasLayerPolicy (mode-driven layer law)", () => {
  it("CAD is clean drafting on paper — no photo base, no murky ground", () => {
    const p = canvasLayerPolicy("cad");
    expect(p.subsurface).toBe(false);
    expect(p.utilities).toBe(false);
    expect(p.easements).toBe(true);
    expect(p.draftingSurface).toBe(false);
  });

  it("SKETCH is a clean paper trace surface — ink is the only texture", () => {
    const p = canvasLayerPolicy("sketch");
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
  });

  it("presentation contexts keep utilities available on paper", () => {
    for (const mode of ["garden", "quote", "present", "share"] as const) {
      const p = canvasLayerPolicy(mode);
      expect(p.utilities).toBe(true);
      expect(p.draftingSurface).toBe(false);
    }
  });
});
