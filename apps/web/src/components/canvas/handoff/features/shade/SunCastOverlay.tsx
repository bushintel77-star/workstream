"use client";

import { useMemo } from "react";
import {
  canopyFootprintPct,
  castRingShadowPct,
  growthHeightFactor,
  sunPositionAt,
  type GrowthStageCast,
} from "@workstream/domain";
import type { PctPoint } from "../../geometry";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import {
  sunDateFromPreset,
  type SunDatePreset,
} from "../sunGrowth/sunDatePreset";
import css from "./sunCast.module.css";

type Props = {
  active: boolean;
  sunMin: number;
  datePreset: SunDatePreset;
  growth: GrowthStageCast;
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  scaleM: number;
  lat?: number | null;
  lng?: number | null;
};

const FALLBACK_LAT = -37.849;
const FALLBACK_LNG = 144.993;
const DWELLING_HEIGHT_M = 5.2;

function ptsAttr(ring: Array<{ x: number; y: number }>): string {
  return ring.map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * Timed dwelling + canopy shadow polygons on the % board.
 * Driven by Env scrubber / season / growth. Indicative Workflow 1.
 */
export function SunCastOverlay({
  active,
  sunMin,
  datePreset,
  growth,
  building,
  items,
  scaleM,
  lat,
  lng,
}: Props) {
  const polys = useMemo(() => {
    if (!active || scaleM <= 0) return [] as string[];
    const when = sunDateFromPreset(datePreset, sunMin);
    const sun = sunPositionAt(lat ?? FALLBACK_LAT, lng ?? FALLBACK_LNG, when);
    const g = growthHeightFactor(growth);
    const out: string[] = [];

    if (building.length >= 3) {
      const cast = castRingShadowPct(
        building,
        DWELLING_HEIGHT_M,
        sun.altitude_deg,
        sun.azimuth_deg,
        scaleM,
      );
      if (cast) out.push(ptsAttr(cast));
    }

    for (const it of items) {
      if (it.ghost) continue;
      const def = BY_TYPE[it.t];
      const heightM = (def.heightM ?? 0) * it.scale * g;
      if (heightM < 1.2) continue;
      const canopyM = (def.canopyM ?? def.w / 20) * it.scale * g;
      const radiusPct = Math.max(1.2, (canopyM / scaleM) * 50);
      const foot =
        it.outlinePct && it.outlinePct.length >= 3
          ? it.outlinePct
          : canopyFootprintPct(it.x, it.y, radiusPct);
      const cast = castRingShadowPct(
        foot,
        heightM,
        sun.altitude_deg,
        sun.azimuth_deg,
        scaleM,
      );
      if (cast) out.push(ptsAttr(cast));
    }
    return out;
  }, [
    active,
    sunMin,
    datePreset,
    growth,
    building,
    items,
    scaleM,
    lat,
    lng,
  ]);

  if (!active || polys.length === 0) return null;

  return (
    <svg
      className={css.root}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="sun-cast-overlay"
      aria-hidden
    >
      {polys.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          className={css.poly}
          data-testid="sun-cast-poly"
        />
      ))}
    </svg>
  );
}
