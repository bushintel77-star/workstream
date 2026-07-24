"use client";

import { useMemo } from "react";
import type { PctPoint } from "../../geometry/types";
import { useSunAzimuthDeg } from "../shade/SunShadowContext";
import {
  TILT_EAVE_M,
  ROOF_LIGHTNESS,
  WALL_LIGHT_MAX,
  WALL_LIGHT_MIN,
  lightVectorFromAzimuth,
  poleMatrix3d,
  wallLightness,
  wallQuadMatrix3d,
} from "./tiltMath";
import css from "./tilt.module.css";

type Props = {
  building: PctPoint[];
  boardW: number;
  boardH: number;
  ppm: number;
  tiltDeg: number;
};

/**
 * The wall tint is a translucent ink wash, so a `brightness()` filter is a
 * near no-op on it (scaling near-black stays near-black). Directional shading
 * therefore modulates the wash alpha instead: lit facets carry a lighter
 * tint, back facets a heavier one — same drafted language, no new styling
 * system. Alpha pairs are the gradient's top/bottom stops.
 */
function wallWashGradient(lightness: number): string {
  const shade =
    (WALL_LIGHT_MAX - lightness) / (WALL_LIGHT_MAX - WALL_LIGHT_MIN);
  /* PR #119 wash-alpha: mix against transparent so the CAD grid shows
   * through the facets — never against opaque --canvas (that painted a
   * solid slab over the plan). */
  const aTop = 0.22 + 0.28 * shade;
  const aBottom = 0.34 + 0.32 * shade;
  const topPct = Math.round(aTop * 100);
  const botPct = Math.round(aBottom * 100);
  return `linear-gradient(180deg, color-mix(in srgb, var(--existing-stroke) ${topPct}%, transparent) 0%, color-mix(in srgb, var(--existing-stroke) ${botPct}%, transparent) 100%)`;
}

/**
 * v2 dwelling extrusion — solid walls + corner posts in true 3D (real
 * `matrix3d`/`translateZ`, not billboards), topped with the roof plane.
 * The wall/post tops land pixel-exact under the roofline corners because
 * both use the same world-Z convention as the roof's `translateZ(eavePx)` —
 * at a low tilt angle the elevated roof visibly connects back to a
 * footprint that sits inside the boundary, instead of reading as a
 * disconnected shape that appears to breach it.
 *
 * Facets carry directional shading from the live sun azimuth (same provider
 * as glyph soft-shadows) so the volume reads lit/shaded per wall. This is a
 * landscaping render: the dwelling is a quiet support massing for the garden
 * design — shading stays soft, and the ground/garden plane is intentionally
 * untouched (no ground shadow, shading, or texture here).
 */
export function TiltBuildingExtrusion({
  building,
  boardW,
  boardH,
  ppm,
  tiltDeg,
}: Props) {
  const sunAzimuthDeg = useSunAzimuthDeg();

  /**
   * Geometry + per-facet lightness recompute only when the footprint, board
   * metrics, or light direction change — never per tilt animation frame
   * (tiltDeg only gates mounting below).
   */
  const geom = useMemo(() => {
    if (building.length < 3) return null;
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

    /**
     * Shoelace winding sign so the outward normal is winding-independent
     * (survey rings arrive in either direction). In y-down screen space a
     * positive sum means the outward normal of edge direction (ux, uy) is
     * (uy, -ux); negative flips it.
     */
    let area2 = 0;
    for (let i = 0; i < local.length; i++) {
      const a = local[i]!;
      const b = local[(i + 1) % local.length]!;
      area2 += a.x * b.y - b.x * a.y;
    }
    const windingSign = area2 >= 0 ? 1 : -1;

    const { lx, ly } = lightVectorFromAzimuth(sunAzimuthDeg);
    const walls = local.map((p, i) => {
      const next = local[(i + 1) % local.length]!;
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const len = Math.max(0.01, Math.hypot(dx, dy));
      const ux = dx / len;
      const uy = dy / len;
      const lightness = wallLightness(
        uy * windingSign,
        -ux * windingSign,
        lx,
        ly,
      );
      return {
        len,
        matrix: wallQuadMatrix3d(p.x, p.y, next.x, next.y, eavePx),
        background: wallWashGradient(lightness),
      };
    });

    return { minX, minY, w, h, clip, eavePx, local, walls };
  }, [building, boardW, boardH, ppm, sunAzimuthDeg]);

  if (!geom || tiltDeg < 0.5) return null;
  const { minX, minY, w, h, clip, eavePx, local, walls } = geom;

  return (
    <>
      <div
        className={css.wallsLift}
        data-testid="tilt-building-walls"
        data-plan-geometry="1"
        style={{ left: minX, top: minY, width: w, height: h }}
        aria-hidden
      >
        {walls.map((wall, i) => (
          <div
            key={`wall-${i}`}
            className={css.wallFace}
            style={{
              width: wall.len,
              height: eavePx,
              transform: wall.matrix,
              background: wall.background,
            }}
          />
        ))}
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
          style={{
            clipPath: `polygon(${clip})`,
            filter: `brightness(${ROOF_LIGHTNESS})`,
          }}
        />
      </div>
    </>
  );
}
