"use client";

import { freehandPath } from "@/lib/freehandPath";
import css from "./freehandLayer.module.css";

type PctPoint = { x: number; y: number };

type Stroke = {
  id: string;
  points: PctPoint[];
  widthPx?: number;
  color?: string | null;
  /** "shape" (line/rect/circle tool) renders as crisp vector geometry. */
  kind?: "ink" | "shape";
  shapeTool?: "line" | "rect" | "circle";
  shapeStart?: PctPoint;
  shapeEnd?: PctPoint;
};

type Props = {
  strokes: Stroke[];
  /** ID of a stroke being drawn live (shown at lower opacity). */
  liveId?: string;
};

/**
 * Persistent hand-drawn ink on the main board. Renders freehand strokes with
 * the perfect-freehand algorithm so they keep a premium, hand-lettered feel
 * across all modes (not just the sketch pad). Shape-tool strokes (line/rect/
 * circle) instead render as crisp, non-scaling SVG primitives — deliberately
 * distinct from organic ink, matching the CAD board's construction-line look.
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
        const opacity = s.id === liveId ? 0.55 : 0.88;
        const stroke = s.color ?? "var(--proposed-stroke)";

        if (s.kind === "shape" && s.shapeStart && s.shapeEnd) {
          const strokeWidth = s.widthPx ?? 2;
          if (s.shapeTool === "line") {
            return (
              <line
                key={s.id}
                x1={s.shapeStart.x}
                y1={s.shapeStart.y}
                x2={s.shapeEnd.x}
                y2={s.shapeEnd.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity={opacity}
                style={{ pointerEvents: "none" }}
              />
            );
          }
          const x1 = Math.min(s.shapeStart.x, s.shapeEnd.x);
          const y1 = Math.min(s.shapeStart.y, s.shapeEnd.y);
          const x2 = Math.max(s.shapeStart.x, s.shapeEnd.x);
          const y2 = Math.max(s.shapeStart.y, s.shapeEnd.y);
          if (s.shapeTool === "rect") {
            return (
              <rect
                key={s.id}
                x={x1}
                y={y1}
                width={x2 - x1}
                height={y2 - y1}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                opacity={opacity}
                style={{ pointerEvents: "none" }}
              />
            );
          }
          // circle
          return (
            <ellipse
              key={s.id}
              cx={(x1 + x2) / 2}
              cy={(y1 + y2) / 2}
              rx={(x2 - x1) / 2}
              ry={(y2 - y1) / 2}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
              opacity={opacity}
              style={{ pointerEvents: "none" }}
            />
          );
        }

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
            fill={stroke}
            opacity={opacity}
            style={{ pointerEvents: "none" }}
          />
        );
      })}
    </svg>
  );
}
