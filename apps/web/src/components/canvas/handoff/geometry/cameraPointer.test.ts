import { describe, expect, it } from "vitest";
import {
  boardPctToClientOffset,
  clientToBoardPct,
  type BoardCamera,
} from "./cameraPointer";

const base: BoardCamera = {
  boardW: 1000,
  boardH: 800,
  zoom: 1,
  rotateDeg: 0,
  panX: 0,
  panY: 0,
  focusX: 50,
  focusY: 50,
};

describe("cameraPointer", () => {
  it("round-trips identity camera (centre)", () => {
    const board = { left: 100, top: 50 };
    const pct = clientToBoardPct(100 + 500, 50 + 400, board, base);
    expect(pct.x).toBeCloseTo(50, 2);
    expect(pct.y).toBeCloseTo(50, 2);
  });

  it("inverts pan + zoom around focus", () => {
    const cam: BoardCamera = {
      ...base,
      zoom: 2,
      panX: 40,
      panY: -20,
      focusX: 40,
      focusY: 60,
    };
    const world = { x: 40, y: 60 };
    const off = boardPctToClientOffset(world, cam);
    const board = { left: 0, top: 0 };
    const back = clientToBoardPct(off.x, off.y, board, cam);
    expect(back.x).toBeCloseTo(world.x, 2);
    expect(back.y).toBeCloseTo(world.y, 2);
  });

  it("inverts 45° camera rotate (G1)", () => {
    const cam: BoardCamera = {
      ...base,
      zoom: 1.5,
      rotateDeg: 45,
      panX: 10,
      panY: 5,
      focusX: 50,
      focusY: 50,
    };
    const world = { x: 62, y: 38 };
    const off = boardPctToClientOffset(world, cam);
    const back = clientToBoardPct(off.x, off.y, { left: 0, top: 0 }, cam);
    expect(back.x).toBeCloseTo(world.x, 1);
    expect(back.y).toBeCloseTo(world.y, 1);
  });

  it("AABB % mapping would fail under rotate — inverse stays correct", () => {
    const cam: BoardCamera = {
      ...base,
      rotateDeg: 90,
      zoom: 1,
      focusX: 50,
      focusY: 50,
    };
    // World point to the right of centre → under 90° CW appears below centre on screen
    const world = { x: 70, y: 50 };
    const off = boardPctToClientOffset(world, cam);
    // Naive AABB of a square board after 90° still ~1000×800 but mapping is wrong if used as %
    const naive = {
      x: (off.x / cam.boardW) * 100,
      y: (off.y / cam.boardH) * 100,
    };
    const inverse = clientToBoardPct(off.x, off.y, { left: 0, top: 0 }, cam);
    expect(inverse.x).toBeCloseTo(70, 1);
    expect(inverse.y).toBeCloseTo(50, 1);
    // Naive is not the world point
    expect(Math.abs(naive.x - 70) + Math.abs(naive.y - 50)).toBeGreaterThan(5);
  });
});
