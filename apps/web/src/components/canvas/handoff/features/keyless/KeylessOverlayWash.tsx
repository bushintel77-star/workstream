"use client";

import type { DesignKeylessOverlay } from "@workstream/contracts";
import css from "./keylessWash.module.css";

type Props = {
  active: boolean;
  overlays: DesignKeylessOverlay[];
};

function ptsAttr(ring: Array<{ x_pct: number; y_pct: number }>): string {
  return ring.map((p) => `${p.x_pct},${p.y_pct}`).join(" ");
}

/**
 * Soft KEYLESS Vicmap washes — planning / bushfire / contour after hydrate.
 * Contours draw as strokes; area overlays as translucent fills.
 */
export function KeylessOverlayWash({ active, overlays }: Props) {
  if (!active || overlays.length === 0) return null;

  return (
    <svg
      className={css.root}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="keyless-overlay-wash"
      aria-hidden
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
          return (
            <polygon
              key={`${ov.kind}-${i}`}
              points={pts}
              className={
                ov.kind === "bushfire"
                  ? css.bushfire
                  : ov.kind === "planning"
                    ? css.planning
                    : css.generic
              }
              data-kind={ov.kind}
              data-testid={`keyless-wash-${ov.kind}`}
            />
          );
        }),
      )}
    </svg>
  );
}
