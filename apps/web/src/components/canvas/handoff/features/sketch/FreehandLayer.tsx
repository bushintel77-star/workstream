"use client";

import { freehandPath } from "@/lib/freehandPath";
import css from "./freehandLayer.module.css";

type PctPoint = { x: number; y: number };

type Stroke = {
  id: string;
  points: PctPoint[];
  widthPx?: number;
  color?: string | null;
};

type Props = {
  strokes: Stroke[];
  /** ID of a stroke being drawn live (shown at lower opacity). */
  liveId?: string;
};

/**
 * Persistent hand-drawn ink on the main board. Renders freehand strokes with
 * the perfect-freehand algorithm so they keep a premium, hand-lettered feel
 * across all modes (not just the sketch pad).
 */
export function FreehandLayer({ strokes, liveId }: Props) {
  return (
    <svg
      className={css.layer}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="freehand-layer"
    >
      {strokes.map((s) => {
        if (s.points.length < 2) return null;
        const d = freehandPath(s.points, {
          size: (s.widthPx ?? 2) * 0.15,
          thinning: 0.7,
          smoothing: 0.7,
          streamline: 0.5,
        });
        if (!d) return null;
        return (
          <path
            key={s.id}
            d={d}
            className={css.ink}
            fill={s.color ?? "var(--proposed-stroke)"}
            opacity={s.id === liveId ? 0.55 : 0.88}
            style={{ pointerEvents: "none" }}
          />
        );
      })}
    </svg>
  );
}
