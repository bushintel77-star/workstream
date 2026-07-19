import { describe, expect, it } from "vitest";
import {
  assignElevationLabelStacks,
  elevationLabelOffsetY,
} from "./elevationLabels";

describe("assignElevationLabelStacks", () => {
  it("keeps far labels on baseline", () => {
    const stacks = assignElevationLabelStacks(
      [
        { id: "a", x: 10 },
        { id: "b", x: 40 },
      ],
      12,
    );
    expect(stacks.get("a")).toBe(0);
    expect(stacks.get("b")).toBe(0);
  });

  it("steps near labels upward", () => {
    const stacks = assignElevationLabelStacks(
      [
        { id: "a", x: 20 },
        { id: "b", x: 25 },
        { id: "c", x: 28 },
      ],
      12,
    );
    expect(stacks.get("a")).toBe(0);
    expect(stacks.get("b")).toBe(1);
    expect(stacks.get("c")).toBe(2);
  });
});

describe("elevationLabelOffsetY", () => {
  it("scales by stack index", () => {
    expect(elevationLabelOffsetY(0)).toBe(0);
    expect(elevationLabelOffsetY(2)).toBeCloseTo(5.6);
  });
});
