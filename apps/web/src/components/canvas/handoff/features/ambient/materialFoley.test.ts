import { describe, expect, it } from "vitest";
import { materialFamilyFor } from "./materialFoley";

describe("materialFamilyFor", () => {
  it("maps timber concepts to wood", () => {
    expect(materialFamilyFor("deck")).toBe("wood");
    expect(materialFamilyFor("hedge")).toBe("wood");
  });

  it("maps hardscape to stone and softscape to soil/leaf", () => {
    expect(materialFamilyFor("paving")).toBe("stone");
    expect(materialFamilyFor("lawn")).toBe("soil");
    expect(materialFamilyFor("bed")).toBe("soil");
    expect(materialFamilyFor("canopy")).toBe("softscape");
  });
});
