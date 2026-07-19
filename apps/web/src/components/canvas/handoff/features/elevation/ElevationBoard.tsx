"use client";

import { useMemo } from "react";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import {
  assignElevationLabelStacks,
  elevationLabelOffsetY,
} from "../../geometry";
import { PlanThumbnail } from "./PlanThumbnail";
import css from "./elevation.module.css";

type Props = {
  axis: "x" | "y";
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleAxis: () => void;
  onTraceInPlan: (id: string) => void;
};

/**
 * Full-mode elevation profile — front/side cut through the working drawing.
 * Stack: datum → building → vegetation → labels (collision-stacked + parchment mask).
 */
export function ElevationBoard({
  axis,
  boundary,
  building,
  items,
  selectedId,
  onSelect,
  onToggleAxis,
  onTraceInPlan,
}: Props) {
  const coords = boundary.map((p) => (axis === "x" ? p.x : p.y));
  const minC = Math.min(...coords);
  const maxC = Math.max(...coords);
  const span = Math.max(1, maxC - minC);
  const widthM = (span / 100) * 110;

  const bCoords = building.map((p) => (axis === "x" ? p.x : p.y));
  const b0 = bCoords.length
    ? ((Math.min(...bCoords) - minC) / span) * 70 + 12
    : 28;
  const b1 = bCoords.length
    ? ((Math.max(...bCoords) - minC) / span) * 70 + 12
    : 50;

  const elevItems = useMemo(() => {
    return items
      .filter((i) => BY_TYPE[i.t].heightM)
      .map((it) => {
        const d = BY_TYPE[it.t];
        const hm = (d.heightM ?? 1) * it.scale;
        const c = axis === "x" ? it.x : it.y;
        const x = 12 + ((c - minC) / span) * 70;
        const h = (hm / 9) * 30;
        const y = 36 - h;
        const w = it.ghost ? 4 : 5;
        return {
          it,
          d,
          hm,
          x,
          y,
          w,
          h,
          selected: it.id === selectedId && !it.ghost,
        };
      });
  }, [items, axis, minC, span, selectedId]);

  const labelStacks = useMemo(
    () =>
      assignElevationLabelStacks(
        elevItems.map((e) => ({ id: e.it.id, x: e.x + e.w / 2 })),
        12,
      ),
    [elevItems],
  );

  return (
    <div className={css.root} data-testid="elevation-profile">
      <div className={css.topRow}>
        <button type="button" className={css.toggle} onClick={onToggleAxis}>
          {axis === "x" ? "Front elevation" : "Side elevation"}
        </button>
        {selectedId && items.some((i) => i.id === selectedId && !i.ghost) ? (
          <button
            type="button"
            className={css.tracePlan}
            data-testid="trace-in-plan"
            onClick={() => onTraceInPlan(selectedId)}
          >
            Trace in plan
          </button>
        ) : null}
      </div>
      <div className={css.north}>N↑</div>
      <PlanThumbnail
        boundary={boundary}
        building={building}
        items={items}
        selectedId={selectedId}
      />
      <svg className={css.svg} viewBox="0 0 100 40" preserveAspectRatio="none">
        {/* Z10 — datum guidelines + margin ticks */}
        <g data-layer="datum">
          {[0, 3, 6, 9].map((m) => {
            const y = 36 - (m / 9) * 30;
            return (
              <g key={m}>
                <line
                  x1={8}
                  y1={y}
                  x2={96}
                  y2={y}
                  stroke="rgba(140,138,133,0.35)"
                  strokeWidth={0.35}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={6.5}
                  y={y + 0.8}
                  textAnchor="end"
                  fill="rgba(140,138,133,0.85)"
                  fontSize={2.2}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {m}m
                </text>
              </g>
            );
          })}
          <line
            x1={8}
            y1={36}
            x2={96}
            y2={36}
            stroke="rgba(26,26,26,0.4)"
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Z20 — building profile (below vegetation so bars are not sheared) */}
        <g data-layer="building">
          <rect
            x={b0}
            y={18}
            width={Math.max(4, b1 - b0)}
            height={18}
            fill="rgba(36,19,24,0.06)"
            stroke="#241318"
            strokeWidth={0.7}
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Z30 — vegetation / height bars */}
        <g data-layer="vegetation">
          {elevItems.map(({ it, x, y, w, h, selected }) => (
            <g
              key={it.id}
              style={{ cursor: it.ghost ? "default" : "pointer" }}
              onClick={() => {
                if (!it.ghost) onSelect(it.id);
              }}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={
                  it.ghost ? "rgba(232,184,75,0.2)" : "rgba(194,69,95,0.22)"
                }
                stroke={selected ? "#C2455F" : it.ghost ? "#E8B84B" : "#C2455F"}
                strokeWidth={selected ? 1.1 : 0.6}
                strokeDasharray={it.ghost ? "2 2" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>

        {/* Z40 — collision-stacked labels with parchment clearance masks */}
        <g data-layer="labels">
          {elevItems.map(({ it, d, hm, x, y, w }) => {
            const stack = labelStacks.get(it.id) ?? 0;
            const lx = x + w / 2;
            const ly = y - 0.8 - elevationLabelOffsetY(stack);
            const text = `${d.tag} · ${hm.toFixed(1)} m`;
            const maskW = Math.min(28, 6 + text.length * 1.15);
            return (
              <g key={`lbl-${it.id}`}>
                <rect
                  x={lx - maskW / 2}
                  y={ly - 2.2}
                  width={maskW}
                  height={2.8}
                  rx={0.4}
                  fill="#faf6f2"
                  opacity={0.92}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  fill="#5c5a55"
                  fontSize={1.8}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {text}
                </text>
              </g>
            );
          })}
          <text
            x={96}
            y={39}
            textAnchor="end"
            fill="#8c8a85"
            fontSize={2.2}
            fontFamily="IBM Plex Mono, monospace"
          >
            Site width ≈ {widthM.toFixed(1)} m
          </text>
        </g>
      </svg>
    </div>
  );
}
