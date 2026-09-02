import { describe, expect, it } from "vitest";
import {
  buildSectionProfile,
  pointInPadXZ,
  type SectionPad,
} from "./sectionProfile";

// Flat existing grade at 0; a 10×10 pad at height 2 covers part of a cut.
const elevAt = () => 0;

const pad: SectionPad = {
  worldXZ: [
    { x: 0, z: -5 },
    { x: 10, z: -5 },
    { x: 10, z: 5 },
    { x: 0, z: 5 },
  ],
  heightM: 2,
};

describe("pointInPadXZ", () => {
  it("detects inside/outside a simple quad", () => {
    expect(pointInPadXZ(5, 0, pad.worldXZ)).toBe(true);
    expect(pointInPadXZ(20, 0, pad.worldXZ)).toBe(false);
  });
});

describe("buildSectionProfile — cross-section math (9.6)", () => {
  it("samples existing grade along the full cut length", () => {
    const cut = { x0: -5, z0: 0, x1: 15, z1: 0 };
    const p = buildSectionProfile({ cut, elevAt, pads: [pad], samples: 20 });
    expect(p.lengthM).toBeCloseTo(20);
    expect(p.points.length).toBe(21);
    expect(p.points[0]!.existing).toBe(0);
    expect(p.points[p.points.length - 1]!.t).toBeCloseTo(20);
  });

  it("marks proposed grade only inside a pad (fill above flat grade)", () => {
    const cut = { x0: 0, z0: 0, x1: 10, z1: 0 };
    const p = buildSectionProfile({ cut, elevAt, pads: [pad], samples: 100 });
    const withPad = p.points.filter((pt) => pt.proposed != null);
    expect(withPad.length).toBeGreaterThan(0);
    // Every proposed point is inside the pad (x in 0..10, z ~0).
    for (const pt of withPad) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(10);
      expect(pt.proposed).toBe(2);
    }
    // Fill: proposed (2) > existing (0) across the covered span.
    expect(p.bands.length).toBeGreaterThan(0);
    expect(p.bands.every((b) => b.kind === "fill")).toBe(true);
  });

  it("emits a cut band when a pad sits below the existing grade", () => {
    const cut = { x0: 0, z0: 0, x1: 10, z1: 0 };
    const sunken: SectionPad = { worldXZ: pad.worldXZ, heightM: -1.5 };
    const p = buildSectionProfile({ cut, elevAt, pads: [sunken], samples: 100 });
    expect(p.bands.length).toBeGreaterThan(0);
    expect(p.bands.every((b) => b.kind === "cut")).toBe(true);
    expect(p.bands[0]!.depth).toBeCloseTo(1.5);
  });

  it("handles a degenerate cut with no length", () => {
    const p = buildSectionProfile({
      cut: { x0: 1, z0: 1, x1: 1, z1: 1 },
      elevAt,
      pads: [pad],
    });
    expect(p.lengthM).toBe(0);
    expect(p.points.length).toBe(0);
  });
});
