"use client";

import type { StaticMapView } from "../../lib/mapView";
import { indicativeScaleBar } from "../../lib/mapView";
import s from "../designStudio.module.css";

type Props = {
  mapView: StaticMapView;
  canvasWidthPx: number;
};

export function ScaleBar({ mapView, canvasWidthPx }: Props) {
  const bar = indicativeScaleBar(mapView, canvasWidthPx);
  return (
    <div className={s.scaleBar} data-testid="design-studio-scale-bar" aria-label={`Indicative scale: ${bar.metres} metres`}>
      <span className={s.scaleBarLabel}>{bar.metres} m</span>
      <span className={s.scaleBarLine} style={{ width: `${bar.barPx}px` }} />
      <span className={s.scaleBarHint}>Indicative only</span>
    </div>
  );
}
