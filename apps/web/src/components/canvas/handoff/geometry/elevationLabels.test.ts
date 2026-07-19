import { describe, expect, it } from "vitest";
import {
  assignElevationLabelStacks,
  elevationLabelOffsetY,
  elevationLabelText,
  layoutElevationLabels,
  shortenElevationTag,
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
    expect(elevationLabelOffsetY(2)).toBeCloseTo(6);
  });
});

describe("shortenElevationTag", () => {
  it("compresses verbose catalog tags", () => {
    expect(shortenElevationTag("Existing tree · DBH 450")).toBe("Existing");
    expect(shortenElevationTag("Canopy tree")).toBe("Canopy");
    expect(shortenElevationTag("Feature tree")).toBe("Feature");
  });
});

describe("layoutElevationLabels", () => {
  it("keeps masks inside the viewBox", () => {
    const placed = layoutElevationLabels([
      {
        id: "edge",
        barX: 2,
        barTopY: 8,
        text: elevationLabelText("Existing tree · DBH 450", 8),
      },
      {
        id: "near",
        barX: 8,
        barTopY: 12,
        text: elevationLabelText("Canopy tree", 4.2),
      },
      {
        id: "near2",
        barX: 10,
        barTopY: 14,
        text: elevationLabelText("Feature tree", 3.2),
      },
      {
        id: "hedge",
        barX: 14,
        barTopY: 30,
        text: elevationLabelText("Hedge", 0.9),
      },
    ]);

    expect(placed).toHaveLength(4);
    for (const p of placed) {
      const left = p.x - p.maskW / 2;
      const right = p.x + p.maskW / 2;
      const top = p.y - 2.15;
      expect(left).toBeGreaterThanOrEqual(1.1);
      expect(right).toBeLessThanOrEqual(98.9);
      expect(top).toBeGreaterThanOrEqual(1.1);
    }

    // Near bars must not share the same mask box
    const a = placed.find((p) => p.id === "near")!;
    const b = placed.find((p) => p.id === "near2")!;
    const sameSlot =
      Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
    expect(sameSlot).toBe(false);
  });

  it("shortens existing-tree callouts so they fit", () => {
    expect(elevationLabelText("Existing tree · DBH 450", 8)).toBe(
      "Existing · 8.0 m",
    );
  });
});
