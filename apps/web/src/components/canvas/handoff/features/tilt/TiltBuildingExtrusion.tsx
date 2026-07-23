"use client";

import type { PctPoint } from "../../geometry/types";
import { TILT_EAVE_M } from "./tiltMath";
import css from "./tilt.module.css";

type Props = {
  building: PctPoint[];
  boardW: number;
  boardH: number;
  ppm: number;
  tiltDeg: number;
};

/**
 * v1 dwelling extrusion — roof plane lifted to eave height + corner posts.
 * Full wall quads left as a follow-up (TODO) — posts read the mass without
 * fighting preserve-3d edge cases on every browser.
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
  const xs = building.map((p) => (p.x / 100) * boardW);
  const ys = building.map((p) => (p.y / 100) * boardH);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(4, maxX - minX);
  const h = Math.max(4, maxY - minY);
  const clip = building
    .map((p) => {
      const x = (p.x / 100) * boardW - minX;
      const y = (p.y / 100) * boardH - minY;
      return `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    })
    .join(", ");

  return (
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
      {building.map((p, i) => (
        <div
          key={`post-${i}`}
          className={css.cornerPost}
          style={{
            left: (p.x / 100) * boardW - minX,
            top: (p.y / 100) * boardH - minY,
            height: eavePx,
            transform: `translate(-50%, -100%) rotateX(${-tiltDeg}deg)`,
          }}
        />
      ))}
    </div>
  );
}
