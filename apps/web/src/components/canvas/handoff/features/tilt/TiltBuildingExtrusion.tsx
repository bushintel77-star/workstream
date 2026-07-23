"use client";

import type { PctPoint } from "../../geometry/types";
import { TILT_EAVE_M, poleMatrix3d, wallQuadMatrix3d } from "./tiltMath";
import css from "./tilt.module.css";

type Props = {
  building: PctPoint[];
  boardW: number;
  boardH: number;
  ppm: number;
  tiltDeg: number;
};

/**
 * v2 dwelling extrusion — solid walls + corner posts in true 3D (real
 * `matrix3d`/`translateZ`, not billboards), topped with the roof plane.
 * The wall/post tops land pixel-exact under the roofline corners because
 * both use the same world-Z convention as the roof's `translateZ(eavePx)` —
 * at a low tilt angle the elevated roof visibly connects back to a
 * footprint that sits inside the boundary, instead of reading as a
 * disconnected shape that appears to breach it.
 */
export function TiltBuildingExtrusion({
  building,
  boardW,
  boardH,
  ppm,
  tiltDeg,
}: Props) {
  if (building.length < 3 || tiltDeg < 0.5) return null;
  const eavePx = TILT_EAVE_M * ppm;
  const pts = building.map((p) => ({
    x: (p.x / 100) * boardW,
    y: (p.y / 100) * boardH,
  }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(4, maxX - minX);
  const h = Math.max(4, maxY - minY);
  const local = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  const clip = local
    .map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`)
    .join(", ");

  return (
    <>
      <div
        className={css.wallsLift}
        data-testid="tilt-building-walls"
        data-plan-geometry="1"
        style={{ left: minX, top: minY, width: w, height: h }}
        aria-hidden
      >
        {local.map((p, i) => {
          const next = local[(i + 1) % local.length]!;
          const len = Math.max(0.01, Math.hypot(next.x - p.x, next.y - p.y));
          return (
            <div
              key={`wall-${i}`}
              className={css.wallFace}
              style={{
                width: len,
                height: eavePx,
                transform: wallQuadMatrix3d(p.x, p.y, next.x, next.y, eavePx),
              }}
            />
          );
        })}
        {local.map((p, i) => (
          <div
            key={`post-${i}`}
            className={css.cornerPost}
            style={{
              width: 2,
              height: eavePx,
              transform: poleMatrix3d(p.x, p.y, eavePx),
            }}
          />
        ))}
      </div>
      <div
        className={css.roofLift}
        data-testid="tilt-building-extrusion"
        data-plan-geometry="1"
        style={{
          left: minX,
          top: minY,
          width: w,
          height: h,
          transform: `translateZ(${eavePx}px)`,
        }}
        aria-hidden
      >
        <div
          className={css.roofFace}
          style={{ clipPath: `polygon(${clip})` }}
        />
      </div>
    </>
  );
}
