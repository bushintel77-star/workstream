import { describe, expect, it } from "vitest";
import {
  snapDrawPointer,
  SNAP_CLOSE_M,
  SNAP_VERTEX_M,
  type WorldXZ,
} from "./snapWorld";

const NONE: { origin: WorldXZ | null; last: WorldXZ | null; vertices: readonly WorldXZ[] } = {
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
    const r = snapDrawPointer(SNAP_VERTEX_M + 5, 0, {
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
    const r = snapDrawPointer(5, 5, NONE);
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
  /* purity                                                                  */
  /* ---------------------------------------------------------------------- */

  it("is deterministic — identical inputs give identical outputs", () => {
    const ctx = { origin: { x: 1, z: 1 }, last: { x: 2, z: 2 }, vertices: [{ x: 0, z: 3 }] };
    const a = snapDrawPointer(2.4, 2.4, ctx);
    const b = snapDrawPointer(2.4, 2.4, ctx);
    expect(a).toEqual(b);
  });
});
