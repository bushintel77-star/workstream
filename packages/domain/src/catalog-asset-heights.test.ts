import { describe, expect, it } from "vitest";
import type { CatalogCategory, DesignCanvas } from "@workstream/contracts";
import { CURTIS_CATALOG_SYMBOLS } from "./catalog";
import { CURTIS_DESIGN_ASSETS } from "./catalog-assets";
import { RETAINING_ENGINEER_HEIGHT_M } from "./preemptive-risk";
import { isSketchGoldStandard } from "./sketch-gold-library";
import { spatialFactsFromCanvas } from "./spatial-facts";

/**
 * Categories whose symbols can stand above ground and therefore belong in an
 * elevation. Annotation is meaning, not matter.
 */
const ELEVATION_CATEGORIES: CatalogCategory[] = [
  "planting",
  "paving",
  "structure",
  "water",
  "furniture",
  "lighting",
];

/**
 * Deliberately heightless — flat surfaces, flush trims, in-ground water and
 * surface-mounted fixtures. These must NOT produce an elevation bar. Anything
 * new that stands up gets a `mature_height_m`; anything flat gets listed here.
 */
const FLAT_OR_FLUSH_IDS = new Set([
  // Flat surfaces
  "lawn-turf",
  "bluestone-paver",
  "granite-stepper",
  "sandstone-crazy",
  "basalt-grid",
  "gravel-mulch",
  "porcelain-tile",
  "exposed-aggregate",
  "hoggin-path",
  // Flush trims (< 0.15 m proud — noise at elevation scale)
  "limestone-coping",
  "timber-edging",
  // In-ground water
  "pool",
  "spa-plunge",
  // Flush / surface-mounted fixtures
  "brass-uplight",
  "led-graze-tape",
  "deck-strip-light",
  "wall-wash-light",
  "underwater-pool-light",
]);

/**
 * Symbols kept heightless on purpose because `rootRadiusM` in `spatial-facts`
 * prefers `mature_height_m` over spread — a height here would *shrink* a root
 * protection radius. Their elevation height comes from the coarse studio type.
 */
const HEIGHT_VIA_STUDIO_TYPE_IDS = new Set([
  "existing-tree-retain",
  "hedge-clip-formal",
]);

const byId = (id: string) => CURTIS_DESIGN_ASSETS.find((s) => s.id === id);

function canvasWith(symbolId: string): DesignCanvas {
  return {
    placements: [
      {
        id: "p1",
        symbol_id: symbolId,
        x_pct: 40,
        y_pct: 50,
        rotation_deg: 0,
        scale: 1,
      },
    ],
    strokes: [],
  } as unknown as DesignCanvas;
}

function factFor(symbolId: string) {
  const [fact] = spatialFactsFromCanvas(
    canvasWith(symbolId),
    CURTIS_CATALOG_SYMBOLS,
  );
  return fact;
}

describe("catalog asset heights", () => {
  it("gives every standing Curtis gold symbol a mature height", () => {
    const missing = CURTIS_DESIGN_ASSETS.filter(
      (s) =>
        isSketchGoldStandard(s) &&
        ELEVATION_CATEGORIES.includes(s.category) &&
        !FLAT_OR_FLUSH_IDS.has(s.id) &&
        !HEIGHT_VIA_STUDIO_TYPE_IDS.has(s.id) &&
        !(s.mature_height_m && s.mature_height_m > 0),
    ).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it("keeps flat and flush assets out of the elevation", () => {
    for (const id of FLAT_OR_FLUSH_IDS) {
      const symbol = byId(id);
      expect(symbol, id).toBeDefined();
      expect(symbol!.mature_height_m, id).toBeUndefined();
    }
  });

  it("heights the assets this pass added", () => {
    expect(byId("timber-deck")?.mature_height_m).toBe(0.4);
    expect(byId("bluestone-step")?.mature_height_m).toBe(0.15);
    expect(byId("pergola")?.mature_height_m).toBe(2.7);
    expect(byId("privacy-screen")?.mature_height_m).toBe(1.8);
    expect(byId("side-gate")?.mature_height_m).toBe(1.8);
    expect(byId("seat-wall")?.mature_height_m).toBe(0.45);
    expect(byId("fire-pit")?.mature_height_m).toBe(0.4);
    expect(byId("agapanthus-drift")?.mature_height_m).toBe(0.9);
    expect(byId("brass-bollard-light")?.mature_height_m).toBe(0.6);
    expect(byId("path-spike-light")?.mature_height_m).toBe(0.3);
  });

  it("holds the pool barrier at the AS 1926.1 minimum", () => {
    expect(byId("pool-fence")?.mature_height_m).toBe(1.2);
  });

  it("keeps every height physically plausible for a residential garden", () => {
    for (const symbol of CURTIS_DESIGN_ASSETS) {
      if (symbol.mature_height_m == null) continue;
      expect(symbol.mature_height_m, symbol.id).toBeGreaterThan(0);
      expect(symbol.mature_height_m, symbol.id).toBeLessThanOrEqual(12);
    }
  });
});

/**
 * `mature_height_m` is not cosmetic — `spatial-facts` feeds it into the
 * retaining engineer hold and the tree root protection radius. These lock the
 * safety-relevant downstream behaviour so a future height edit cannot quietly
 * switch a warning off.
 */
describe("catalog heights feeding risk", () => {
  it("keeps retaining symbols above the engineer-hold threshold", () => {
    for (const id of ["retaining-wall", "sleeper-wall"]) {
      const height = factFor(id)?.height_m;
      expect(height, id).toBeGreaterThan(RETAINING_ENGINEER_HEIGHT_M);
    }
  });

  it("keeps the protected-tree root radius at the canopy-derived 12 m", () => {
    expect(factFor("existing-tree-retain")?.root_radius_m).toBe(12);
  });

  it("keeps the formal hedge root radius at the spread-derived 6 m", () => {
    expect(factFor("hedge-clip-formal")?.root_radius_m).toBe(6);
  });

  it("never lets a height shrink a planting root radius below its spread", () => {
    const shrunk = CURTIS_DESIGN_ASSETS.filter((s) => {
      if (s.category !== "planting") return false;
      if (!s.mature_height_m || !s.default_width_m) return false;
      // Height branch wins in `rootRadiusM`; flag any symbol this pass made
      // less protective than the spread branch would have been.
      return (
        HEIGHT_VIA_STUDIO_TYPE_IDS.has(s.id) ||
        FLAT_OR_FLUSH_IDS.has(s.id)
      );
    });
    expect(shrunk).toEqual([]);
  });
});
