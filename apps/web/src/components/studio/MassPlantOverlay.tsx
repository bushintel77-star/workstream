"use client";

import { polylineToSvgPoints } from "@workstream/domain";
import type { CanvasPointPct } from "@workstream/contracts";
import s from "../designStudio.module.css";

type Props = {
  points: CanvasPointPct[];
  closed?: boolean;
  canvasWidthPx: number;
  canvasHeightPx: number;
  draft?: boolean;
};

export function MassPlantOverlay({
  points,
  closed = false,
  canvasWidthPx,
  canvasHeightPx,
  draft = false,
}: Props) {
  if (points.length === 0) return null;

  const polyline = polylineToSvgPoints(points, canvasWidthPx, canvasHeightPx);
  const polygon =
    closed && points.length >= 3
      ? `${polyline} ${polylineToSvgPoints([points[0]!], canvasWidthPx, canvasHeightPx)}`
      : polyline;

  return (
    <svg
      className={s.overlayLayer}
      viewBox={`0 0 ${canvasWidthPx} ${canvasHeightPx}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {closed && points.length >= 3 ? (
        <polygon points={polygon} className={s.massPlantFill} />
      ) : null}
      <polyline
        points={polyline}
        className={draft ? s.massPlantDraft : s.massPlantStroke}
      />
      {points.map((p, i) => {
        const x = (p.x_pct / 100) * canvasWidthPx;
        const y = (p.y_pct / 100) * canvasHeightPx;
        return <circle key={i} cx={x} cy={y} r={3} className={s.massPlantVertex} />;
      })}
    </svg>
  );
}
