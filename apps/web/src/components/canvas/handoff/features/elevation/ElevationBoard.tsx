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

/** ViewBox height — geometry only; labels are HTML so they never stretch. */
const VB_H = 40;
const GROUND_Y = 36;
const PLOT_H = 30;
const PLOT_X0 = 10;
const PLOT_W = 78;

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

function vbToPct(x: number, y: number) {
  return {
    left: `${x}%`,
    top: `${(y / VB_H) * 100}%`,
  };
}

/**
 * Front/side elevation — geometry in a stretch SVG; ticks + callouts as
 * fixed-px HTML so labels stay reading-size on wide boards.
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
    ? PLOT_X0 + ((Math.min(...bCoords) - minC) / span) * PLOT_W
    : PLOT_X0 + PLOT_W * 0.22;
  const b1 = bCoords.length
    ? PLOT_X0 + ((Math.max(...bCoords) - minC) / span) * PLOT_W
    : PLOT_X0 + PLOT_W * 0.55;

  /** Vertical scale hugs the tallest asset — avoid empty 6–9 m air. */
  const maxHM = useMemo(() => {
    const tallest = items
      .filter((i) => BY_TYPE[i.t].heightM)
      .reduce((m, it) => Math.max(m, (BY_TYPE[it.t].heightM ?? 1) * it.scale), 0);
    if (tallest <= 0) return 6;
    return Math.min(12, Math.max(tallest + 0.75, tallest * 1.2));
  }, [items]);

  const elevItems = useMemo(() => {
    return items
      .filter((i) => BY_TYPE[i.t].heightM)
      .map((it) => {
        const d = BY_TYPE[it.t];
        const hm = (d.heightM ?? 1) * it.scale;
        const c = axis === "x" ? it.x : it.y;
        const x = PLOT_X0 + ((c - minC) / span) * PLOT_W;
        const h = (hm / maxHM) * PLOT_H;
        const y = GROUND_Y - h;
        /** Narrow bars — readable as stems, not fat cards. */
        const w = it.ghost ? 1.6 : d.elevShape === "hedge" || d.elevShape === "deck" ? 3.2 : 2.2;
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
        { viewW: 100, viewH: VB_H, pad: 1 },
      ),
    [elevItems],
  );

  const ticks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const m = maxHM * t;
      const y = GROUND_Y - t * PLOT_H;
      return { m, y, t };
    });
  }, [maxHM]);

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
        <span className={css.widthChip}>
          Site width ≈ {widthM.toFixed(1)} m
        </span>
      </div>
      <div className={css.north} aria-hidden>
        N↑
      </div>
      <PlanThumbnail
        boundary={boundary}
        building={building}
        items={items}
        selectedId={selectedId}
      />
      <div className={css.stage}>
        <svg
          className={css.svg}
          viewBox={`0 0 100 ${VB_H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <g data-layer="datum">
            {ticks.map(({ y, t }) => (
              <line
                key={`g-${t}`}
                x1={PLOT_X0 - 2}
                y1={y}
                x2={PLOT_X0 + PLOT_W + 4}
                y2={y}
                stroke="rgba(140,138,133,0.28)"
                strokeWidth={0.3}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <line
              x1={PLOT_X0 - 2}
              y1={GROUND_Y}
              x2={PLOT_X0 + PLOT_W + 4}
              y2={GROUND_Y}
              stroke="rgba(26,26,26,0.45)"
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          </g>

          <g data-layer="building">
            <rect
              x={b0}
              y={GROUND_Y - PLOT_H * 0.55}
              width={Math.max(3, b1 - b0)}
              height={PLOT_H * 0.55}
              fill="rgba(36,19,24,0.05)"
              stroke="#241318"
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
            />
          </g>

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
                    it.ghost ? "rgba(232,184,75,0.22)" : "rgba(194,69,95,0.28)"
                  }
                  stroke={
                    selected ? "#C2455F" : it.ghost ? "#E8B84B" : "#C2455F"
                  }
                  strokeWidth={selected ? 1 : 0.55}
                  strokeDasharray={it.ghost ? "1.5 1.2" : undefined}
                  vectorEffect="non-scaling-stroke"
                  opacity={it.ghost ? 0.5 : 1}
                />
              </g>
            ))}
          </g>

          {/* Leaders only — text is HTML */}
          <g data-layer="leaders">
            {labelPlacements.map((p) =>
              p.leader ? (
                <line
                  key={`ld-${p.id}`}
                  x1={p.leader.x1}
                  y1={p.leader.y1}
                  x2={p.leader.x2}
                  y2={p.leader.y2}
                  stroke="rgba(92,90,85,0.4)"
                  strokeWidth={0.2}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
          </g>
        </svg>

        <div className={css.hud} data-testid="elevation-hud">
          {ticks.map(({ m, y }) => {
            const pos = vbToPct(PLOT_X0 - 3.5, y);
            return (
              <span
                key={`tick-${m}`}
                className={css.tick}
                style={{ left: pos.left, top: pos.top }}
              >
                {m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.round(m)}m
              </span>
            );
          })}

          {labelPlacements.map((p) => {
            const active =
              elevItems.find((e) => e.it.id === p.id)?.selected ?? false;
            const pos = vbToPct(p.x, p.y);
            return (
              <button
                key={`lbl-${p.id}`}
                type="button"
                className={`${css.label}${active ? ` ${css.labelActive}` : ""}`}
                data-testid="elevation-label"
                style={{ left: pos.left, top: pos.top }}
                onClick={() => {
                  const item = elevItems.find((e) => e.it.id === p.id)?.it;
                  if (item && !item.ghost) onSelect(item.id);
                }}
              >
                {p.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
