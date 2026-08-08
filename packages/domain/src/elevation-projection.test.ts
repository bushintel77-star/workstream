import { describe, expect, it } from "vitest";
import {
  cycleElevationLook,
  elevationLookPair,
  elevationLookProjector,
  preferBrochureElevLook,
  projectElevationItems,
} from "./elevation-projection";

const sample = [
  {
    id: "a",
    label: "West tree",
    x_pct: 20,
    y_pct: 40,
    height_m: 4,
  },
  {
    id: "b",
    label: "East tree",
    x_pct: 80,
    y_pct: 60,
    height_m: 3,
  },
];

describe("elevationLookProjector", () => {
  it("maps N/S to x and E/W to y", () => {
    expect(elevationLookProjector("N").axis).toBe("x");
    expect(elevationLookProjector("S").axis).toBe("x");
    expect(elevationLookProjector("E").axis).toBe("y");
    expect(elevationLookProjector("W").axis).toBe("y");
  });

  it("reverses opposite looks", () => {
    expect(elevationLookProjector("N").reverse).toBe(false);
    expect(elevationLookProjector("S").reverse).toBe(true);
    expect(elevationLookProjector("E").reverse).toBe(false);
    expect(elevationLookProjector("W").reverse).toBe(true);
  });

  it("cycles N→E→S→W→N", () => {
    expect(cycleElevationLook("N")).toBe("E");
    expect(cycleElevationLook("W")).toBe("N");
    expect(elevationLookPair("N")).toBe("E");
  });
});

describe("projectElevationItems", () => {
  it("looking north keeps west→east left→right", () => {
    const { items, look } = projectElevationItems(sample, "N");
    expect(look).toBe("N");
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("looking south mirrors east→west left→right", () => {
    const { items } = projectElevationItems(sample, "S");
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("looking east projects y ascending", () => {
    const { items } = projectElevationItems(sample, "E");
    expect(items[0]!.id).toBe("a");
    expect(items[1]!.id).toBe("b");
  });

  it("legacy front/side map to N/E", () => {
    expect(projectElevationItems(sample, "front").look).toBe("N");
    expect(projectElevationItems(sample, "side").look).toBe("E");
  });
});

describe("projectElevationItems — symbol-derived heights", () => {
  const placed = [
    { id: "t1", label: "Canopy tree · 7.8 m", x_pct: 30, y_pct: 50, symbol_id: "curtis-tree-780" },
    { id: "h1", label: "Clipped hedge · 1.4 m", x_pct: 50, y_pct: 50, symbol_id: "curtis-hedge-140" },
    { id: "h2", label: "Clipped hedge · 1.2 m", x_pct: 60, y_pct: 50, symbol_id: "curtis-hedge-120" },
    { id: "d1", label: "Timber deck · 0.5 m", x_pct: 70, y_pct: 50, symbol_id: "curtis-deck-050" },
    { id: "p1", label: "Bluestone", x_pct: 80, y_pct: 50, symbol_id: "bluestone-paver" },
  ];

  it("reads the ladder height off the placed symbol", () => {
    const { items } = projectElevationItems(placed, "N");
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("t1")!.heightM).toBe(7.8);
    expect(byId.get("h1")!.heightM).toBe(1.4);
    expect(byId.get("h2")!.heightM).toBe(1.2);
    expect(byId.get("d1")!.heightM).toBe(0.5);
  });

  it("tags the silhouette family per item", () => {
    const { items } = projectElevationItems(placed, "N");
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("t1")!.family).toBe("tree");
    expect(byId.get("h1")!.family).toBe("hedge");
    expect(byId.get("d1")!.family).toBe("deck");
  });

  it("marks flat paving as having no elevation presence", () => {
    const { items } = projectElevationItems(placed, "N");
    const paving = items.find((i) => i.id === "p1")!;
    expect(paving.hasPresence).toBe(false);
    expect(items.filter((i) => i.hasPresence).map((i) => i.id)).toEqual([
      "t1",
      "h1",
      "h2",
      "d1",
    ]);
  });

  it("reports the tallest drawn height, ignoring guessed items", () => {
    expect(projectElevationItems(placed, "N").maxHeightM).toBe(7.8);
    expect(
      projectElevationItems([{ id: "p1", label: "Bluestone", x_pct: 10, y_pct: 10, symbol_id: "bluestone-paver" }], "N")
        .maxHeightM,
    ).toBe(0);
  });

  it("applies placement scale to the drawn height but not the mature height", () => {
    const { items } = projectElevationItems(
      [{ id: "t1", label: "Tree", x_pct: 50, y_pct: 50, symbol_id: "curtis-tree-780", scale: 0.5 }],
      "N",
    );
    expect(items[0]!.matureHeightM).toBe(7.8);
    expect(items[0]!.heightM).toBe(3.9);
    expect(items[0]!.scale).toBe(0.5);
  });

  it("an explicit height overrides the symbol", () => {
    const { items } = projectElevationItems(
      [{ id: "t1", label: "Tree", x_pct: 50, y_pct: 50, symbol_id: "curtis-tree-780", height_m: 2 }],
      "N",
    );
    expect(items[0]!.heightM).toBe(2);
    expect(items[0]!.hasPresence).toBe(true);
  });

  it("guesses only when neither caller nor symbol knows a height", () => {
    const { items } = projectElevationItems(
      [
        { id: "x", label: "Mystery tree", x_pct: 20, y_pct: 20 },
        { id: "y", label: "Mystery thing", x_pct: 40, y_pct: 20 },
      ],
      "N",
    );
    expect(items[0]!.heightM).toBe(4);
    expect(items[0]!.hasPresence).toBe(false);
    expect(items[1]!.heightM).toBe(1.2);
    expect(items[1]!.hasPresence).toBe(false);
  });

  it("derives bar width from real spread when the board scale is known", () => {
    const { items } = projectElevationItems(placed, "N", { boardWidthM: 110 });
    const byId = new Map(items.map((i) => [i.id, i]));
    // 6.5 m canopy on a 110 m board ≈ 5.9%
    expect(byId.get("t1")!.widthPct).toBeCloseTo(5.909, 2);
    // A 0.6 m hedge would fall below the floor — clamped so it still draws.
    expect(byId.get("h2")!.widthPct).toBe(0.6);
    // Wide canopy reads wider than a narrow hedge.
    expect(byId.get("t1")!.widthPct).toBeGreaterThan(byId.get("h1")!.widthPct);
  });

  it("falls back to indicative widths without a board scale", () => {
    const { items } = projectElevationItems(placed, "N");
    expect(items.every((i) => i.widthPct >= 2)).toBe(true);
  });

  it("honours the building envelope height", () => {
    expect(projectElevationItems(placed, "N").buildingH).toBe(2.7);
    expect(
      projectElevationItems(placed, "N", { buildingHeightM: 5.2 }).buildingH,
    ).toBe(5.2);
  });
});

describe("preferBrochureElevLook", () => {
  it("picks N when the dwelling is wider east-west", () => {
    expect(
      preferBrochureElevLook([
        { x: 20, y: 40 },
        { x: 80, y: 40 },
        { x: 80, y: 55 },
        { x: 20, y: 55 },
      ]),
    ).toBe("N");
  });

  it("picks E when the dwelling is taller north-south", () => {
    expect(
      preferBrochureElevLook([
        { x: 40, y: 20 },
        { x: 55, y: 20 },
        { x: 55, y: 80 },
        { x: 40, y: 80 },
      ]),
    ).toBe("E");
  });
});
