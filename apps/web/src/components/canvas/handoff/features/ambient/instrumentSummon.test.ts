import { describe, expect, it } from "vitest";
import { pointInPolygon } from "../../geometry";
import { WRIGHTS_SEED } from "../../studioCatalog";

/**
 * Summon rule: empty click inside the lot → select/clear only;
 * empty click outside the lot (canvas margin) → summon instruments.
 */
describe("instrument summon regions", () => {
  const lot = WRIGHTS_SEED.boundary;

  it("treats a point on the property as inside the drawing", () => {
    expect(pointInPolygon({ x: 38, y: 50 }, lot)).toBe(true);
  });

  it("treats the left canvas gutter as off the drawing", () => {
    expect(pointInPolygon({ x: 10, y: 50 }, lot)).toBe(false);
  });

  it("treats the right canvas margin as off the drawing", () => {
    expect(pointInPolygon({ x: 90, y: 50 }, lot)).toBe(false);
  });
});
