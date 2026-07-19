"use client";

import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
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
        {[0, 3, 6, 9].map((m) => {
          const y = 36 - (m / 9) * 30;
          return (
            <g key={m}>
              <line
                x1={8}
                y1={y}
                x2={96}
                y2={y}
                stroke="rgba(36,19,24,0.12)"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={6.5}
                y={y + 0.8}
                textAnchor="end"
                fill="rgba(36,19,24,0.5)"
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
          stroke="rgba(36,19,24,0.35)"
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
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
        {items
          .filter((i) => BY_TYPE[i.t].heightM)
          .map((it) => {
            const d = BY_TYPE[it.t];
            const hm = (d.heightM ?? 1) * it.scale;
            const c = axis === "x" ? it.x : it.y;
            const x = 12 + ((c - minC) / span) * 70;
            const h = (hm / 9) * 30;
            const y = 36 - h;
            const w = it.ghost ? 4 : 5;
            const selected = it.id === selectedId && !it.ghost;
            return (
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
                    it.ghost ? "rgba(232,184,75,0.15)" : "rgba(194,69,95,0.18)"
                  }
                  stroke={selected ? "#C2455F" : it.ghost ? "#E8B84B" : "#C2455F"}
                  strokeWidth={selected ? 1.1 : 0.6}
                  strokeDasharray={it.ghost ? "2 2" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={x + w / 2}
                  y={y - 0.8}
                  textAnchor="middle"
                  fill="#7A5560"
                  fontSize={1.8}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {d.tag} · {hm.toFixed(1)} m
                </text>
              </g>
            );
          })}
        <text
          x={96}
          y={39}
          textAnchor="end"
          fill="#7A5560"
          fontSize={2.2}
          fontFamily="IBM Plex Mono, monospace"
        >
          Site width ≈ {widthM.toFixed(1)} m
        </text>
      </svg>
    </div>
  );
}
