"use client";

import { useCallback, useMemo, useState } from "react";
import {
  indicativeScaleBar,
  metresPerCanvasPixel,
  type StaticMapView,
} from "../../lib/mapView";
import css from "./draftingAssist.module.css";

type Shared = {
  mapView: StaticMapView | null;
  worldWidthPx: number;
  worldHeightPx: number;
};

type HudProps = Shared & {
  viewScale: number;
  measureActive: boolean;
  onMeasureActiveChange: (on: boolean) => void;
  measureDistanceM: number | null;
  measureHint: string | null;
  embedded?: boolean;
};

type MeasureProps = Shared & {
  active: boolean;
  points: MeasurePt[];
  onPointsChange: (pts: MeasurePt[]) => void;
  /** Cream Fit sheet - ink measure, not gold glass. */
  paper?: boolean;
};

export type MeasurePt = { xPct: number; yPct: number };

/** Fixed HUD - scale bar + measure toggle (stage chrome). */
export function DraftingHud({
  mapView,
  worldWidthPx,
  worldHeightPx,
  viewScale,
  measureActive,
  onMeasureActiveChange,
  measureDistanceM,
  measureHint,
  embedded = false,
}: HudProps) {
  const mpp = useMemo(() => {
    if (!mapView) return null;
    return metresPerCanvasPixel(mapView, worldWidthPx, worldHeightPx);
  }, [mapView, worldHeightPx, worldWidthPx]);

  const scaleBar = useMemo(() => {
    if (!mapView) return null;
    const bar = indicativeScaleBar(mapView, worldWidthPx, 120);
    return {
      metres: bar.metres,
      barPx: Math.max(28, Math.round(bar.barPx * viewScale)),
    };
  }, [mapView, viewScale, worldWidthPx]);

  return (
    <>
      {scaleBar ? (
        <div
          className={css.scaleBar}
          data-testid="canvas-scale-bar"
          aria-label={`Scale bar ${scaleBar.metres} metres`}
        >
          <div className={css.scaleTrack} style={{ width: scaleBar.barPx }}>
            <span className={css.scaleTick} />
            <span className={css.scaleTickEnd} />
          </div>
          <span className={css.scaleLabel}>{scaleBar.metres} m</span>
        </div>
      ) : null}

      <div
        className={`${css.toolRow} ${embedded ? css.toolRowEmbedded : ""}`}
        role="toolbar"
        aria-label="Drafting assists"
      >
        <button
          type="button"
          className={`${css.toolBtn} ${measureActive ? css.toolBtnOn : ""}`}
          aria-pressed={measureActive}
          data-testid="canvas-measure-toggle"
          onClick={() => onMeasureActiveChange(!measureActive)}
        >
          Measure
        </button>
        {mpp ? (
          <span className={css.meta} data-testid="canvas-mpp">
            grid snap · {(mpp.x * 2.5).toFixed(2)} m
          </span>
        ) : (
          <span className={css.meta}>grid snap on</span>
        )}
        {measureDistanceM != null ? (
          <span className={css.distance} data-testid="canvas-measure-distance">
            {measureDistanceM} m
          </span>
        ) : measureHint ? (
          <span className={css.meta}>{measureHint}</span>
        ) : null}
      </div>
    </>
  );
}

/** Measure tape overlay - lives inside the pan/zoom world. */
export function MeasureOverlay({
  mapView,
  worldWidthPx,
  worldHeightPx,
  active,
  points,
  onPointsChange,
  paper = false,
}: MeasureProps) {
  const onWorldClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!active) return;
      e.stopPropagation();
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const xPct = ((e.clientX - r.left) / Math.max(r.width, 1)) * 100;
      const yPct = ((e.clientY - r.top) / Math.max(r.height, 1)) * 100;
      if (points.length === 0 || points.length >= 2) {
        onPointsChange([{ xPct, yPct }]);
        return;
      }
      onPointsChange([points[0]!, { xPct, yPct }]);
    },
    [active, onPointsChange, points],
  );

  const distanceM = useMemo(() => {
    if (!mapView || points.length < 2) return null;
    const mpp = metresPerCanvasPixel(mapView, worldWidthPx, worldHeightPx);
    const [p0, p1] = points;
    const dx = ((p1!.xPct - p0!.xPct) / 100) * worldWidthPx * mpp.x;
    const dy = ((p1!.yPct - p0!.yPct) / 100) * worldHeightPx * mpp.y;
    return Math.round(Math.hypot(dx, dy) * 10) / 10;
  }, [mapView, points, worldHeightPx, worldWidthPx]);

  if (!active) return null;

  const a = points[0];
  const b = points[1];

  return (
    <div
      className={`${css.measureLayer}${paper ? ` ${css.measureLayerPaper}` : ""}`}
      data-testid="canvas-measure-layer"
      data-paper={paper ? "1" : undefined}
      onClick={onWorldClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {a ? (
        <span
          className={css.measureDot}
          style={{ left: `${a.xPct}%`, top: `${a.yPct}%` }}
        />
      ) : null}
      {a && b ? (
        <>
          <svg
            className={css.measureSvg}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <line
              x1={a.xPct}
              y1={a.yPct}
              x2={b.xPct}
              y2={b.yPct}
              className={css.measureLine}
            />
          </svg>
          <span
            className={css.measureDot}
            style={{ left: `${b.xPct}%`, top: `${b.yPct}%` }}
          />
          {distanceM != null ? (
            <span
              className={css.measureTag}
              style={{
                left: `${(a.xPct + b.xPct) / 2}%`,
                top: `${(a.yPct + b.yPct) / 2}%`,
              }}
            >
              {distanceM} m
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function measureDistanceMetres(
  points: MeasurePt[],
  mapView: StaticMapView | null,
  worldWidthPx: number,
  worldHeightPx: number,
): number | null {
  if (!mapView || points.length < 2) return null;
  const mpp = metresPerCanvasPixel(mapView, worldWidthPx, worldHeightPx);
  const [p0, p1] = points;
  const dx = ((p1!.xPct - p0!.xPct) / 100) * worldWidthPx * mpp.x;
  const dy = ((p1!.yPct - p0!.yPct) / 100) * worldHeightPx * mpp.y;
  return Math.round(Math.hypot(dx, dy) * 10) / 10;
}

/** Ghost brush size in px from catalog width (m) and aerial ground scale. */
export function ghostSizeFromMetres(
  widthM: number,
  mapView: StaticMapView | null,
  worldWidthPx: number,
  worldHeightPx: number,
): number {
  if (!mapView || worldWidthPx <= 0) {
    return Math.max(24, Math.min(96, widthM * 28));
  }
  const mpp = metresPerCanvasPixel(mapView, worldWidthPx, worldHeightPx);
  return Math.max(16, Math.min(160, widthM / Math.max(mpp.x, 0.001)));
}
