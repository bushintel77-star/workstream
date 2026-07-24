"use client";

import type { DesignKeylessOverlay } from "@workstream/contracts";
import type { PctPoint } from "../../geometry";
import {
  PLAN_LOT_HATCH_CLIP_ID,
  shouldPaintKeylessFill,
} from "../../geometry/keylessRingClip";
import css from "./keylessWash.module.css";

type Props = {
  active: boolean;
  overlays: DesignKeylessOverlay[];
  /**
   * Title boundary — hatch fills clip to this ring (never the full SVG board).
   * Same contract as ClimateBedWash: pattern belongs to geometry, not the wrapper.
   */
  boundary: PctPoint[];
};

function ptsAttr(ring: Array<{ x_pct: number; y_pct: number }>): string {
  return ring.map((p) => `${p.x_pct},${p.y_pct}`).join(" ");
}

function boundaryPtsAttr(ring: PctPoint[]): string {
  return ring.map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * Soft KEYLESS Vicmap washes — planning / bushfire / flood / heritage / contour.
 * Contours draw as strokes; area overlays as translucent fills clipped to title.
 */
export function KeylessOverlayWash({ active, overlays, boundary }: Props) {
  if (!active || overlays.length === 0) return null;

  const lotClip =
    boundary.length >= 3 ? boundaryPtsAttr(boundary) : null;

  return (
    <svg
      className={css.root}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="keyless-overlay-wash"
      aria-hidden
    >
      <defs>
        {lotClip ? (
          <clipPath
            id={PLAN_LOT_HATCH_CLIP_ID}
            clipPathUnits="userSpaceOnUse"
          >
            <polygon points={lotClip} />
          </clipPath>
        ) : null}
        {/* Planning: fine single diagonal + faint plum tint. */}
        <pattern
          id="ws-keyless-planning"
          width="2.6"
          height="2.6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="2.6" height="2.6" fill="#6b5b8c" fillOpacity="0.05" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="2.6"
            stroke="#6b5b8c"
            strokeWidth="0.4"
            strokeOpacity="0.42"
          />
        </pattern>
        {/* Bushfire: coarser cross-hatch in ember sienna — reads as hazard. */}
        <pattern
          id="ws-keyless-bushfire"
          width="2.4"
          height="2.4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="2.4" height="2.4" fill="#9a3412" fillOpacity="0.06" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="2.4"
            stroke="#9a3412"
            strokeWidth="0.45"
            strokeOpacity="0.45"
          />
          <line
            x1="0"
            y1="0"
            x2="2.4"
            y2="0"
            stroke="#9a3412"
            strokeWidth="0.45"
            strokeOpacity="0.45"
          />
        </pattern>
        {/* Flood / LSIO: cool blue wash — distinct from bushfire ember. */}
        <pattern
          id="ws-keyless-flood"
          width="2.5"
          height="2.5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(30)"
        >
          <rect width="2.5" height="2.5" fill="#1d4ed8" fillOpacity="0.05" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="2.5"
            stroke="#1d4ed8"
            strokeWidth="0.38"
            strokeOpacity="0.4"
          />
        </pattern>
        {/* Heritage: warm brick diagonal — fabric / visibility cue. */}
        <pattern
          id="ws-keyless-heritage"
          width="2.7"
          height="2.7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-30)"
        >
          <rect width="2.7" height="2.7" fill="#7c2d12" fillOpacity="0.045" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="2.7"
            stroke="#7c2d12"
            strokeWidth="0.36"
            strokeOpacity="0.38"
          />
        </pattern>
        {/* Generic overlay: opposite fine diagonal in teal. */}
        <pattern
          id="ws-keyless-generic"
          width="2.8"
          height="2.8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width="2.8" height="2.8" fill="#0e7490" fillOpacity="0.045" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="2.8"
            stroke="#0e7490"
            strokeWidth="0.36"
            strokeOpacity="0.4"
          />
        </pattern>
        {/* Water corp: cool aqua wash — street / authority cue, not dig truth. */}
        <pattern
          id="ws-keyless-water"
          width="2.5"
          height="2.5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(30)"
        >
          <rect width="2.5" height="2.5" fill="#0e7490" fillOpacity="0.05" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="2.5"
            stroke="#0e7490"
            strokeWidth="0.38"
            strokeOpacity="0.42"
          />
        </pattern>
        {/* Road casement / frontage: warm slate wash. */}
        <pattern
          id="ws-keyless-road"
          width="2.6"
          height="2.6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(0)"
        >
          <rect width="2.6" height="2.6" fill="#57534e" fillOpacity="0.05" />
          <line
            x1="0"
            y1="0"
            x2="2.6"
            y2="0"
            stroke="#57534e"
            strokeWidth="0.34"
            strokeOpacity="0.4"
          />
        </pattern>
      </defs>
      <g
        clipPath={
          lotClip ? `url(#${PLAN_LOT_HATCH_CLIP_ID})` : undefined
        }
        data-lot-clip={lotClip ? "1" : "0"}
      >
        {overlays.flatMap((ov) =>
          ov.rings.map((ring, i) => {
            if (ring.length < 2) return null;
            const pts = ptsAttr(ring);
            if (ov.kind === "contour" || ring.length < 3) {
              return (
                <polyline
                  key={`${ov.kind}-${i}`}
                  points={pts}
                  className={css.contour}
                  data-kind={ov.kind}
                  data-testid="keyless-contour"
                />
              );
            }
            if (!shouldPaintKeylessFill(ov.kind, ring)) {
              return null;
            }
            const cls =
              ov.kind === "bushfire"
                ? css.bushfire
                : ov.kind === "planning"
                  ? css.planning
                  : ov.kind === "flood"
                    ? css.flood
                    : ov.kind === "heritage"
                      ? css.heritage
                      : ov.kind === "water_corp"
                        ? css.waterCorp
                        : ov.kind === "road_casement"
                          ? css.roadCasement
                          : css.generic;
            const patternId =
              ov.kind === "bushfire"
                ? "ws-keyless-bushfire"
                : ov.kind === "planning"
                  ? "ws-keyless-planning"
                  : ov.kind === "flood"
                    ? "ws-keyless-flood"
                    : ov.kind === "heritage"
                      ? "ws-keyless-heritage"
                      : ov.kind === "water_corp"
                        ? "ws-keyless-water"
                        : ov.kind === "road_casement"
                          ? "ws-keyless-road"
                          : "ws-keyless-generic";
            return (
              <polygon
                key={`${ov.kind}-${i}`}
                points={pts}
                className={cls}
                fill={`url(#${patternId})`}
                data-kind={ov.kind}
                data-testid={`keyless-wash-${ov.kind}`}
              />
            );
          }),
        )}
      </g>
    </svg>
  );
}
