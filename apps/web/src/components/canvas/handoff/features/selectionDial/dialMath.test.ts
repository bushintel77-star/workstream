import { describe, expect, it } from "vitest";
import {
  dialArcAngles,
  dialOffsetPx,
  emptiestDialSide,
  snapRotDetent,
} from "./dialMath";
import type { StudioItem } from "../../studioCatalog";

function item(id: string, x: number, y: number): StudioItem {
  return { id, t: "canopy", x, y, rot: 0, scale: 1, ghost: false };
}

describe("dialMath", () => {
  it("picks the emptiest half-plane", () => {
    const centre = { x: 50, y: 50 };
    const items = [
      item("self", 50, 50),
      item("a", 30, 50),
      item("b", 28, 48),
      item("c", 70, 50),
    ];
    expect(emptiestDialSide(centre, items, "self")).toBe("top");
  });

  it("offsets at least 96 screen px", () => {
    expect(Math.abs(dialOffsetPx("right", 80).ox)).toBeGreaterThanOrEqual(96);
    expect(Math.abs(dialOffsetPx("left", 120).ox)).toBe(120);
  });

  it("snaps rotation to 15° detents", () => {
    expect(snapRotDetent(7)).toBe(0);
    expect(snapRotDetent(8)).toBe(15);
    expect(snapRotDetent(22)).toBe(15);
  });

  it("returns a 180° sweep per side", () => {
    expect(dialArcAngles("right").sweepDeg).toBe(180);
    expect(dialArcAngles("left").startDeg).toBe(90);
  });
});
