import { describe, expect, it } from "vitest";
import {
  buildSectionGeometry,
  SECTION_DATUMS,
} from "./sectionGeometry";
import { buildSectionProfile, type SectionPad } from "./sectionProfile";

const pad: SectionPad = {
  worldXZ: [
    { x: 0, z: -5 },
    { x: 10, z: -5 },
    { x: 10, z: 5 },
    { x: 0, z: 5 },
  ],
  heightM: 2,
};

describe("buildSectionGeometry — world-space section primitives (9.6)", () => {
  it("lays the existing profile along the cut with elevation on Y", () => {
    const cut = { x0: 0, z0: 0, x1: 10, z1: 0 };
    const profile = buildSectionProfile({
      cut,
      elevAt: () => 0,
      pads: [pad],
      samples: 10,
    });
    const geo = buildSectionGeometry(profile, cut, { yScale: 1 });
    expect(geo.existing.length).toBe(11);
    // Start at the cut origin, flat at elevation 0.
    expect(geo.existing[0]).toEqual([0, 0, 0]);
    expect(geo.existing[10]![0]).toBeCloseTo(10);
    expect(geo.existing[10]![1]).toBe(0);
  });

  it("emits proposed segments only where a pad covers the cut", () => {
    const cut = { x0: -5, z0: 0, x1: 15, z1: 0 };
    const profile = buildSectionProfile({
      cut,
      elevAt: () => 0,
      pads: [pad],
      samples: 40,
    });
    const geo = buildSectionGeometry(profile, cut, { yScale: 1 });
    expect(geo.proposed.length).toBeGreaterThan(0);
    for (const [a, b] of geo.proposed) {
      expect(a[1]).toBe(2);
      expect(b[1]).toBe(2);
    }
  });

  it("builds fill band quads between the grades", () => {
    const cut = { x0: 0, z0: 0, x1: 10, z1: 0 };
    const profile = buildSectionProfile({
      cut,
      elevAt: () => 0,
      pads: [pad],
      samples: 40,
    });
    const geo = buildSectionGeometry(profile, cut, { yScale: 1 });
    expect(geo.bandQuads.length).toBeGreaterThan(0);
    expect(geo.bandQuads.every((q) => q.kind === "fill")).toBe(true);
    const first = geo.bandQuads[0]!;
    expect(first.corners[0]![1]).toBe(2); // top (proposed)
    expect(first.corners[2]![1]).toBe(0); // bottom (existing)
  });

  it("carries the fixed RL datum ladder", () => {
    expect(SECTION_DATUMS).toEqual([0, 1.5, 3.0, 4.5, 6.0]);
  });
});
