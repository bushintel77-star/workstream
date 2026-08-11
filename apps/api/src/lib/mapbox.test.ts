import { describe, expect, it } from "vitest";
import { aerialImageUrlForRing } from "./mapbox";

describe("aerialImageUrlForRing", () => {
  it("centres the static view on the title bbox and fits a suburban lot", () => {
    const uri = aerialImageUrlForRing([
      [145.0186, -37.8495],
      [145.0192, -37.8495],
      [145.0192, -37.8499],
      [145.0186, -37.8499],
      [145.0186, -37.8495],
    ]);

    expect(uri).toContain("satellite/-37.8497,145.0189");
    expect(uri).toContain("z=20");
  });

  it("returns null for an unusable title ring", () => {
    expect(aerialImageUrlForRing([])).toBeNull();
  });
});
