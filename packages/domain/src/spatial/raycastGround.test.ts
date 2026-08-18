import { describe, expect, it } from "vitest";
import {
  photoPointToGround,
  raycastPhotoStrokeToGround,
  metresToBoardPct,
  photoStrokeToBoardPct,
  classifyUnwarpedStroke,
} from "./raycastGround";
import type { PhotoCalibration } from "./photoCalibrator";

/* Synthetic calibration: camera 1.7 m high, 18° pitch down, focal 1250 px,
 * image 1600×1200, principal point at the centre, identity pose. */
const CALIB: PhotoCalibration = {
  focalPx: 1250,
  pitchDeg: 18,
  cameraHeightM: 1.7,
  horizonYPx: 600 - 1250 * Math.tan((18 * Math.PI) / 180),
  principalXPx: 800,
  principalYPx: 600,
  pose: { originXm: 0, originZm: 0, yawDeg: 0 },
};

describe("photoPointToGround", () => {
  it("round-trips a ground point (depth 7 m, lateral 2 m)", () => {
    // Forward projection: row from depth 7, col from lateral 2.
    const phi = (18 * Math.PI) / 180;
    const yPx = 600 + 1250 * Math.tan(Math.atan(1.7 / 7) - phi);
    const xPx = 800 + (2 / 7) * 1250;
    const g = photoPointToGround({ xPx, yPx }, CALIB);
    expect(g).not.toBeNull();
    expect(g!.xM).toBeCloseTo(2, 3);
    expect(g!.zM).toBeCloseTo(7, 3);
  });

  it("returns null for points at or above the horizon", () => {
    expect(photoPointToGround({ xPx: 800, yPx: 150 }, CALIB)).toBeNull();
    expect(photoPointToGround({ xPx: 800, yPx: CALIB.horizonYPx }, CALIB)).toBeNull();
  });

  it("applies the camera pose (yaw + translation)", () => {
    const posed: PhotoCalibration = {
      ...CALIB,
      pose: { originXm: 10, originZm: -5, yawDeg: 90 },
    };
    const phi = (18 * Math.PI) / 180;
    const yPx = 600 + 1250 * Math.tan(Math.atan(1.7 / 7) - phi);
    const xPx = 800 + (2 / 7) * 1250;
    const g = photoPointToGround({ xPx, yPx }, posed)!;
    // Rotate (2, 7) by 90° → (−7, 2), then translate → (3, −3).
    expect(g.xM).toBeCloseTo(3, 3);
    expect(g.zM).toBeCloseTo(-3, 3);
  });
});

describe("raycastPhotoStrokeToGround", () => {
  it("projects a stroke and drops above-horizon vertices", () => {
    const ground = raycastPhotoStrokeToGround(
      [
        { xPx: 800, yPx: 150 }, // above horizon → dropped
        { xPx: 800, yPx: 600 }, // straight down the optical axis
      ],
      CALIB,
    );
    expect(ground).toHaveLength(1);
    expect(ground[0]!.xM).toBeCloseTo(0, 6);
  });
});

describe("metresToBoardPct / photoStrokeToBoardPct", () => {
  it("maps metres to lot-centred board-% (100 m board, aspect 1)", () => {
    const pct = metresToBoardPct({ xM: 2, zM: 7 }, 100, 1);
    expect(pct.x).toBeCloseTo(52, 6);
    expect(pct.y).toBeCloseTo(57, 6);
  });

  it("projects a photo stroke into board-% plan coordinates", () => {
    const pts = photoStrokeToBoardPct(
      [{ xPx: 800, yPx: 600 }],
      CALIB,
      100,
      1,
    );
    // The optical axis hits the ground at depth h/tan(φ) = 1.7/tan(18°)
    // ≈ 5.23 m ahead of the origin — not at the lot centre.
    expect(pts[0]!.x).toBe(50);
    expect(pts[0]!.y).toBeCloseTo(55.232, 3);
  });
});

describe("classifyUnwarpedStroke", () => {
  it("returns board-% plan points classified as the draft layer", () => {
    const out = classifyUnwarpedStroke(
      [{ xPx: 800, yPx: 600 }],
      CALIB,
      100,
      1,
    );
    expect(out.points[0]!.x).toBe(50);
    expect(out.points[0]!.y).toBeCloseTo(55.232, 3);
    expect(out.layerId).toBe("draft.user_draft");
    // The points are exactly the SketchStrokeInput.points shape the CAD
    // classifier consumes (interpretSketchStrokesToCad).
    expect(out.points[0]).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  });
});
