"use client";

import {
  polylineLengthFromCanvasPercent,
  type CanvasGroundScale,
} from "@workstream/domain";
import type { CanvasPointPct } from "@workstream/contracts";
import s from "../designStudio.module.css";

type Props = {
  points: CanvasPointPct[];
  canvasWidthPx: number;
  canvasHeightPx: number;
  scale: CanvasGroundScale;
};

export function MeasureOverlay({ points, canvasWidthPx, canvasHeightPx, scale }: Props) {
  if (points.length === 0) return null;

  const toPx = (p: CanvasPointPct) => ({
    x: (p.x_pct / 100) * canvasWidthPx,
    y: (p.y_pct / 100) * canvasHeightPx,
  });

  const pxPoints = points.map(toPx);
  const lengthM =
    points.length >= 2 ? polylineLengthFromCanvasPercent(points, scale) : 0;

  const mid =
    pxPoints.length >= 2
      ? {
          x: (pxPoints[0]!.x + pxPoints[1]!.x) / 2,
          y: (pxPoints[0]!.y + pxPoints[1]!.y) / 2,
        }
      : pxPoints[0];

  return (
    <>
      <svg
        className={s.overlayLayer}
        viewBox={`0 0 ${canvasWidthPx} ${canvasHeightPx}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {pxPoints.length >= 2 ? (
          <line
            x1={pxPoints[0]!.x}
            y1={pxPoints[0]!.y}
            x2={pxPoints[1]!.x}
            y2={pxPoints[1]!.y}
            className={s.measureLine}
          />
        ) : null}
        {pxPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} className={s.measureVertex} />
        ))}
      </svg>
      {mid && points.length >= 2 ? (
        <div
          className={s.measureLabel}
          style={{ left: mid.x, top: mid.y }}
          aria-live="polite"
        >
          {lengthM.toFixed(1)} m (indicative)
        </div>
      ) : null}
    </>
  );
}
