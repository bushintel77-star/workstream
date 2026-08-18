import { describe, expect, it } from "vitest";
import {
  applyReferenceCalibration,
  CALIBRATION_PRESETS,
  lerpRig,
  newPhotoElevation,
  photoPlaneFromElevation,
  pinRigForPlane,
  planeAxes,
  planeToWorld,
  rayPlaneHit,
  rescaleStrokes,
  snapPhotoPlaneToBoundary,
  worldToPlane,
  type PhotoPlane,
} from "./photoTraceMath";
import { DEFAULT_CAMERA_RIG, type StudioCameraRig } from "./cameraRig";

const UUID = "00000000-0000-0000-0000-000000000000";

function elevation(calibration: { plane_width_m: number } | null) {
  return photoPlaneFromElevation({
    natural_aspect: 1.5,
    azimuth_deg: 0,
    centre_x_m: 2,
    centre_z_m: -4,
    ground_offset_m: 0.5,
    calibration,
  });
}

describe("photoTraceMath — plane geometry", () => {
  it("derives height from width and natural aspect", () => {
    const plane = elevation({ plane_width_m: 12 });
    expect(plane.heightM).toBeCloseTo(8);
    expect(plane.widthM).toBe(12);
  });

  it("uses the provisional width when uncalibrated", () => {
    const plane = elevation(null);
    expect(plane.widthM).toBe(12);
    expect(plane.heightM).toBeCloseTo(8);
  });

  it("round-trips plane-local points through world space", () => {
    const plane: PhotoPlane = {
      widthM: 12,
      heightM: 8,
      azimuthDeg: 90,
      centreXM: 3,
      centreZM: -5,
      groundOffsetM: 0.2,
    };
    const world = planeToWorld(plane, { u: 2, v: 1 });
    expect(world.y).toBeCloseTo(1.2); // ground offset + v
    const back = worldToPlane(plane, world);
    expect(back.u).toBeCloseTo(2);
    expect(back.v).toBeCloseTo(1);
  });

  it("north-look axes match the fused camera orbit", () => {
    const axes = planeAxes(0);
    expect(axes.right.x).toBeCloseTo(1);
    expect(axes.right.z).toBeCloseTo(0);
    expect(axes.normal.z).toBeCloseTo(1); // camera at +Z looks -Z
  });

  it("east-look axes match the fused camera orbit", () => {
    const axes = planeAxes(90);
    expect(axes.right.z).toBeCloseTo(1);
    expect(axes.normal.x).toBeCloseTo(-1); // camera at -X looks +X
  });
});

describe("photoTraceMath — ray casting", () => {
  const plane: PhotoPlane = {
    widthM: 10,
    heightM: 5,
    azimuthDeg: 0,
    centreXM: 0,
    centreZM: 0,
    groundOffsetM: 0,
  };

  it("hits the plane dead centre from the camera side", () => {
    const hit = rayPlaneHit(
      plane,
      { x: 0, y: 2, z: 10 },
      { x: 0, y: 0, z: -1 },
    );
    expect(hit).not.toBeNull();
    expect(hit!.plane.u).toBeCloseTo(0);
    expect(hit!.plane.v).toBeCloseTo(2);
  });

  it("rejects rays pointing away from the plane", () => {
    const hit = rayPlaneHit(
      plane,
      { x: 0, y: 2, z: 10 },
      { x: 0, y: -2, z: 10 },
    );
    expect(hit).toBeNull();
  });

  it("rejects hits outside the plane rectangle", () => {
    const hit = rayPlaneHit(
      plane,
      { x: 100, y: 1, z: 10 },
      { x: 0, y: -1, z: -10 },
    );
    expect(hit).toBeNull();
  });
});

describe("photoTraceMath — reference-line calibration", () => {
  it("scales the plane so the drawn length equals the reference", () => {
    const plane = elevation({ plane_width_m: 12 }); // height 8
    // Draw a horizontal line across half the plane (6 m plane-space) and
    // declare it 1.8 m — the plane must shrink to 3.6 m wide.
    const result = applyReferenceCalibration({
      plane,
      drawnA: { u: -3, v: 1 },
      drawnB: { u: 3, v: 1 },
      referenceM: 1.8,
      label: "1.8 m fence line",
    });
    expect(result.plane.widthM).toBeCloseTo(3.6);
    expect(result.plane.heightM).toBeCloseTo(2.4);
    expect(result.strokeScale).toBeCloseTo(0.3);
  });

  it("preserves stroke metre truth by rescaling with the plane", () => {
    const result = applyReferenceCalibration({
      plane: elevation({ plane_width_m: 12 }),
      drawnA: { u: -3, v: 1 },
      drawnB: { u: 3, v: 1 },
      referenceM: 1.8,
      label: "1.8 m fence line",
    });
    const strokes = rescaleStrokes(
      [
        {
          id: UUID,
          points: [
            { x_m: 6, y_m: 1.8 },
            { x_m: -6, y_m: 0 },
          ],
          width_px: 2,
          color: "#0030CF",
        },
      ],
      result.strokeScale,
    );
    expect(strokes[0]!.points[0]!.x_m).toBeCloseTo(1.8);
    expect(strokes[0]!.points[1]!.y_m).toBeCloseTo(0);
  });

  it("rejects a degenerate or negative reference", () => {
    const plane = elevation({ plane_width_m: 12 });
    expect(() =>
      applyReferenceCalibration({
        plane,
        drawnA: { u: 0, v: 0 },
        drawnB: { u: 0, v: 0 },
        referenceM: 1.8,
        label: "x",
      }),
    ).toThrow(/reference line/);
    expect(() =>
      applyReferenceCalibration({
        plane,
        drawnA: { u: 0, v: 0 },
        drawnB: { u: 1, v: 0 },
        referenceM: -1,
        label: "x",
      }),
    ).toThrow(/positive/);
  });

  it("presets are sane, honest Melbourne garden lengths", () => {
    expect(CALIBRATION_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const preset of CALIBRATION_PRESETS) {
      expect(preset.metres).toBeGreaterThan(0);
      expect(preset.metres).toBeLessThanOrEqual(3);
    }
  });
});

describe("photoTraceMath — title-boundary snap (gap-check rule)", () => {
  /** 40 m square lot centred on the origin, board-% ring NW→NE→SE→SW. */
  const SQUARE_PCT = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  const SQUARE_ARGS = {
    boundaryPct: SQUARE_PCT,
    scaleM: 40,
    boardAspect: 1,
    cameraTargetXM: 0,
    cameraTargetZM: 0,
  };

  it("snaps to the north edge when the camera faces north (azimuth 0)", () => {
    const snap = snapPhotoPlaneToBoundary({
      ...SQUARE_ARGS,
      cameraAzimuthDeg: 0,
    });
    expect(snap).not.toBeNull();
    // North edge = z −20; plane foot centred at the camera target's projection.
    expect(snap!.centreXM).toBeCloseTo(0);
    expect(snap!.centreZM).toBeCloseTo(-20);
    expect(snap!.azimuthDeg).toBeCloseTo(0);
  });

  it("snaps to the west edge when the camera faces west (azimuth 90)", () => {
    const snap = snapPhotoPlaneToBoundary({
      ...SQUARE_ARGS,
      cameraAzimuthDeg: 90,
    });
    expect(snap).not.toBeNull();
    // Camera at azimuth 90 sits at -x looking +x → the west fence (x = -20).
    expect(snap!.centreXM).toBeCloseTo(-20);
    expect(snap!.centreZM).toBeCloseTo(0);
    expect(snap!.azimuthDeg).toBeCloseTo(270);
  });

  it("follows the boundary's real bearing on a rotated lot", () => {
    // Rotate the square 15° around the centre — the edge the north-facing
    // camera picks now runs at 15° from the x axis, so the plane azimuth
    // follows the title line, not a rounded cardinal.
    const rot = (x: number, z: number, deg: number) => {
      const r = (deg * Math.PI) / 180;
      return {
        x: x * Math.cos(r) - z * Math.sin(r),
        z: x * Math.sin(r) + z * Math.cos(r),
      };
    };
    // Build the rotated boundary in board-% from world corners.
    const worldCorners = [
      { x: -20, z: -20 },
      { x: 20, z: -20 },
      { x: 20, z: 20 },
      { x: -20, z: 20 },
    ].map((p) => rot(p.x, p.z, 15));
    const toPct = (w: { x: number; z: number }) => ({
      x: ((w.x + 20) / 40) * 100,
      y: ((w.z + 20) / 40) * 100,
    });
    const snap = snapPhotoPlaneToBoundary({
      boundaryPct: worldCorners.map(toPct),
      scaleM: 40,
      boardAspect: 1,
      cameraAzimuthDeg: 0,
      cameraTargetXM: 0,
      cameraTargetZM: 0,
    });
    expect(snap).not.toBeNull();
    expect(snap!.azimuthDeg).toBeCloseTo(15, 6);
  });

  it("worked example — the snapped plane faces the camera, not away (15° title line)", () => {
    // Title line at a real, non-cardinal bearing: a 40 m square lot rotated
    // 15°. The operator faces north (azimuth 0) from the lot centre and
    // pins. The plane must land ON the 15° edge with its camera-facing
    // normal pointing back at the camera position the fused rig will take.
    const rot = (x: number, z: number, deg: number) => {
      const r = (deg * Math.PI) / 180;
      return {
        x: x * Math.cos(r) - z * Math.sin(r),
        z: x * Math.sin(r) + z * Math.cos(r),
      };
    };
    const corners = [
      { x: -20, z: -20 },
      { x: 20, z: -20 },
      { x: 20, z: 20 },
      { x: -20, z: 20 },
    ].map((p) => rot(p.x, p.z, 15));
    const toPct = (w: { x: number; z: number }) => ({
      x: ((w.x + 20) / 40) * 100,
      y: ((w.z + 20) / 40) * 100,
    });

    const snap = snapPhotoPlaneToBoundary({
      boundaryPct: corners.map(toPct),
      scaleM: 40,
      boardAspect: 1,
      cameraAzimuthDeg: 0,
      cameraTargetXM: 0,
      cameraTargetZM: 0,
    });
    expect(snap).not.toBeNull();

    // The FusedCamera's rig convention: at elevation the camera sits at
    // rotateY(θ)·(panX, 0, panY + d) — i.e. foot + (−d·sinθ, 0, d·cosθ).
    const d = 50;
    const cameraPos = {
      x: snap!.centreXM - d * Math.sin((snap!.azimuthDeg * Math.PI) / 180),
      y: 0,
      z: snap!.centreZM + d * Math.cos((snap!.azimuthDeg * Math.PI) / 180),
    };
    const axes = planeAxes(snap!.azimuthDeg);
    const foot = { x: snap!.centreXM, y: 0, z: snap!.centreZM };
    const toCamera = {
      x: cameraPos.x - foot.x,
      y: 0,
      z: cameraPos.z - foot.z,
    };
    // The plane's normal must point TOWARD the camera (dot > 0) — a
    // backwards plane would render the photo's far side and invert the
    // trace. This is the regression that pure-formula tests miss.
    const facing = axes.normal.x * toCamera.x + axes.normal.z * toCamera.z;
    expect(facing).toBeGreaterThan(0);
    expect(facing / d).toBeCloseTo(1, 6); // exactly head-on

    // And the plane must lie parallel to the picked title line: the edge's
    // inward normal (computed from the boundary itself) equals the plane's
    // camera-facing normal.
    const a = corners[0]!;
    const b = corners[1]!;
    const edgeDx = b.x - a.x;
    const edgeDz = b.z - a.z;
    const len = Math.hypot(edgeDx, edgeDz);
    const perpA = { x: edgeDz / len, z: -edgeDx / len };
    const perpB = { x: -edgeDz / len, z: edgeDx / len };
    const centroid = {
      x: corners.reduce((s, p) => s + p.x, 0) / corners.length,
      z: corners.reduce((s, p) => s + p.z, 0) / corners.length,
    };
    const inward =
      perpA.x * (centroid.x - a.x) + perpA.z * (centroid.z - a.z) >= 0
        ? perpA
        : perpB;
    expect(axes.normal.x * inward.x + axes.normal.z * inward.z).toBeCloseTo(
      1,
      6,
    );
  });

  it("every cardinal look snaps to a plane that faces the camera (sweep)", () => {
    for (const azimuth of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const snap = snapPhotoPlaneToBoundary({
        ...SQUARE_ARGS,
        cameraAzimuthDeg: azimuth,
      });
      expect(snap, `azimuth ${azimuth}`).not.toBeNull();
      const d = 50;
      const rad = (snap!.azimuthDeg * Math.PI) / 180;
      const toCamera = {
        x: -d * Math.sin(rad),
        z: d * Math.cos(rad),
      };
      const axes = planeAxes(snap!.azimuthDeg);
      const facing = axes.normal.x * toCamera.x + axes.normal.z * toCamera.z;
      expect(facing, `azimuth ${azimuth}`).toBeGreaterThan(0);
      // The foot must sit on the picked edge line (x = ±20 or z = ±20).
      const onEdge =
        Math.abs(Math.abs(snap!.centreXM) - 20) < 1e-6 ||
        Math.abs(Math.abs(snap!.centreZM) - 20) < 1e-6;
      expect(onEdge, `azimuth ${azimuth}`).toBe(true);
    }
  });

  it("projects the camera target onto the edge and clamps to the segment", () => {
    const snap = snapPhotoPlaneToBoundary({
      ...SQUARE_ARGS,
      cameraAzimuthDeg: 0,
      cameraTargetXM: 50, // far beyond the 40 m lot — must clamp to the corner
      cameraTargetZM: 5,
    });
    expect(snap).not.toBeNull();
    expect(snap!.centreXM).toBeCloseTo(20); // clamped to the east corner
    expect(snap!.centreZM).toBeCloseTo(-20);
  });

  it("returns null for a degenerate boundary (caller stamps locational-indicative)", () => {
    expect(
      snapPhotoPlaneToBoundary({
        boundaryPct: [],
        scaleM: 40,
        boardAspect: 1,
        cameraAzimuthDeg: 0,
        cameraTargetXM: 0,
        cameraTargetZM: 0,
      }),
    ).toBeNull();
    expect(
      snapPhotoPlaneToBoundary({
        boundaryPct: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
        scaleM: 40,
        boardAspect: 1,
        cameraAzimuthDeg: 0,
        cameraTargetXM: 0,
        cameraTargetZM: 0,
      }),
    ).toBeNull();
  });

  it("newPhotoElevation records the boundary snap and defaults to indicative", () => {
    const photo = {
      id: UUID,
      name: "Rear fence",
      uri: "https://example.com/photos/rear.png",
      natural_aspect: 1.5,
    };
    const snapped = newPhotoElevation(photo, 15, {
      centreXM: -3,
      centreZM: -20,
      boundarySnap: { edge_index: 2, snapped_at: "2026-08-18T00:00:00.000Z" },
    });
    expect(snapped.azimuth_deg).toBe(15);
    expect(snapped.centre_x_m).toBe(-3);
    expect(snapped.boundary_snap?.edge_index).toBe(2);
    expect(snapped.calibration).toBeNull();

    const unsnapped = newPhotoElevation(photo, 0);
    expect(unsnapped.boundary_snap).toBeNull();
    expect(unsnapped.centre_x_m).toBe(0);
  });
});

describe("photoTraceMath — pin rig + fly", () => {
  it("pins φ=90 at the plane azimuth with a framing zoom", () => {
    const plane = elevation({ plane_width_m: 12 });
    const rig = pinRigForPlane(plane, 110, 1);
    expect(rig.tiltDeg).toBe(90);
    expect(rig.rotateDeg).toBe(0);
    expect(rig.panX).toBeCloseTo(plane.centreXM);
    expect(rig.panY).toBeCloseTo(plane.centreZM);
    expect(rig.zoom).toBeGreaterThan(0.2);
    expect(rig.zoom).toBeLessThanOrEqual(8);
  });

  it("lerps the rig and takes the short azimuth arc", () => {
    const from: StudioCameraRig = { ...DEFAULT_CAMERA_RIG, rotateDeg: 350 };
    const to: StudioCameraRig = { ...DEFAULT_CAMERA_RIG, rotateDeg: 10 };
    const mid = lerpRig(from, to, 0.5);
    expect(mid.rotateDeg).toBeCloseTo(0);
    const end = lerpRig(from, to, 1);
    expect(end.rotateDeg).toBeCloseTo(10);
  });

  it("clamps the fly at its endpoints", () => {
    const from = { ...DEFAULT_CAMERA_RIG };
    const to: StudioCameraRig = { ...DEFAULT_CAMERA_RIG, zoom: 2 };
    expect(lerpRig(from, to, -0.5).zoom).toBe(1);
    expect(lerpRig(from, to, 1.5).zoom).toBe(2);
  });
});
