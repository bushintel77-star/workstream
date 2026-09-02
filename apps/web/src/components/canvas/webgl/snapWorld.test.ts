import { describe, expect, it } from "vitest";
import {
  snapDrawPointer,
  SNAP_BOUNDARY_M,
  SNAP_CLOSE_M,
  SNAP_VERTEX_M,
  type SnapSegment,
  type WorldXZ,
} from "./snapWorld";

const NONE: {
  origin: WorldXZ | null;
  last: WorldXZ | null;
  vertices: readonly WorldXZ[];
  boundaryEdges?: readonly SnapSegment[];
} = {
  origin: null,
  last: null,
  vertices: [],
};

describe("snapDrawPointer", () => {
  it("passes the raw pointer through when nothing applies", () => {
    const r = snapDrawPointer(7.25, -3.5, NONE);
    expect(r).toEqual({ x: 7.25, z: -3.5, kind: null });
  });

  /* ---------------------------------------------------------------------- */
  /* close                                                                   */
  /* ---------------------------------------------------------------------- */

  it("magnets to the stroke origin within the close radius", () => {
    const origin = { x: 10, z: 10 };
    const r = snapDrawPointer(10 + SNAP_CLOSE_M * 0.9, 10, { origin, last: null, vertices: [] });
    expect(r.kind).toBe("close");
    expect(r.x).toBe(10);
    expect(r.z).toBe(10);
  });

  it("does not close outside the radius", () => {
    const r = snapDrawPointer(10 + SNAP_CLOSE_M + 0.5, 10, {
      origin: { x: 10, z: 10 },
      last: null,
      vertices: [],
    });
    expect(r.kind).not.toBe("close");
  });

  it("ignores the origin entirely when not offered (short stroke)", () => {
    // The caller omits origin until the stroke is long enough to close.
    const r = snapDrawPointer(0.5, 0.5, NONE);
    expect(r.kind).toBeNull();
  });

  /* ---------------------------------------------------------------------- */
  /* vertex                                                                  */
  /* ---------------------------------------------------------------------- */

  it("magnets to the nearest committed endpoint within radius", () => {
    const vertices = [
      { x: 0, z: 0 },
      { x: 5, z: 0 },
    ];
    const r = snapDrawPointer(4.4, 0.2, { origin: null, last: null, vertices });
    expect(r.kind).toBe("vertex");
    expect(r.x).toBe(5);
    expect(r.z).toBe(0);
  });

  it("prefers the NEAREST vertex when several are in radius", () => {
    const vertices = [
      { x: 0, z: 0 },
      { x: 1.0, z: 0 },
      { x: -0.9, z: 0 },
    ];
    // Pointer at 0.95: distances 0.95, 0.05, 1.85 → the middle vertex wins.
    const r = snapDrawPointer(0.95, 0, { origin: null, last: null, vertices });
    expect(r.kind).toBe("vertex");
    expect(r.x).toBe(1.0);
  });

  it("no vertex snap beyond the radius", () => {
    const r = snapDrawPointer(SNAP_VERTEX_M + 5, 0.4, {
      origin: null,
      last: null,
      vertices: [{ x: 0, z: 0 }],
    });
    expect(r.kind).toBeNull();
  });

  /* ---------------------------------------------------------------------- */
  /* priority: close > vertex > angle                                        */
  /* ---------------------------------------------------------------------- */

  it("close beats vertex when both are in radius", () => {
    const origin = { x: 0, z: 0 };
    const r = snapDrawPointer(0.5, 0, {
      origin,
      last: null,
      vertices: [{ x: 0.8, z: 0 }],
    });
    expect(r.kind).toBe("close");
    expect(r.x).toBe(0);
  });

  it("vertex beats angle when both are in radius", () => {
    const last = { x: 0, z: 0 };
    const r = snapDrawPointer(0.9, 0.05, {
      origin: null,
      last,
      vertices: [{ x: 1, z: 0 }],
    });
    expect(r.kind).toBe("vertex");
  });

  /* ---------------------------------------------------------------------- */
  /* angle                                                                   */
  /* ---------------------------------------------------------------------- */

  it("soft-snaps the ray to 45° keeping the pointer distance", () => {
    const last = { x: 0, z: 0 };
    // Pointer at 43°, distance 10 → snaps to 45° at distance 10.
    const raw = { x: Math.cos((43 * Math.PI) / 180) * 10, z: Math.sin((43 * Math.PI) / 180) * 10 };
    const r = snapDrawPointer(raw.x, raw.z, { origin: null, last, vertices: [] });
    expect(r.kind).toBe("angle");
    expect(r.x).toBeCloseTo(Math.cos(Math.PI / 4) * 10, 5);
    expect(r.z).toBeCloseTo(Math.sin(Math.PI / 4) * 10, 5);
  });

  it("no angle snap outside the tolerance window", () => {
    const last = { x: 0, z: 0 };
    // Pointer at 20° — 25° away from the nearest 45° increment.
    const r = snapDrawPointer(Math.cos((20 * Math.PI) / 180) * 8, Math.sin((20 * Math.PI) / 180) * 8, {
      origin: null,
      last,
      vertices: [],
    });
    expect(r.kind).toBeNull();
  });

  it("no angle snap without a last point", () => {
    const r = snapDrawPointer(5.3, 5.3, NONE);
    expect(r.kind).toBeNull();
  });

  it("angle snap works on the diagonal octagon (e.g. 90°+45°)", () => {
    const last = { x: 3, z: -2 };
    // Pointer at 134° from last (near the 135° increment), distance 6.
    const ang = (134 * Math.PI) / 180;
    const r = snapDrawPointer(last.x + Math.cos(ang) * 6, last.z + Math.sin(ang) * 6, {
      origin: null,
      last,
      vertices: [],
    });
    expect(r.kind).toBe("angle");
    const rad = (135 * Math.PI) / 180;
    expect(r.x).toBeCloseTo(last.x + Math.cos(rad) * 6, 5);
    expect(r.z).toBeCloseTo(last.z + Math.sin(rad) * 6, 5);
  });

  /* ---------------------------------------------------------------------- */
  /* boundary                                                                */
  /* ---------------------------------------------------------------------- */

  it("magnets onto the nearest point of a title boundary edge", () => {
    // A 20 m edge running east along z = 0.
    const boundaryEdges = [{ a: { x: 0, z: 0 }, b: { x: 20, z: 0 } }];
    const r = snapDrawPointer(8, 0.4, { ...NONE, boundaryEdges });
    expect(r.kind).toBe("boundary");
    // Perpendicular foot: x is preserved, z collapses onto the line.
    expect(r.x).toBeCloseTo(8, 6);
    expect(r.z).toBeCloseTo(0, 6);
  });

  it("clamps to the segment ends rather than the infinite line", () => {
    const boundaryEdges = [{ a: { x: 0, z: 0 }, b: { x: 10, z: 0 } }];
    // Beyond the far end, but within radius of the endpoint itself.
    const r = snapDrawPointer(10.5, 0.3, { ...NONE, boundaryEdges });
    expect(r.kind).toBe("boundary");
    expect(r.x).toBeCloseTo(10, 6);
    expect(r.z).toBeCloseTo(0, 6);
  });

  it("does not snap beyond the boundary radius", () => {
    const boundaryEdges = [{ a: { x: 0, z: 0 }, b: { x: 20, z: 0 } }];
    const r = snapDrawPointer(8, SNAP_BOUNDARY_M + 0.5, { ...NONE, boundaryEdges });
    expect(r.kind).toBeNull();
  });

  it("picks the closest edge when two run near each other", () => {
    const boundaryEdges = [
      { a: { x: 0, z: 0 }, b: { x: 20, z: 0 } },
      { a: { x: 0, z: 1.2 }, b: { x: 20, z: 1.2 } },
    ];
    const r = snapDrawPointer(5, 0.9, { ...NONE, boundaryEdges });
    expect(r.kind).toBe("boundary");
    expect(r.z).toBeCloseTo(1.2, 6);
  });

  it("survives a degenerate edge (duplicate ring point)", () => {
    const boundaryEdges = [{ a: { x: 4, z: 4 }, b: { x: 4, z: 4 } }];
    const r = snapDrawPointer(4.3, 4, { ...NONE, boundaryEdges });
    expect(r.kind).toBe("boundary");
    expect(r.x).toBeCloseTo(4, 6);
    expect(r.z).toBeCloseTo(4, 6);
  });

  it("is inert when no boundary is supplied (existing callers unchanged)", () => {
    const r = snapDrawPointer(8.4, 0.4, NONE);
    expect(r.kind).toBeNull();
  });

  /* ---------------------------------------------------------------------- */
  /* priority: close > vertex > boundary > angle                             */
  /* ---------------------------------------------------------------------- */

  it("vertex beats boundary when both are in radius", () => {
    const boundaryEdges = [{ a: { x: 0, z: 0 }, b: { x: 20, z: 0 } }];
    const r = snapDrawPointer(5.2, 0.2, {
      ...NONE,
      vertices: [{ x: 5, z: 0.1 }],
      boundaryEdges,
    });
    expect(r.kind).toBe("vertex");
    expect(r.x).toBe(5);
  });

  it("boundary beats the 45 degree rung — a real site line outranks the octagon", () => {
    const boundaryEdges = [{ a: { x: 0, z: 0 }, b: { x: 20, z: 0 } }];
    // From the last point this pointer also sits within the 45° window, but
    // it is within 0.3 m of the title line, so the boundary must win.
    const last = { x: 4, z: -3.7 };
    const r = snapDrawPointer(7.7, -0.3, { ...NONE, last, boundaryEdges });
    expect(r.kind).toBe("boundary");
    expect(r.z).toBeCloseTo(0, 6);
  });

  it("close still beats boundary", () => {
    const boundaryEdges = [{ a: { x: 0, z: 0 }, b: { x: 20, z: 0 } }];
    const r = snapDrawPointer(6, 0.2, {
      ...NONE,
      origin: { x: 6.5, z: 0.6 },
      boundaryEdges,
    });
    expect(r.kind).toBe("close");
  });

  /* ---------------------------------------------------------------------- */
  /* purity                                                                  */
  /* ---------------------------------------------------------------------- */

  it("is deterministic — identical inputs give identical outputs", () => {
    const ctx = { origin: { x: 1, z: 1 }, last: { x: 2, z: 2 }, vertices: [{ x: 0, z: 3 }] };
    const a = snapDrawPointer(2.4, 2.4, ctx);
    const b = snapDrawPointer(2.4, 2.4, ctx);
    expect(a).toEqual(b);
  });

  /* ---------------------------------------------------------------------- */
  /* grid (stationing lattice, spec 2.7)                                     */
  /* ---------------------------------------------------------------------- */

  it("snaps to the origin-aligned 1m lattice within a quarter step", () => {
    const r = snapDrawPointer(4.9, 3.1, NONE);
    expect(r).toEqual({ x: 5, z: 3, kind: "grid" });
  });

  it("lands exactly on a stationing major tick", () => {
    // 5 m is a major tick on the ruler lattice — the snapped vertex must sit
    // exactly on it, not merely near it.
    const r = snapDrawPointer(5.1, 5.0, NONE);
    expect(r).toEqual({ x: 5, z: 5, kind: "grid" });
  });

  it("does not grid-snap outside the quarter-step tolerance", () => {
    const r = snapDrawPointer(4.7, 3.1, NONE);
    expect(r.kind).toBeNull();
  });
});
