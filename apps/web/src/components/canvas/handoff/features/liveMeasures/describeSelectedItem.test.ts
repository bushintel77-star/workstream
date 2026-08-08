import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED, type StudioItem } from "../../studioCatalog";
import { describeSelectedItem } from "./describeSelectedItem";

describe("describeSelectedItem", () => {
  it("reports an existing tree as a canopy diameter", () => {
    const exist = WRIGHTS_SEED.items.find((i) => i.t === "exist")!;
    const readout = describeSelectedItem(exist);
    expect(readout.value.startsWith("⌀")).toBe(true);
    expect(readout.value.endsWith("m")).toBe(true);
  });

  it("scales the measurement with the item scale", () => {
    const base: StudioItem = {
      id: "a",
      t: "paving",
      x: 50,
      y: 50,
      rot: 0,
      scale: 1,
      ghost: false,
    };
    const bigger: StudioItem = { ...base, scale: 2 };
    const small = Number.parseFloat(describeSelectedItem(base).value);
    const large = Number.parseFloat(describeSelectedItem(bigger).value);
    expect(large).toBeGreaterThan(small);
  });
});
