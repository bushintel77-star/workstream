import { describe, expect, it } from "vitest";
import { nearestProtractorTick } from "./ProtractorArc";

describe("protractor feedforward", () => {
  it("highlights the nearest 15 degree tick", () => {
    expect(nearestProtractorTick(22)).toBe(15);
    expect(nearestProtractorTick(23)).toBe(30);
    expect(nearestProtractorTick(-8)).toBe(345);
  });
});
