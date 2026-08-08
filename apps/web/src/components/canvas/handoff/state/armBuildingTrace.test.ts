import { describe, expect, it } from "vitest";
import { armBuildingTracePatch } from "./armBuildingTrace";

describe("armBuildingTracePatch", () => {
  it("arms Trace → Existing dwelling and flattens tilt", () => {
    const patch = armBuildingTracePatch();
    expect(patch.tool).toBe("trace");
    expect(patch.traceTarget).toBe("building");
    expect(patch.tiltDeg).toBe(0);
    expect(patch.drawPoly).toBeNull();
  });
});
