"use client";

import type { CanvasAnnotation } from "@workstream/contracts";
import ao from "./canvasAnnotationOverlay.module.css";

type Props = {
  annotations: CanvasAnnotation[];
  width: number;
  height: number;
};

export function CanvasAnnotationOverlay({ annotations, width, height }: Props) {
  if (annotations.length === 0) return null;

  return (
    <svg
      className={ao.layer}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      {annotations.map((a) => {
        const x = (a.x_pct / 100) * width;
        const y = (a.y_pct / 100) * height;
        if (a.kind === "text") {
          return (
            <text
              key={a.id}
              x={x}
              y={y}
              className={ao.text}
              fontSize={11}
            >
              {a.text ?? "Label"}
            </text>
          );
        }
        if (a.kind === "dimension" && a.x2_pct != null && a.y2_pct != null) {
          const x2 = (a.x2_pct / 100) * width;
          const y2 = (a.y2_pct / 100) * height;
          const mx = (x + x2) / 2;
          const my = (y + y2) / 2;
          return (
            <g key={a.id}>
              <line x1={x} y1={y} x2={x2} y2={y2} className={ao.dimLine} />
              <text x={mx} y={my - 4} className={ao.dimLabel} fontSize={9}>
                {a.text ?? "dim"}
              </text>
            </g>
          );
        }
        if (a.kind === "arrow" && a.x2_pct != null && a.y2_pct != null) {
          const x2 = (a.x2_pct / 100) * width;
          const y2 = (a.y2_pct / 100) * height;
          return (
            <line key={a.id} x1={x} y1={y} x2={x2} y2={y2} className={ao.arrow} />
          );
        }
        return null;
      })}
    </svg>
  );
}
