"use client";

import type { GrowthStage } from "../../state/studioTypes";
import {
  SUN_DATE_PRESETS,
  sunDatePresetLabel,
  type SunDatePreset,
} from "../sunGrowth/sunDatePreset";
import type { EnvLiveMeta } from "./envLiveMeta";
import css from "./environmentPanel.module.css";

type Props = {
  open: boolean;
  meta: EnvLiveMeta;
  sunMin: number;
  datePreset: SunDatePreset;
  growth: GrowthStage;
  playing: boolean;
  shadeOn: boolean;
  onClose: () => void;
  onSunMin: (min: number) => void;
  onDatePreset: (preset: SunDatePreset) => void;
  onGrowth: (g: GrowthStage) => void;
  onPlaying: (v: boolean) => void;
  onShadeOn: (on: boolean) => void;
};

const DAY_START = 6 * 60 + 20;
const DAY_END = 19 * 60 + 40;

/**
 * Expanded Env lane — sun / season / growth instruments + honesty for
 * humidity / frost / heat (not yet live).
 */
export function EnvironmentPanel({
  open,
  meta,
  sunMin,
  datePreset,
  growth,
  playing,
  shadeOn,
  onClose,
  onSunMin,
  onDatePreset,
  onGrowth,
  onPlaying,
  onShadeOn,
}: Props) {
  if (!open) return null;

  const t = Math.max(
    0,
    Math.min(1, (sunMin - DAY_START) / (DAY_END - DAY_START)),
  );

  return (
    <div
      className={css.panel}
      data-testid="environment-panel"
      role="dialog"
      aria-label="Environment"
    >
      <div className={css.head}>
        <div>
          <p className={css.kicker}>Climate · indicative</p>
          <p className={css.title}>Environment</p>
        </div>
        <button type="button" className={css.close} onClick={onClose}>
          Close
        </button>
      </div>

      <p className={css.live} data-testid="environment-panel-live">
        {meta.avgSunHours.toFixed(1)}h avg sun · {meta.deepShadeCells}/
        {meta.cellCount} deep · alt {meta.altitudeDeg.toFixed(0)}° ·{" "}
        {meta.azimuthLabel}
      </p>

      <label className={css.switchRow}>
        <span>Sun / shade mesh on board</span>
        <input
          type="checkbox"
          checked={shadeOn}
          onChange={(e) => onShadeOn(e.target.checked)}
          data-testid="environment-shade-toggle"
        />
      </label>

      <div className={css.block}>
        <p className={css.blockLabel}>Time of day</p>
        <p className={css.clock}>{meta.clock}</p>
        <input
          type="range"
          className={css.slider}
          min={0}
          max={1000}
          value={Math.round(t * 1000)}
          aria-label="Sun time"
          onChange={(e) => {
            const nt = Number(e.target.value) / 1000;
            onSunMin(DAY_START + nt * (DAY_END - DAY_START));
          }}
        />
        <div className={css.row}>
          <button
            type="button"
            className={css.chip}
            data-active={playing ? "true" : "false"}
            onClick={() => onPlaying(!playing)}
          >
            {playing ? "Pause cast" : "Play 12h cast"}
          </button>
        </div>
      </div>

      <div className={css.block}>
        <p className={css.blockLabel}>Seasonal sun cast</p>
        <div className={css.chips}>
          {SUN_DATE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={css.chip}
              data-active={datePreset === p ? "true" : "false"}
              onClick={() => onDatePreset(p)}
            >
              {sunDatePresetLabel(p)}
            </button>
          ))}
        </div>
      </div>

      <div className={css.block}>
        <p className={css.blockLabel}>Canopy growth</p>
        <div className={css.chips}>
          {(
            [
              ["plant", "Plant"],
              ["5yr", "5 yr"],
              ["mature", "Mature"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={css.chip}
              data-active={growth === id ? "true" : "false"}
              onClick={() => onGrowth(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className={css.missing} data-testid="environment-missing">
        <li>
          <span>Humidity</span>
          <span className={css.soon}>soon</span>
        </li>
        <li>
          <span>Frost risk</span>
          <span className={css.soon}>soon</span>
        </li>
        <li>
          <span>Excessive heat</span>
          <span className={css.soon}>soon</span>
        </li>
        <li>
          <span>Weather (Open-Meteo)</span>
          <span className={css.soon}>API ready</span>
        </li>
        <li>
          <span>Engineering overshadow</span>
          <span className={css.soon}>Stage 2</span>
        </li>
      </ul>

      <p className={css.foot}>
        Shade mesh and sun cast are indicative — not EnergyPlus or neighbour
        solar rights. Sticky card stays until you dismiss it.
      </p>
    </div>
  );
}
