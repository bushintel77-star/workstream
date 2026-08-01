"use client";

import { useMemo } from "react";
import {
  buildIndicativeShadeGrid,
  SHADE_GRID_SIZE,
} from "@workstream/domain";
import {
  sunDateFromPreset,
  type SunDatePreset,
} from "../sunGrowth/sunDatePreset";
import css from "./shadeGrid.module.css";

type Props = {
  active: boolean;
  sunMin: number;
  datePreset: SunDatePreset;
  /** Site centroid for solar position — Prahran default when unknown. */
  lat?: number;
  lng?: number;
};

/**
 * Indicative sun-hours mesh on the % board (Workflow 1).
 * Not EnergyPlus — coarse 8×8 from solar altitude + north bias.
 */
export function ShadeGridOverlay({
  active,
  sunMin,
  datePreset,
  lat = -37.849,
  lng = 144.993,
}: Props) {
  const cells = useMemo(() => {
    return buildIndicativeShadeGrid(
      lat,
      lng,
      sunDateFromPreset(datePreset, sunMin),
    );
  }, [datePreset, lat, lng, sunMin]);

  if (!active) return null;

  const cellPct = 100 / SHADE_GRID_SIZE;

  return (
    <div
      className={css.root}
      data-testid="shade-grid-overlay"
      data-date-preset={datePreset}
      aria-hidden
    >
      {cells.map((c) => {
        const t = Math.min(1, c.sunHours / 12);
        // More sun → lighter wash; shade → charcoal stipple
        const alpha = 0.22 * (1 - t);
        return (
          <div
            key={`${c.col}-${c.row}`}
            className={css.cell}
            style={{
              left: `${c.col * cellPct}%`,
              top: `${c.row * cellPct}%`,
              width: `${cellPct}%`,
              height: `${cellPct}%`,
              background: `color-mix(in srgb, var(--hc-ink) ${(alpha * 100).toFixed(0)}%, transparent)`,
            }}
            title={`${c.sunHours.toFixed(1)} h sun (indicative)`}
          />
        );
      })}
      <p className={css.legend}>Sun mesh · indicative</p>
    </div>
  );
}
