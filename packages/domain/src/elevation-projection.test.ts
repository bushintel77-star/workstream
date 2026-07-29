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
