"use client";

import { useMemo } from "react";
import {
  boardScaleM,
  pickMetricStepM,
  visibleMetres,
  type SheetScaleDenom,
} from "./groundMetrics";
import css from "./tactileGround.module.css";

type Props = {
  zoom: number;
  focusX: number;
  focusY: number;
  sheetScaleDenom: SheetScaleDenom;
  darkOn?: boolean;
};

type Tick = {
  metres: number;
  screenPct: number;
};

/**
 * Fixed-frame metric ruler. The mesh remains drawing content inside
 * `.zoomWorld`; labels are viewport instruments and must never inherit its
 * scale or translation.
 */
export function GroundRulerOverlay({
  zoom,
  focusX,
  focusY,
  sheetScaleDenom,
  darkOn = false,
}: Props) {
  const scaleM = boardScaleM(sheetScaleDenom);
  const stepM = pickMetricStepM(visibleMetres(sheetScaleDenom, zoom));
  const stepPct = (stepM / scaleM) * 100;

  const ticks = useMemo(() => {
    const horizontal: Tick[] = [];
    const vertical: Tick[] = [];

    for (let worldPct = stepPct; worldPct < 100; worldPct += stepPct) {
      const metres = Math.round((worldPct / 100) * scaleM);
      const x = focusX + (worldPct - focusX) * zoom;
      const y = focusY + (worldPct - focusY) * zoom;

      // Keep labels clear of clipped board corners.
      if (x >= 2 && x <= 98) horizontal.push({ metres, screenPct: x });
      if (y >= 2 && y <= 98) vertical.push({ metres, screenPct: y });
    }

    return { horizontal, vertical };
  }, [focusX, focusY, scaleM, stepPct, zoom]);

  return (
    <div
      className={`${css.rulerOverlay}${darkOn ? ` ${css.rulerOverlayDark}` : ""}`}
      data-testid="ground-ruler-overlay"
      data-step-m={stepM}
      aria-hidden
    >
      <div className={css.rulerLeft}>
        {ticks.vertical.map((tick) => (
          <span
            key={`left-${tick.metres}`}
            style={{ top: `${tick.screenPct}%` }}
          >
            {tick.metres} m
          </span>
        ))}
      </div>
      <div className={css.rulerBottom}>
        {ticks.horizontal.map((tick) => (
          <span
            key={`bottom-${tick.metres}`}
            style={{ left: `${tick.screenPct}%` }}
          >
            {tick.metres} m
          </span>
        ))}
      </div>
    </div>
  );
}
