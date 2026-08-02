"use client";

import { useMemo } from "react";
import {
  cycleElevationLook,
  elevationLookProjector,
  type ElevationLook,
} from "@workstream/domain";
import type { StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import {
  elevationLabelText,
  layoutElevationLabels,
} from "../../geometry";
import { BOARD_WIDTH_M_AT_100 } from "../ground/groundMetrics";
import { PlanThumbnail } from "./PlanThumbnail";
import { ElevationTextureDefs } from "./ElevationTextureDefs";
import { GardenElevationGlyph } from "./GardenElevationGlyph";
import {
  elevationBars,
  elevationBuildingBox,
  elevationCeilingM,
  elevationParcelWidthM,
  elevationSpan,
  type ElevationPlot,
} from "./elevationBars";
import {
  mixOnHex,
  semanticForTheme,
} from "../../../../../styles/colorTokens";
import css from "./elevation.module.css";

/** ViewBox height — geometry only; labels are HTML so they never stretch. */
const VB_H = 40;
const GROUND_Y = 36;
const PLOT_H = 30;
const PLOT_X0 = 10;
const PLOT_W = 78;

/** The board's plot in its own viewBox units. */
const PLOT: ElevationPlot = {
  x0: PLOT_X0,
  w: PLOT_W,
  groundY: GROUND_Y,
  h: PLOT_H,
};

/** Indicative bar widths when nothing knows the asset's spread. */
const FALLBACK_WIDTH = { ghost: 1.6, wide: 3.2, narrow: 2.2 } as const;

type Props = {
  look: ElevationLook;
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  selectedId: string | null;
  /** Metres across the full board width — the live calibrated plan scale. */
  scaleM?: number;
  /** Night lens (pass the studio's darkLens — elevation joins the night). */
  dark?: boolean;
  onSelect: (id: string | null) => void;
  onCycleLook: () => void;
  onTraceInPlan: (id: string) => void;
};

function vbToPct(x: number, y: number) {
  return {
    left: `${x}%`,
    top: `${(y / VB_H) * 100}%`,
  };
}

/**
 * Cardinal elevation — look toward title N/S/E/W.
 *
 * Every profile is a real garden silhouette: family, mature height, spread and
 * callout name come from the shared `elevationBars` layout, so a pleached
 * hornbeam draws as a panel on stems and a 7.8 m tree overtops the dwelling.
 * Geometry in a stretch SVG; ticks + callouts as fixed-px HTML.
 */
export function ElevationBoard({
  look,
  boundary,
  building,
  items,
  selectedId,
  scaleM = BOARD_WIDTH_M_AT_100,
  dark = false,
  onSelect,
  onCycleLook,
  onTraceInPlan,
}: Props) {
  const ink = semanticForTheme(dark);
  const proj = elevationLookProjector(look);
  const widthM = elevationParcelWidthM(
    elevationSpan(boundary, look).span,
    scaleM,
  );

  /** One vertical scale for the ticks, the dwelling mass and every profile. */
  const ceilingM = useMemo(() => elevationCeilingM(items), [items]);

  const bars = useMemo(
    () =>
      elevationBars(items, {
        look,
        boundary,
        scaleM,
        plot: PLOT,
        ceilingM,
        fallbackWidth: FALLBACK_WIDTH,
        selectedId,
      }),
    [items, look, boundary, scaleM, ceilingM, selectedId],
  );

  const bld = useMemo(
    () =>
      elevationBuildingBox(building, {
        look,
        boundary,
        plot: PLOT,
        ceilingM,
      }),
    [building, look, boundary, ceilingM],
  );

  const labelPlacements = useMemo(
    () =>
      layoutElevationLabels(
        bars.map((bar) => ({
          id: bar.item.id,
          barX: bar.box.x + bar.box.w / 2,
          barTopY: bar.box.y,
          text: elevationLabelText(bar.tag, bar.heightM),
        })),
        { viewW: 100, viewH: VB_H, pad: 1 },
      ),
    [bars],
  );

  const ticks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      return { m: ceilingM * t, y: GROUND_Y - t * PLOT_H, t };
    });
  }, [ceilingM]);

  return (
    <div
      className={`${css.root}${dark ? ` ${css.rootNight}` : ""}`}
      data-testid="elevation-profile"
      data-elev-look={look}
    >
      <div className={css.topRow}>
        <button
          type="button"
          className={css.toggle}
          data-testid="elevation-cycle-look"
          onClick={onCycleLook}
          title={`Cycle look (next ${cycleElevationLook(look)})`}
        >
          {proj.label}
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
        night={dark}
      />
      <div className={css.stage}>
        <svg
          className={css.svg}
          viewBox={`0 0 100 ${VB_H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* Material textures — the glyph washes under them, so a missing
              def degrades to a flat silhouette rather than an invisible one. */}
          <defs>
            <ElevationTextureDefs />
          </defs>

          <g data-layer="datum">
            {ticks.map(({ y, t }) => (
              <line
                key={`g-${t}`}
                x1={PLOT_X0 - 2}
                y1={y}
                x2={PLOT_X0 + PLOT_W + 4}
                y2={y}
                stroke={mixOnHex(ink.textMuted, 28, ink.canvas)}
                strokeWidth={0.3}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <line
              x1={PLOT_X0 - 2}
              y1={GROUND_Y}
              x2={PLOT_X0 + PLOT_W + 4}
              y2={GROUND_Y}
              stroke={mixOnHex(ink.textPrimary, 45, ink.canvas)}
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          </g>

          <g data-layer="building">
            <rect
              x={bld.x}
              y={bld.y}
              width={bld.w}
              height={bld.h}
              fill={mixOnHex(ink.textPrimary, 5, ink.canvas)}
              stroke={ink.textPrimary}
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
            />
          </g>

          <g data-layer="vegetation">
            {bars.map((bar) => (
              <g
                key={bar.item.id}
                style={{ cursor: bar.item.ghost ? "default" : "pointer" }}
                onClick={() => {
                  if (!bar.item.ghost) onSelect(bar.item.id);
                }}
              >
                <GardenElevationGlyph
                  family={bar.family}
                  box={bar.box}
                  night={dark}
                  ghost={bar.item.ghost}
                  selected={bar.selected}
                  textured
                />
              </g>
            ))}
          </g>

          <g data-layer="leaders">
            {labelPlacements.map((p) =>
              p.leader ? (
                <line
                  key={`ld-${p.id}`}
                  x1={p.leader.x1}
                  y1={p.leader.y1}
                  x2={p.leader.x2}
                  y2={p.leader.y2}
                  stroke={ink.textPrimary}
                  strokeWidth={0.35}
                  vectorEffect="non-scaling-stroke"
                  opacity={0.55}
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
            const bar = bars.find((b) => b.item.id === p.id);
            const pos = vbToPct(p.x, p.y);
            return (
              <button
                key={`lbl-${p.id}`}
                type="button"
                className={`${css.label}${bar?.selected ? ` ${css.labelActive}` : ""}`}
                data-testid="elevation-label"
                data-elev-family={bar?.family ?? "plain"}
                style={{ left: pos.left, top: pos.top }}
                onClick={() => {
                  if (bar && !bar.item.ghost) onSelect(bar.item.id);
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
