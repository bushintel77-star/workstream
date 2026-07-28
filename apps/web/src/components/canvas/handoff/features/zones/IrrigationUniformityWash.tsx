"use client";

import type { IrrigUniformityReport } from "@workstream/domain";
import css from "./irrigationUniformity.module.css";

type Props = {
  active: boolean;
  report: IrrigUniformityReport | null;
};

/**
 * Atelier coverage wash — dry / ok / wet cells from indicative spray DU.
 * Renders inside the zoom world (board geometry); chrome readout is separate.
 */
export function IrrigationUniformityWash({ active, report }: Props) {
  if (!active || !report || report.cells.length === 0) return null;

  const step =
    report.scaleM > 0 ? Math.max(1.2, (1.5 / report.scaleM) * 100) : 2.5;
  const half = step / 2;

  return (
    <svg
      className={css.wash}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="irrigation-uniformity-wash"
      aria-hidden
    >
      {report.cells.map((c, i) => (
        <rect
          key={`${c.x.toFixed(1)}-${c.y.toFixed(1)}-${i}`}
          x={c.x - half}
          y={c.y - half}
          width={step}
          height={step}
          className={css[c.band]}
          data-band={c.band}
        />
      ))}
      {report.heads.map((h, i) => (
        <circle
          key={`h-${h.zoneId}-${i}`}
          cx={h.x}
          cy={h.y}
          r={0.55}
          className={css.head}
        />
      ))}
    </svg>
  );
}
