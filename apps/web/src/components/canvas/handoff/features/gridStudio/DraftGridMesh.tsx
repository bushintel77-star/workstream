"use client";

import {
  GRID_INK_STROKE,
  type GridFormation,
  type GridGrain,
  type GridInk,
} from "../../geometry/gridStudio";
import css from "../cadPlan/cadPlan.module.css";

type Props = {
  grain: GridGrain;
  step: number;
  formation: GridFormation;
  ink: GridInk;
};

/**
 * Board mesh for the micro grid studio — ortho / dots / diamond / veil.
 * Snap still uses grain step; this is visual preference only.
 */
export function DraftGridMesh({ step, formation, ink }: Props) {
  const stroke = GRID_INK_STROKE[ink];
  const veil = formation === "veil" ? 0.55 : 1;
  const marks = Array.from(
    { length: Math.floor(100 / step) + 1 },
    (_, i) => i * step,
  );
  /** Diamond uses a coarser visual step so the lattice stays calm. */
  const diagStep = Math.max(step, 5);
  const diagMarks = Array.from(
    { length: Math.floor(200 / diagStep) + 1 },
    (_, i) => i * diagStep - 50,
  );

  return (
    <svg
      className={css.draftGrid}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      data-testid="draft-grid"
      data-formation={formation}
      data-ink={ink}
    >
      {formation === "ortho" || formation === "veil"
        ? marks.map((v) => (
            <g key={`o${v}`} opacity={veil}>
              <line
                x1={v}
                y1={0}
                x2={v}
                y2={100}
                stroke={stroke}
                strokeWidth={formation === "veil" ? 0.08 : 0.12}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={0}
                y1={v}
                x2={100}
                y2={v}
                stroke={stroke}
                strokeWidth={formation === "veil" ? 0.08 : 0.12}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))
        : null}

      {formation === "dots"
        ? marks.flatMap((x) =>
            marks.map((y) => (
              <circle
                key={`d${x}-${y}`}
                cx={x}
                cy={y}
                r={0.35}
                fill={stroke}
              />
            )),
          )
        : null}

      {formation === "diamond"
        ? diagMarks.map((v) => (
            <g key={`m${v}`}>
              <line
                x1={v}
                y1={-20}
                x2={v + 120}
                y2={100}
                stroke={stroke}
                strokeWidth={0.1}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={v}
                y1={-20}
                x2={v - 120}
                y2={100}
                stroke={stroke}
                strokeWidth={0.1}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))
        : null}
    </svg>
  );
}
