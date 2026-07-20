"use client";

import { useMemo } from "react";
import {
  buildIndicativeShadeGrid,
  SHADE_GRID_SIZE,
} from "@workstream/domain";
import css from "./shadeGrid.module.css";

type Props = {
  active: boolean;
  sunMin: number;
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
  lat = -37.849,
  lng = 144.993,
}: Props) {
  const cells = useMemo(() => {
    const d = new Date();
    d.setHours(Math.floor(sunMin / 60), sunMin % 60, 0, 0);
    return buildIndicativeShadeGrid(lat, lng, d);
  }, [lat, lng, sunMin]);

  if (!active) return null;

  const cellPct = 100 / SHADE_GRID_SIZE;

  return (
    <div
      className={css.root}
      data-testid="shade-grid-overlay"
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
              background: `rgba(28, 25, 23, ${alpha.toFixed(3)})`,
            }}
            title={`${c.sunHours.toFixed(1)} h sun (indicative)`}
          />
        );
      })}
      <p className={css.legend}>Sun mesh · indicative</p>
    </div>
  );
}
