import { describe, expect, it } from "vitest";
import {
  canvasLayerPolicy,
  layerScaleAlpha,
  SCALE_BANDS,
  viewScaleRatioForZoom,
} from "./layerPolicy";

describe("canvasLayerPolicy (mode-driven layer law)", () => {
  it("CAD is clean drafting on paper — no photo base, no murky ground", () => {
    const p = canvasLayerPolicy("cad");
    expect(p.subsurface).toBe(false);
    expect(p.utilities).toBe(false);
    expect(p.easements).toBe(true);
    // Drafting context: the ground is a sheet to draw on, not a material.
    expect(p.groundAlbedo).toBe("paper");
  });

  it("SKETCH is a clean paper trace surface — ink is the only texture", () => {
    const p = canvasLayerPolicy("sketch");
    expect(p.subsurface).toBe(false);
    expect(p.utilities).toBe(false);
    // The title line stays legible while tracing.
    expect(p.easements).toBe(true);
  });

  it("SURVEY owns the subsurface works but does not force the blueprint ground", () => {
    const p = canvasLayerPolicy("survey");
    // Forcing this made Step 0 the only mode that never showed paper: the
    // subsurface view lerps the ground to the blueprint vellum. The Underground
    // rail toggle is the operator override.
    expect(p.subsurface).toBe(false);
    expect(p.utilities).toBe(true);
    expect(p.easements).toBe(true);
  });

  it("no mode force-arms the blueprint ground", () => {
    for (const mode of [
      "survey",
      "sketch",
      "cad",
      "elevation",
      "garden",
      "quote",
      "present",
      "share",
    ] as const) {
      expect(
        canvasLayerPolicy(mode).subsurface,
        `${mode} must leave the subsurface view to the operator`,
      ).toBe(false);
    }
  });

  it("presentation contexts keep utilities on paper ground", () => {
    for (const mode of ["garden", "quote", "present", "share"] as const) {
      const p = canvasLayerPolicy(mode);
      expect(p.utilities).toBe(true);
      // All modes now rest on paper (#F4F4F4) — the olive ground-bounce was
      // shifting the perceived canvas colour away from the binding token.
      expect(p.groundAlbedo).toBe("paper");
    }
  });

  it("the drafting modes rest on paper — the only way #F4F4F4 is reachable", () => {
    // The ground mesh spans GROUND_CONTEXT_EXTENT boards, 2.3x the visible
    // frame at zoom 1, so its albedo IS the operator's background. While every
    // mode rested on groundOlive the canvas clear colour was unreachable
    // without zooming out past 0.43.
    for (const mode of ["survey", "sketch", "cad", "elevation"] as const) {
      expect(canvasLayerPolicy(mode).groundAlbedo, mode).toBe("paper");
    }
  });
});

describe("viewScaleRatioForZoom", () => {
  it("inverts zoom (1 = fit, >1 = zoomed out, <1 = zoomed in)", () => {
    expect(viewScaleRatioForZoom(1)).toBe(1);
    expect(viewScaleRatioForZoom(0.1)).toBe(10); // max zoom-out
    expect(viewScaleRatioForZoom(50)).toBeCloseTo(0.02); // max zoom-in
  });

  it("collapses degenerate zoom to the fit ratio", () => {
    expect(viewScaleRatioForZoom(0)).toBe(1);
    expect(viewScaleRatioForZoom(Number.NaN)).toBe(1);
  });
});

describe("layerScaleAlpha (scale-band cross-fade)", () => {
  const sketch = SCALE_BANDS.sketchInk; // [0.1, 2], fade ±5%

  it("is fully visible inside the window", () => {
    expect(layerScaleAlpha("sketchInk", 1)).toBe(1);
    expect(layerScaleAlpha("sketchInk", 0.5)).toBe(1);
    expect(layerScaleAlpha("cadLinework", 4)).toBe(1);
  });

  it("is invisible past the fade window", () => {
    expect(layerScaleAlpha("sketchInk", 0.09)).toBe(0); // below minLo
    expect(layerScaleAlpha("sketchInk", 2.5)).toBe(0); // above maxHi
    expect(layerScaleAlpha("dims", 10)).toBe(0);
  });

  it("sits at 50% on the nominal band edges (the ±5% fade straddles)", () => {
    // minFit = 0.1: fade band [0.095, 0.105] → 0.5 at 0.1.
    expect(layerScaleAlpha("sketchInk", sketch.minFit)).toBeCloseTo(0.5, 9);
    // maxFit = 2: fade band [1.9, 2.1] → 0.5 at 2.
    expect(layerScaleAlpha("sketchInk", sketch.maxFit)).toBeCloseTo(0.5, 9);
    // plantSymbol [0.3, 3.5] edges behave the same.
    expect(layerScaleAlpha("plantSymbol", 0.3)).toBeCloseTo(0.5, 9);
    expect(layerScaleAlpha("plantSymbol", 3.5)).toBeCloseTo(0.5, 9);
  });

  it("cross-fades linearly through the fade band (no hard swap)", () => {
    // Low edge: 75% at the 3/4 point of [0.095, 0.105].
    expect(layerScaleAlpha("sketchInk", 0.1025)).toBeCloseTo(0.75, 9);
    // High edge: 25% at the 3/4 point of [1.9, 2.1].
    expect(layerScaleAlpha("sketchInk", 2.05)).toBeCloseTo(0.25, 9);
    // Continuity: values inside the fade band are partial, never a hard swap.
    expect(layerScaleAlpha("sketchInk", 1.905)).toBeCloseTo(0.975, 9);
    expect(layerScaleAlpha("sketchInk", 2.095)).toBeCloseTo(0.025, 9);
  });

  it("zooming out dissolves detail first, then CAD, keeping the site frame", () => {
    // At 4× zoom-out: sketch ink gone, dims mid-fade, CAD linework alive,
    // site frame (the anchor) untouched.
    expect(layerScaleAlpha("sketchInk", 4)).toBe(0);
    expect(layerScaleAlpha("dims", 4)).toBeCloseTo(0.5, 9);
    expect(layerScaleAlpha("cadLinework", 4)).toBe(1);
    expect(layerScaleAlpha("plantSymbol", 4)).toBe(0);
    expect(layerScaleAlpha("siteFrame", 4)).toBe(1);
  });

  it("siteFrame never fades at any reachable or absurd scale", () => {
    for (const ratio of [0.001, 0.02, 0.5, 1, 10, 100, 1e6]) {
      expect(layerScaleAlpha("siteFrame", ratio)).toBe(1);
    }
  });

  it("bands express the documented drawing-scale intent (1:1 detail → 1:500 macro)", () => {
    // Fit view (ratio 1) ≈ working 1:50 — everything but nothing has faded.
    expect(layerScaleAlpha("sketchInk", 1)).toBe(1);
    expect(layerScaleAlpha("cadLinework", 1)).toBe(1);
    // Max zoom-out (ratio 10 ≈ 1:500+): only the site frame remains.
    expect(layerScaleAlpha("cadLinework", 10)).toBe(0);
    expect(layerScaleAlpha("siteFrame", 10)).toBe(1);
    // sketchInk fades strictly before cadLinework on the way out.
    expect(layerScaleAlpha("sketchInk", 2.2)).toBeLessThan(
      layerScaleAlpha("cadLinework", 2.2),
    );
  });

  it("degenerate view ratios collapse to the fit state (fully visible)", () => {
    // Non-finite ratios can't come from the clamped rig — collapse to fit.
    expect(layerScaleAlpha("sketchInk", Number.NaN)).toBe(1);
    expect(layerScaleAlpha("sketchInk", Number.POSITIVE_INFINITY)).toBe(1);
  });
});
