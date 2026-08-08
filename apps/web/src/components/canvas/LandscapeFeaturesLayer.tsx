"use client";

import type { LandscapeFeature } from "@workstream/contracts";
import css from "./landscapeFeaturesLayer.module.css";

type Props = {
  features: LandscapeFeature[];
  paper?: boolean;
  onSelect?: (feature: LandscapeFeature) => void;
};

function pointsAttr(
  feature: LandscapeFeature,
): string {
  return feature.geometry.points
    .map((v) => `${v.pct.x_pct},${v.pct.y_pct}`)
    .join(" ");
}

/** Persisted structured tools (ditch/path/wall/bed) drawn on the plan. */
export function LandscapeFeaturesLayer({
  features,
  paper = false,
  onSelect,
}: Props) {
  if (features.length === 0) return null;

  return (
    <div
      className={`${css.layer}${paper ? ` ${css.paper}` : ""}`}
      data-testid="landscape-features-layer"
    >
      <svg
        className={css.svg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {features.map((f) => {
          const pts = pointsAttr(f);
          const isPoly = f.geometry.type === "Polygon";
          const soft = f.metadata.layer === "softscape_beds";
          const structure = f.metadata.layer === "structure";
          return (
            <g key={f.id}>
              {isPoly ? (
                <polygon
                  className={`${css.shape} ${soft ? css.soft : css.hard}`}
                  points={pts}
                  data-testid={`landscape-feature-${f.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(f);
                  }}
                />
              ) : (
                <polyline
                  className={`${css.line} ${structure ? css.wall : css.path}`}
                  points={pts}
                  data-testid={`landscape-feature-${f.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(f);
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
