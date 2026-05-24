"use client";

import { polylineToSvgPoints } from "@workstream/domain";
import type { CanvasPointPct, IrrigationZone } from "@workstream/contracts";
import s from "../designStudio.module.css";

type Props = {
  zones: IrrigationZone[];
  draftPoints: CanvasPointPct[];
  canvasWidthPx: number;
  canvasHeightPx: number;
};

export function IrrigationOverlay({
  zones,
  draftPoints,
  canvasWidthPx,
  canvasHeightPx,
}: Props) {
  return (
    <svg
      className={s.overlayLayer}
      viewBox={`0 0 ${canvasWidthPx} ${canvasHeightPx}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {zones.map((zone) => {
        if (zone.points.length < 2) return null;
        const pts = polylineToSvgPoints(zone.points, canvasWidthPx, canvasHeightPx);
        return (
          <g key={zone.id}>
            <polyline points={pts} className={s.irrigLine} />
            <polyline points={pts} className={s.irrigEmitterDash} />
          </g>
        );
      })}
      {draftPoints.length >= 2 ? (
        <polyline
          points={polylineToSvgPoints(draftPoints, canvasWidthPx, canvasHeightPx)}
          className={s.irrigDraft}
        />
      ) : null}
    </svg>
  );
}
