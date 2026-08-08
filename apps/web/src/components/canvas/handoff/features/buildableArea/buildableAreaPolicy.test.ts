import { describe, expect, it } from "vitest";
import {
  isHighStakesStudioType,
  shouldAutoShowBuildableArea,
} from "./buildableAreaPolicy";

describe("buildableAreaPolicy", () => {
  it("marks deck/paving/frenchdrain high-stakes", () => {
    expect(isHighStakesStudioType("deck")).toBe(true);
    expect(isHighStakesStudioType("lawn")).toBe(false);
  });

  it("auto-shows for high-stakes arm and trench drafting", () => {
    expect(
      shouldAutoShowBuildableArea({
        tool: "add",
        armed: "deck",
      }),
    ).toBe(true);
    expect(
      shouldAutoShowBuildableArea({
        tool: "add",
        armed: "lawn",
      }),
    ).toBe(false);
    expect(
      shouldAutoShowBuildableArea({
        tool: "select",
        armed: null,
        trenchDrafting: true,
      }),
    ).toBe(true);
    expect(
      shouldAutoShowBuildableArea({
        tool: "add",
        armed: "canopy",
        armedSymbolId: "pool",
      }),
    ).toBe(true);
  });
});
