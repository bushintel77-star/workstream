import { describe, expect, it } from "vitest";
import { boundaryAreaM2, buildMetaChips, steepestFall } from "./metaChips";

const SQUARE = [
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 50, y: 50 },
  { x: 0, y: 50 },
];

describe("boundaryAreaM2", () => {
  it("scales a board-% ring into real square metres", () => {
    // 50×50 board-% at 110 m board width, aspect 1 → 55×55 m = 3025 m²
    expect(boundaryAreaM2(SQUARE, 110, 1)).toBeCloseTo(3025, 6);
  });

  it("accounts for non-square board aspect", () => {
    // aspect 0.5 → world 55 × 27.5 = 1512.5 m²
    expect(boundaryAreaM2(SQUARE, 110, 0.5)).toBeCloseTo(1512.5, 6);
  });

  it("returns zero for degenerate rings", () => {
    expect(boundaryAreaM2([{ x: 0, y: 0 }, { x: 10, y: 10 }], 110, 1)).toBe(0);
    expect(boundaryAreaM2([], 110, 1)).toBe(0);
  });
});

describe("steepestFall", () => {
  it("finds the steepest adjacent spot-level fall and its aspect", () => {
    const levels = [
      { x: 0, z: 0, y: 10 },
      { x: 10, z: 0, y: 10 },
      { x: 0, z: 10, y: 5 }, // 50% fall toward +z (south)
      { x: 5, z: 5, y: 7 },
    ];
    const fall = steepestFall(levels)!;
    expect(fall.slopePct).toBeCloseTo(50, 6);
    expect(fall.aspect).toBe("S");
  });

  it("returns null without at least two levels", () => {
    expect(steepestFall([])).toBeNull();
    expect(steepestFall([{ x: 0, z: 0, y: 1 }])).toBeNull();
  });

  it("reports east/west aspect when the horizontal fall dominates", () => {
    const levels = [
      { x: 0, z: 0, y: 10 },
      { x: 10, z: 0, y: 0 }, // falling toward +x (east)
    ];
    expect(steepestFall(levels)!.aspect).toBe("E");
  });
});

describe("buildMetaChips", () => {
  it("returns no chips for an empty site", () => {
    expect(buildMetaChips({})).toEqual([]);
  });

  it("builds the cadastral group from the title record", () => {
    const chips = buildMetaChips({
      titleRef: "1\\TP84291",
      lga: "Boroondara",
      lotAreaM2: 642,
    });
    const byId = Object.fromEntries(chips.map((c) => [c.id, c]));
    expect(byId.spi.label).toBe("SPI 1\\TP84291");
    expect(byId.parcel.label).toBe("642 m²");
    expect(byId.lga.label).toBe("LGA: Boroondara");
    expect(byId.spi.brightModes).toEqual(["survey", "cad"]);
  });

  it("labels a plain parcel reference as PFI, never a fabricated SPI", () => {
    const chips = buildMetaChips({ titleRef: "2298641" });
    expect(chips.find((c) => c.id === "spi")!.label).toBe("PFI 2298641");
  });

  it("derives parcel area from the boundary ring when the title omits it", () => {
    const chips = buildMetaChips({ boundary: SQUARE, scaleM: 110, boardAspect: 1 });
    const parcel = chips.find((c) => c.id === "parcel")!;
    expect(parcel.label).toBe("3,025 m²");
  });

  it("maps keyless overlays onto planning chips with honest labels", () => {
    const chips = buildMetaChips({
      overlays: [
        { kind: "planning", rings: [], label: "NRZ3" },
        { kind: "heritage", rings: [], label: "HO171" },
        { kind: "flood", rings: [] },
      ],
    });
    const byId = Object.fromEntries(chips.map((c) => [c.id, c]));
    expect(byId.zone.label).toBe("NRZ3 Zone");
    expect(byId.heritage.label).toBe("HO171 Heritage");
    expect(byId.flood.label).toBe("Overland Flow");
  });

  it("counts easements from rings", () => {
    const chips = buildMetaChips({ easementRingCount: 2 });
    const easement = chips.find((c) => c.id === "easement")!;
    expect(easement.label).toBe("2 Easements");
  });

  it("builds the terrain group from spot levels and sun hours", () => {
    const chips = buildMetaChips({
      heightmap: [
        { x: 0, z: 0, y: 10 },
        { x: 10, z: 0, y: 9.9 },
        { x: 0, z: 10, y: 5 },
      ],
      sunHours: 5.8,
    });
    const byId = Object.fromEntries(chips.map((c) => [c.id, c]));
    expect(byId.slope.label).toContain("Slope");
    expect(byId.slope.brightModes).toEqual(["elevation", "garden"]);
    expect(byId.sun.label).toBe("5.8h Sun Window");
    expect(byId.relief.label).toBe("Spot levels · 3");
  });

  it("never invents terrain chips without data", () => {
    const chips = buildMetaChips({ titleRef: "1\\TP1" });
    expect(chips.some((c) => c.group === "terrain")).toBe(false);
    expect(chips.some((c) => c.group === "planning")).toBe(false);
  });

  it("emits the zone chip only when a planning overlay exists", () => {
    expect(buildMetaChips({}).some((c) => c.id === "zone")).toBe(false);
    const chips = buildMetaChips({
      overlays: [{ kind: "planning", rings: [], label: "NRZ3" }],
    });
    expect(chips.find((c) => c.id === "zone")!.label).toBe("NRZ3 Zone");
  });
});
