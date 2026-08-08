"use client";

import type { TelemetryBoardPoint } from "@workstream/domain";
import css from "./liveTelemetry.module.css";

type Props = {
  active: boolean;
  points: TelemetryBoardPoint[];
};

/**
 * Sensor samples on the board — geometry in zoom-world; dock is CameraChrome.
 */
export function LiveTelemetryWash({ active, points }: Props) {
  if (!active || points.length === 0) return null;

  return (
    <svg
      className={css.wash}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="live-telemetry-wash"
      aria-hidden
    >
      {points.map((p) => (
        <g key={p.reading_id} data-kind={p.kind} data-source={p.source}>
          <circle
            cx={p.x_pct}
            cy={p.y_pct}
            r={1.1}
            className={`${css.dot} ${css[p.kind] ?? ""}`}
          />
          <circle
            cx={p.x_pct}
            cy={p.y_pct}
            r={2.2}
            className={`${css.halo} ${css[p.kind] ?? ""}`}
          />
        </g>
      ))}
    </svg>
  );
}
