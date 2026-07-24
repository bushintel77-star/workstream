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
  /**
   * Extra board-% padding beyond 0…100 so tilt foreshortening does not
   * hard-cut the drafting mesh into a postage-stamp plate.
   */
  extendPadPct?: number;
};

/**
 * Board mesh for the micro grid studio — ortho / dots / diamond / veil.
 * Snap still uses grain step; this is visual preference only.
 */
export function DraftGridMesh({
  step,
  formation,
  ink,
  extendPadPct = 0,
}: Props) {
  const stroke = GRID_INK_STROKE[ink];
  const veil = formation === "veil" ? 0.55 : 1;
  const pad = Math.max(0, extendPadPct);
  const min = -pad;
  const max = 100 + pad;
  const span = 100 + pad * 2;
  const marks = Array.from(
    { length: Math.floor(span / step) + 1 },
    (_, i) => min + i * step,
  );
  /** Diamond uses a coarser visual step so the lattice stays calm. */
  const diagStep = Math.max(step, 5);
  const diagMarks = Array.from(
    { length: Math.floor((span + 100) / diagStep) + 1 },
    (_, i) => min - 50 + i * diagStep,
  );

  return (
    <svg
      className={css.draftGrid}
      viewBox={`${min} ${min} ${span} ${span}`}
      preserveAspectRatio="none"
      aria-hidden
      data-testid="draft-grid"
      data-formation={formation}
      data-ink={ink}
      data-extend-pad={pad}
      style={
        pad > 0
          ? {
              left: `${-pad}%`,
              top: `${-pad}%`,
              width: `${span}%`,
              height: `${span}%`,
            }
          : undefined
      }
    >
      {formation === "ortho" || formation === "veil"
        ? marks.map((v) => (
            <g key={`o${v}`} opacity={veil}>
              <line
                x1={v}
                y1={min}
                x2={v}
                y2={max}
                stroke={stroke}
                strokeWidth={formation === "veil" ? 0.08 : 0.12}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={min}
                y1={v}
                x2={max}
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
                y1={min - 20}
                x2={v + span + 20}
                y2={max}
                stroke={stroke}
                strokeWidth={0.1}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={v}
                y1={min - 20}
                x2={v - span - 20}
                y2={max}
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
