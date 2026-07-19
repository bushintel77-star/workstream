import { describe, expect, it } from "vitest";
import {
  snapAlignment,
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
