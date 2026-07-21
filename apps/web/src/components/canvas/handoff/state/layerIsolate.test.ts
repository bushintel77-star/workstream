import { describe, expect, it } from "vitest";
import { resolveLayerVisual } from "./layerIsolate";

describe("layer isolation", () => {
  it("keeps the isolated layer interactive and respects its dimmer", () => {
    expect(resolveLayerVisual("vegetation", 0.7, "vegetation")).toEqual({
      opacity: 0.7,
      hittable: true,
    });
  });

  it("dims every other layer and makes it non-hittable", () => {
    expect(resolveLayerVisual("boundary", 1, "vegetation")).toEqual({
      opacity: 0.15,
      hittable: false,
    });
  });

  it("treats services as its own isolatable layer", () => {
    expect(resolveLayerVisual("services", 0.6, "services")).toEqual({
      opacity: 0.6,
      hittable: true,
    });
    expect(resolveLayerVisual("services", 1, "boundary")).toEqual({
      opacity: 0.15,
      hittable: false,
    });
  });
});
