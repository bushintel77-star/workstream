import { describe, expect, it } from "vitest";
import { detectMode } from "./mode-detect";

describe("detectMode", () => {
  it("classifies empty / missing transcript as auto", () => {
    expect(detectMode(null).mode).toBe("auto");
    expect(detectMode("").mode).toBe("auto");
    expect(detectMode("   ").mode).toBe("auto");
  });

  it("classifies very short briefs as auto", () => {
    expect(detectMode("rear yard, nice planting").mode).toBe("auto");
  });

  it("classifies partial briefs as gapfill", () => {
    const result = detectMode(
      "The front garden needs a lawn turf area with a single feature tree planted near the entry. The client wants low maintenance design and some lighting at night for the path. Keep it simple but architectural in style. No irrigation required.",
    );
    expect(result.mode).toBe("gapfill");
    expect(result.word_count).toBeGreaterThan(25);
    expect(result.coverage).toBeGreaterThanOrEqual(0.2);
  });

  it("classifies a comprehensive brief as validate", () => {
    const brief = `
      The front garden needs mass planting of Lomandra with a Capital Pear screen
      along the verge. The rear terrace gets bluestone paving and a pleached
      hornbeam hedge on the western boundary, clipped at two point four metres.
      Drip irrigation throughout the planted areas, brass uplights at the trees,
      and a small lawn area at the back for the dog. The driveway concrete edge
      needs reworking with a fresh in-situ pour. The garden bed near the back
      door needs underplanting with native groundcover. Existing trees on the
      eastern boundary stay. Stepping stones from the rear terrace to the side
      gate, set in pebble.
    `;
    const result = detectMode(brief);
    expect(result.mode).toBe("validate");
    expect(result.word_count).toBeGreaterThanOrEqual(80);
    expect(result.coverage).toBeGreaterThanOrEqual(0.7);
  });
});
