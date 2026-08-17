import { describe, expect, it } from "vitest";
import {
  GRID_SIZE_M,
  SNAP_RADIUS_PX,
  metresGridStepPct,
  snapAlignment,
  snapClockRotationDeg,
  snapDraftPoint,
  snapToGridMetres,
  snapToGridPct,
  snapToNearby,
  snapTracePointer,
  snapVertexDrag,
} from "./snap";

const board = { boardW: 1000, boardH: 800 };

describe("snapTracePointer", () => {
  it("closes when near the first point with ≥3 vertices", () => {
    const poly = [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
    ];
    const r = snapTracePointer({ x: 10.2, y: 10.1 }, poly, [], board);
    expect(r.kind).toBe("close");
    expect(r.x).toBe(10);
    expect(r.y).toBe(10);
  });

  it("snaps to an existing vertex anchor", () => {
    const r = snapTracePointer(
      { x: 50.2, y: 50.1 },
      [{ x: 10, y: 10 }],
      [{ x: 50, y: 50 }],
      board,
    );
    expect(r.kind).toBe("vertex");
    expect(r.x).toBe(50);
    expect(r.y).toBe(50);
  });

  it("applies ortho snap when Shift is held", () => {
    const poly = [{ x: 20, y: 20 }];
    const r = snapTracePointer(
      { x: 40, y: 22 },
      poly,
      [],
      { ...board, shift: true },
    );
    expect(r.kind).toBe("ortho");
    expect(r.y).toBeCloseTo(20, 0);
  });

  it("closes before angle snap when clicking near the first vertex", () => {
    // B1–B4 quadrilateral traced in order. Clicking at (10.2, 10.1) is within
    // the close radius of B1; the angle from B4 (~-87°, would snap to 45° grid)
    // must NOT steal the close — regression for the unclosed B1–B4 ring.
    const quad = [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 10, y: 40 },
    ];
    const r = snapTracePointer({ x: 10.2, y: 10.1 }, quad, [], board);
    expect(r.kind).toBe("close");
    expect(r.x).toBe(10);
    expect(r.y).toBe(10);
  });

  it("uses a pixel close radius (14px), not a fixed percent", () => {
    const quad = [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 10, y: 40 },
    ];
    // 1.3% of a 1000px board ≈ 13px → inside 14px → closes
    const inside = snapTracePointer({ x: 11.3, y: 10 }, quad, [], board);
    expect(inside.kind).toBe("close");
    expect(inside.x).toBe(10);
    // 1.6% ≈ 16px → outside 14px → falls through to angle/raw snap
    const outside = snapTracePointer({ x: 11.6, y: 10 }, quad, [], board);
    expect(outside.kind).not.toBe("close");
  });

  it("snaps the closing click exactly onto the first vertex", () => {
    const quad = [
      { x: 12.5, y: 8.25 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 10, y: 40 },
    ];
    const r = snapTracePointer({ x: 12.7, y: 8.4 }, quad, [], board);
    expect(r.kind).toBe("close");
    expect(r.x).toBe(12.5);
    expect(r.y).toBe(8.25);
  });
});

describe("snapVertexDrag", () => {
  it("locks to neighbour axis without Shift", () => {
    const r = snapVertexDrag(
      { x: 30.2, y: 40 },
      [
        { x: 30, y: 10 },
        { x: 60, y: 40 },
      ],
      { ...board, exclude: { x: 30, y: 40 } },
    );
    expect(r.x).toBe(30);
    expect(r.kind).toBe("ortho");
  });

  it("cadastral-snaps within 12px SDS vertex radius", () => {
    // 0.1% of 1000px board ≈ 1px — well inside 12px
    const r = snapVertexDrag(
      { x: 50.1, y: 50.05 },
      [{ x: 50, y: 50 }],
      { ...board, exclude: { x: 10, y: 10 } },
    );
    expect(r.kind).toBe("vertex");
    expect(r.x).toBe(50);
    expect(r.y).toBe(50);
  });
});

describe("snapAlignment", () => {
  it("returns vertical/horizontal guides when near peers", () => {
    const r = snapAlignment({ x: 40.5, y: 60.4 }, [
      { x: 40, y: 20 },
      { x: 10, y: 60 },
    ]);
    expect(r.guideX).toBe(40);
    expect(r.guideY).toBe(60);
    expect(r.point).toEqual({ x: 40, y: 60 });
  });
});

describe("snapToGridPct / snapClockRotationDeg / snapDraftPoint", () => {
  it("snaps to drafting grid cells", () => {
    expect(snapToGridPct({ x: 41.2, y: 58.8 }, 2.5)).toEqual({
      x: 40,
      y: 60,
    });
  });

  it("clock-snaps rotation to hour marks", () => {
    expect(snapClockRotationDeg(37)).toBe(30);
    expect(snapClockRotationDeg(22, { shift: true })).toBe(15);
    expect(snapClockRotationDeg(37, { alt: true })).toBeCloseTo(37, 5);
  });

  it("draft snap returns crosshair anchors", () => {
    const r = snapDraftPoint({ x: 41, y: 59 }, [{ x: 40, y: 10 }], 2.5);
    expect(r.crossX).toBe(40);
    expect(r.guideX).toBe(40);
  });
});

describe("snapToGridMetres / snapToNearby", () => {
  it("uses half-metre grid in calibrated board space", () => {
    // scaleM=100 → 0.5 m = 0.5%
    expect(metresGridStepPct(100, GRID_SIZE_M)).toBeCloseTo(0.5, 5);
    const p = snapToGridMetres({ x: 40.3, y: 50.1 }, 100);
    expect(p.x).toBeCloseTo(40.5, 5);
    expect(p.y).toBeCloseTo(50, 5);
  });

  it("prefers nearby vertex within SNAP_RADIUS_PX / planZoom", () => {
    const hit = snapToNearby(
      { x: 50.05, y: 50.02 },
      [{ x: 50, y: 50 }],
      {
        planZoom: 1,
        boardW: 1000,
        boardH: 800,
        scaleM: 100,
        snapRadiusPx: SNAP_RADIUS_PX,
      },
    );
    expect(hit).toEqual({ x: 50, y: 50 });
  });

  it("falls back to metre grid when nothing is in radius", () => {
    const hit = snapToNearby(
      { x: 40.3, y: 50.1 },
      [{ x: 10, y: 10 }],
      {
        planZoom: 1,
        boardW: 1000,
        boardH: 800,
        scaleM: 100,
      },
    );
    expect(hit.x).toBeCloseTo(40.5, 5);
    expect(hit.y).toBeCloseTo(50, 5);
  });
});
