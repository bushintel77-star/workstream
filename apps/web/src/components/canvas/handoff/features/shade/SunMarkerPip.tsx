"use client";

import { useMemo } from "react";
import { sunMarkerOnPlanPercent, sunPositionAt } from "@workstream/domain";
import type { PctPoint } from "../../geometry";
import {
  sunDateFromPreset,
  type SunDatePreset,
} from "../sunGrowth/sunDatePreset";
import css from "./sunMarker.module.css";

type Props = {
  active: boolean;
  boundary: PctPoint[];
  sunMin: number;
  datePreset: SunDatePreset;
  lat?: number | null;
  lng?: number | null;
};

const FALLBACK_LAT = -37.849;
const FALLBACK_LNG = 144.993;

function ringCentroid(ring: PctPoint[]): PctPoint | null {
  if (ring.length < 3) return null;
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ring.length, y: y / ring.length };
}

/**
 * Small azimuth pip at lot centre when Env is expanded — shows sun bearing
 * for the scrubber time / season.
 */
export function SunMarkerPip({
  active,
  boundary,
  sunMin,
  datePreset,
  lat,
  lng,
}: Props) {
  const marker = useMemo(() => {
    if (!active) return null;
    const c = ringCentroid(boundary);
    if (!c) return null;
    const when = sunDateFromPreset(datePreset, sunMin);
    const sun = sunPositionAt(lat ?? FALLBACK_LAT, lng ?? FALLBACK_LNG, when);
    if (sun.altitude_deg < 2) return null;
    const [x, y] = sunMarkerOnPlanPercent([c.x, c.y], sun.azimuth_deg, 28);
    return { x, y, label: sun.azimuth_label, alt: sun.altitude_deg };
  }, [active, boundary, sunMin, datePreset, lat, lng]);

  if (!marker) return null;

  return (
    <div
      className={css.root}
      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
      data-testid="sun-marker-pip"
      data-azimuth={marker.label}
      title={`Sun ${marker.label} · ${marker.alt.toFixed(0)}°`}
      aria-hidden
    >
      <span className={css.dot} />
      <span className={css.label}>{marker.label}</span>
    </div>
  );
}
