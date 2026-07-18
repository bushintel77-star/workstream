"use client";

import { useMemo } from "react";
import {
  buildIndicativeEasements,
  buildIndicativeShadeGrid,
  SHADE_GRID_SIZE,
} from "@workstream/domain";
import {
  projectLngLatToPercent,
  type StaticMapView,
} from "../../lib/mapView";
import css from "./siteIntelligenceOverlay.module.css";

type Props = {
  mapView: StaticMapView;
  lotRing: [number, number][];
  lat: number;
  lng: number;
  when: Date;
  showShade: boolean;
  showEasements: boolean;
};

function shadeFill(sunHours: number): string {
  const t = Math.min(1, sunHours / 10);
  const alpha = 0.12 + t * 0.36;
  return `color-mix(in srgb, var(--warn) ${Math.round(alpha * 100)}%, transparent)`;
}

/** Sun/shade grid + easement hatch overlays on the aerial world plane. */
export function SiteIntelligenceOverlay({
  mapView,
  lotRing,
  lat,
  lng,
  when,
  showShade,
  showEasements,
}: Props) {
  const shadeCells = useMemo(() => {
    if (!showShade) return [];
    return buildIndicativeShadeGrid(lat, lng, when);
  }, [showShade, lat, lng, when]);

  const easements = useMemo(() => {
    if (!showEasements) return [];
    return buildIndicativeEasements(lotRing);
  }, [showEasements, lotRing]);

  if (!showShade && !showEasements) return null;

  const cellW = 100 / SHADE_GRID_SIZE;
  const cellH = 100 / SHADE_GRID_SIZE;

  return (
    <svg
      className={css.overlay}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label="Site intelligence overlays"
      data-testid="site-intelligence-overlay"
    >
      {showShade
        ? shadeCells.map((cell) => (
            <rect
              key={`${cell.col}-${cell.row}`}
              x={cell.col * cellW}
              y={cell.row * cellH}
              width={cellW}
              height={cellH}
              fill={shadeFill(cell.sunHours)}
              data-testid="shade-grid-cell"
            />
          ))
        : null}
      {showEasements
        ? easements.map((e) => {
            const points = e.ring
              .map(([lngPt, latPt]) => {
                const [x, y] = projectLngLatToPercent(lngPt, latPt, mapView);
                return `${x},${y}`;
              })
              .join(" ");
            const [cx, cy] = projectLngLatToPercent(
              e.ring.reduce((s, p) => s + p[0], 0) / e.ring.length,
              e.ring.reduce((s, p) => s + p[1], 0) / e.ring.length,
              mapView,
            );
            return (
              <g key={e.id} data-testid="easement-overlay">
                <defs>
                  <pattern
                    id={`easement-hatch-${e.id}`}
                    patternUnits="userSpaceOnUse"
                    width="4"
                    height="4"
                    patternTransform="rotate(45)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="4"
                      stroke="var(--overlay-easement, rgba(36,24,30,0.38))"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <polygon
                  points={points}
                  fill={`url(#easement-hatch-${e.id})`}
                  stroke="var(--line-hairline, rgba(36,24,30,0.35))"
                  strokeWidth="0.25"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={cx}
                  y={cy}
                  className={css.easementLabel}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {e.label}
                </text>
              </g>
            );
          })
        : null}
    </svg>
  );
}
