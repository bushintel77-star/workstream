"use client";

import { useMemo } from "react";
import {
  projectLngLatToPercent,
  type StaticMapView,
} from "../../lib/mapView";
import css from "./titleParcelOverlay.module.css";

type Props = {
  /** GeoJSON ring [lng, lat][] - title / Vicmap parcel. */
  lotRing: [number, number][];
  mapView: StaticMapView;
};

/**
 * Land-title ring projected into the Mapbox aerial frame (relative %).
 * Read-only - BoundaryOverlay is the editable HITL layer.
 */
export function TitleParcelOverlay({ lotRing, mapView }: Props) {
  const points = useMemo(() => {
    if (lotRing.length < 3) return "";
    return lotRing
      .map(([lng, lat]) => {
        const [x, y] = projectLngLatToPercent(lng, lat, mapView);
        return `${x},${y}`;
      })
      .join(" ");
  }, [lotRing, mapView]);

  if (!points) return null;

  return (
    <svg
      className={css.overlay}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label="Land title boundary"
      data-testid="title-parcel-overlay"
    >
      <polygon className={css.parcel} points={points} />
    </svg>
  );
}
