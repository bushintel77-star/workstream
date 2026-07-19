"use client";

import { useMemo } from "react";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import {
  elevationLabelText,
  layoutElevationLabels,
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
 * Stack: datum → building → vegetation → labels (bbox layout + parchment mask).
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

  /** True vertical scale — datum fits tallest asset (not a fixed 9 m clip). */
  const maxHM = useMemo(() => {
    const tallest = items
      .filter((i) => BY_TYPE[i.t].heightM)
      .reduce((m, it) => Math.max(m, (BY_TYPE[it.t].heightM ?? 1) * it.scale), 0);
    return Math.max(9, tallest + 0.5);
  }, [items]);

  const elevItems = useMemo(() => {
    return items
      .filter((i) => BY_TYPE[i.t].heightM)
      .map((it) => {
        const d = BY_TYPE[it.t];
        const hm = (d.heightM ?? 1) * it.scale;
        const c = axis === "x" ? it.x : it.y;
        const x = 12 + ((c - minC) / span) * 70;
        const h = (hm / maxHM) * 30;
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
  }, [items, axis, minC, span, selectedId, maxHM]);

  const labelPlacements = useMemo(
    () =>
      layoutElevationLabels(
        elevItems.map((e) => ({
          id: e.it.id,
          barX: e.x + e.w / 2,
          barTopY: e.y,
          text: elevationLabelText(e.d.tag, e.hm),
        })),
      ),
    [elevItems],
  );

  const labelById = useMemo(() => {
    const m = new Map(labelPlacements.map((p) => [p.id, p]));
    return m;
  }, [labelPlacements]);

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
      <div className={css.stage}>
        <svg
          className={css.svg}
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          overflow="visible"
        >
          {/* Z10 — datum guidelines + margin ticks */}
          <g data-layer="datum">
            {[0, 0.33, 0.66, 1].map((t) => {
              const m = Math.round(maxHM * t);
              const y = 36 - t * 30;
              return (
                <g key={`${m}-${t}`}>
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
                  stroke={
                    selected ? "#C2455F" : it.ghost ? "#E8B84B" : "#C2455F"
                  }
                  strokeWidth={selected ? 1.1 : 0.6}
                  strokeDasharray={it.ghost ? "2 2" : undefined}
                  vectorEffect="non-scaling-stroke"
                  opacity={it.ghost ? 0.55 : selected ? 1 : 0.92}
                />
              </g>
            ))}
          </g>

          {/* Z40 — bbox-laid labels with parchment clearance + leaders */}
          <g data-layer="labels">
            {elevItems.map(({ it }) => {
              const p = labelById.get(it.id);
              if (!p) return null;
              const active = it.id === selectedId && !it.ghost;
              return (
                <g key={`lbl-${it.id}`} data-testid="elevation-label">
                  {p.leader ? (
                    <line
                      x1={p.leader.x1}
                      y1={p.leader.y1}
                      x2={p.leader.x2}
                      y2={p.leader.y2}
                      stroke="rgba(92,90,85,0.45)"
                      strokeWidth={0.25}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  <rect
                    x={p.x - p.maskW / 2}
                    y={p.y - 2.15}
                    width={p.maskW}
                    height={p.maskH}
                    rx={0.35}
                    fill="#faf6f2"
                    stroke={
                      active ? "rgba(194,69,95,0.45)" : "rgba(36,19,24,0.08)"
                    }
                    strokeWidth={0.2}
                    opacity={0.96}
                  />
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    fill={active ? "#241318" : "#5c5a55"}
                    fontSize={1.75}
                    fontWeight={active ? 600 : 500}
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {p.text}
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
    </div>
  );
}
