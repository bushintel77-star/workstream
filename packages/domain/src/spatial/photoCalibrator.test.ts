import { describe, expect, it } from "vitest";
import {
  calibratePhotoCamera,
  solveHorizonFromGroundRefs,
  type GroundReferencePoint,
  type PhotoCalibration,
  type VerticalLandmark,
} from "./photoCalibrator";

/* -------------------------------------------------------------------------- */
/* Synthetic scene — the round-trip ground truth                               */
/* -------------------------------------------------------------------------- */

// Camera: height 1.7 m, pitch 18° down, focal 1250 px, image 1600×1200.
const H = 1.7;
const PHI_DEG = 18;
const F = 1250;
const IMG_W = 1600;
const IMG_H = 1200;
const CY = IMG_H / 2;
const CX = IMG_W / 2;

/** Forward projection: ground depth d (+ optional lateral x) → image row/col. */
function groundRow(d: number): number {
  const rad = (Math.PI / 180) * PHI_DEG;
  return CY + F * Math.tan(Math.atan(H / d) - rad);
}
function groundCol(xM: number, d: number): number {
  return CX + (xM / d) * F;
}

const REFS: GroundReferencePoint[] = [
  { xPx: groundCol(0, 4), yPx: groundRow(4), distanceM: 4 },
  { xPx: groundCol(0, 9), yPx: groundRow(9), distanceM: 9 },
  { xPx: groundCol(0, 18), yPx: groundRow(18), distanceM: 18 },
];

const LANDMARK: VerticalLandmark = {
  baseXPx: groundCol(0, 6),
  baseYPx: groundRow(6),
  topXPx: groundCol(0, 6),
  topYPx: CY + F * Math.tan(Math.atan((H - 1.4) / 6) - (Math.PI / 180) * PHI_DEG),
  heightM: 1.4,
};

function calibrate(): PhotoCalibration {
  const res = calibratePhotoCamera({
    imageWidthPx: IMG_W,
    imageHeightPx: IMG_H,
    groundRefs: REFS,
    landmark: LANDMARK,
  });
  if (!res.ok) throw new Error(`calibration failed: ${res.reason}`);
  return res.calibration;
}

describe("solveHorizonFromGroundRefs", () => {
  it("recovers the horizon from three consistent ground refs", () => {
    const y0 = solveHorizonFromGroundRefs([REFS[0]!, REFS[1]!, REFS[2]!]);
    // y0 = CY − F·tan(18°) = 600 − 1250·0.3249 = 193.9
    expect(y0).not.toBeNull();
    expect(y0!).toBeCloseTo(600 - F * Math.tan((Math.PI / 180) * PHI_DEG), 6);
  });

  it("returns null on the horizon singularity (refs sharing a row)", () => {
    // Two refs on the same image row make the cross-ratio ratio A = (y1−y2)/
    // (y2−y3) diverge — the horizon is underdetermined.
    const a: GroundReferencePoint = { xPx: 800, yPx: 500, distanceM: 5 };
    const b: GroundReferencePoint = { xPx: 800, yPx: 300, distanceM: 8 };
    const c: GroundReferencePoint = { xPx: 800, yPx: 300, distanceM: 18 };
    expect(solveHorizonFromGroundRefs([a, b, c])).toBeNull();
  });
});

describe("calibratePhotoCamera", () => {
  it("recovers camera height, pitch, and focal from the synthetic scene", () => {
    const calib = calibrate();
    expect(calib.cameraHeightM).toBeCloseTo(H, 3);
    expect(calib.pitchDeg).toBeCloseTo(PHI_DEG, 3);
    expect(calib.focalPx).toBeCloseTo(F, 2);
    expect(calib.horizonYPx).toBeCloseTo(
      600 - F * Math.tan((Math.PI / 180) * PHI_DEG),
      4,
    );
    expect(calib.principalXPx).toBe(CX);
    expect(calib.principalYPx).toBe(CY);
  });

  it("rejects fewer than three ground refs", () => {
    const res = calibratePhotoCamera({
      imageWidthPx: IMG_W,
      imageHeightPx: IMG_H,
      groundRefs: REFS.slice(0, 2),
      landmark: LANDMARK,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("3 ground reference");
  });

  it("rejects the horizon singularity (refs sharing a row)", () => {
    const res = calibratePhotoCamera({
      imageWidthPx: IMG_W,
      imageHeightPx: IMG_H,
      groundRefs: [
        { xPx: 800, yPx: 500, distanceM: 5 },
        { xPx: 800, yPx: 300, distanceM: 8 },
        { xPx: 800, yPx: 300, distanceM: 18 },
      ],
      landmark: LANDMARK,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("singularity");
  });

  it("rejects ground refs at or above the solved horizon (inconsistent input)", () => {
    // Non-monotonic rows — a farther ref sits above the solved horizon.
    const res = calibratePhotoCamera({
      imageWidthPx: IMG_W,
      imageHeightPx: IMG_H,
      groundRefs: [
        { xPx: 800, yPx: 500, distanceM: 4 },
        { xPx: 800, yPx: 300, distanceM: 9 },
        { xPx: 800, yPx: 700, distanceM: 18 },
      ],
      landmark: LANDMARK,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("at or above the solved horizon");
  });

  it("rejects a non-positive landmark height", () => {
    const res = calibratePhotoCamera({
      imageWidthPx: IMG_W,
      imageHeightPx: IMG_H,
      groundRefs: REFS,
      landmark: { ...LANDMARK, heightM: 0 },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("positive");
  });

  it("rejects a landmark inconsistent with the solved ground model", () => {
    // A landmark whose base row is above the horizon cannot fit.
    const res = calibratePhotoCamera({
      imageWidthPx: IMG_W,
      imageHeightPx: IMG_H,
      groundRefs: REFS,
      landmark: { ...LANDMARK, baseYPx: 100, topYPx: 80, heightM: 1.4 },
    });
    expect(res.ok).toBe(false);
  });
});
