import { describe, expect, it } from "vitest";
import {
  artboardElevLook,
  resolveActiveArtboard,
  STUDIO_ARTBOARDS,
} from "./artboards";

describe("artboards", () => {
  it("lists plan, fit, and four elevations", () => {
    expect(STUDIO_ARTBOARDS.map((a) => a.id)).toEqual([
      "plan",
      "fit",
      "elev-N",
      "elev-E",
      "elev-S",
      "elev-W",
    ]);
  });

  it("resolves active artboard from mode / fit / elev look", () => {
    expect(
      resolveActiveArtboard({ mode: "cad", frameOn: false, elevLook: "N" }),
    ).toBe("plan");
    expect(
      resolveActiveArtboard({ mode: "cad", frameOn: true, elevLook: "N" }),
    ).toBe("fit");
    expect(
      resolveActiveArtboard({
        mode: "elevation",
        frameOn: false,
        elevLook: "E",
      }),
    ).toBe("elev-E");
  });

  it("maps elev artboards to looks", () => {
    expect(artboardElevLook("elev-S")).toBe("S");
    expect(artboardElevLook("plan")).toBeNull();
  });
});
