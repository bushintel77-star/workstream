"use client";

import type { GrowthStage } from "../../state/studioTypes";
import {
  SUN_DATE_PRESETS,
  sunDatePresetLabel,
  type SunDatePreset,
} from "../sunGrowth/sunDatePreset";
import type { EnvLiveMeta } from "./envLiveMeta";
import { WeatherIcon } from "./WeatherIcon";
import metaCss from "./metaPanel.module.css";
import css from "./environmentPanel.module.css";

type Props = {
  open: boolean;
  meta: EnvLiveMeta;
  sunMin: number;
  datePreset: SunDatePreset;
  growth: GrowthStage;
  playing: boolean;
  shadeOn: boolean;
  /** KEYLESS street / planning meta chips (not dig truth). */
  streetChips?: string[];
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
 * Expanded Env lane — sun / season / growth instruments + Open-Meteo
 * humidity / frost / heat cues (indicative Melb planting bands).
 */
export function EnvironmentPanel({
  open,
  meta,
  sunMin,
  datePreset,
  growth,
  playing,
  shadeOn,
  streetChips = [],
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
      className={`${metaCss.panel} ${css.panel}`}
      data-testid="environment-panel"
      role="dialog"
      aria-label="Environment"
    >
      <div className={metaCss.head}>
        <div className={metaCss.headMain}>
          <span className={metaCss.headIcon}>
            <WeatherIcon condition={meta.weatherCondition} size={20} />
          </span>
          <div>
            <p className={metaCss.kicker}>Climate · indicative</p>
            <p className={metaCss.title}>Environment</p>
          </div>
        </div>
        <button type="button" className={metaCss.close} onClick={onClose}>
          Close
        </button>
      </div>

      <p className={metaCss.live} data-testid="environment-panel-live">
        <WeatherIcon condition={meta.weatherCondition} size={20} />
        <span>
          {meta.avgSunHours.toFixed(1)}h avg sun · {meta.deepShadeCells}/
          {meta.cellCount} deep · alt {meta.altitudeDeg.toFixed(0)}° ·{" "}
          {meta.azimuthLabel}
          {meta.tempMaxC != null ? ` · ${Math.round(meta.tempMaxC)}°` : ""}
        </span>
      </p>

      {streetChips.length > 0 ? (
        <div className={css.streetChips} data-testid="street-context-chips">
          {streetChips.map((c) => (
            <span key={c} className={css.streetChip}>
              {c}
            </span>
          ))}
        </div>
      ) : null}

      <div className={css.weatherRow} data-testid="environment-weather-icons">
        {(
          [
            ["sun", "Sun"],
            ["cloud", "Cloud"],
            ["rain", "Rain"],
            ["wind", "Wind"],
          ] as const
        ).map(([id, label]) => (
          <span
            key={id}
            className={css.weatherChip}
            data-active={meta.weatherCondition === id ? "true" : "false"}
          >
            <WeatherIcon condition={id} size={16} />
            <span>{label}</span>
          </span>
        ))}
      </div>

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
        <div className={css.blockHead}>
          <p className={css.blockLabel}>Time of day</p>
          <p className={css.clock}>{meta.clock}</p>
        </div>
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
        <div className={css.scrubberTicks} aria-hidden>
          <span>06:20</span>
          <span>Solar cast</span>
          <span>19:40</span>
        </div>
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
              ["plant", "Year 1"],
              ["5yr", "Year 5"],
              ["mature", "Year 10"],
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

      <ul className={css.missing} data-testid="environment-climate-cues">
        <li data-testid="environment-humidity">
          <span>Humidity</span>
          <span
            className={meta.humidityPct != null ? css.liveVal : css.soon}
            data-risk="ok"
          >
            {meta.humidityLabel}
          </span>
        </li>
        <li data-testid="environment-frost">
          <span>Frost risk</span>
          <span
            className={
              meta.frostRisk == null
                ? css.soon
                : meta.frostRisk === "clear"
                  ? css.liveVal
                  : css.warnVal
            }
            data-risk={meta.frostRisk ?? "pending"}
          >
            {meta.frostLabel}
          </span>
        </li>
        <li data-testid="environment-heat">
          <span>Excessive heat</span>
          <span
            className={
              meta.heatRisk == null
                ? css.soon
                : meta.heatRisk === "ok"
                  ? css.liveVal
                  : css.warnVal
            }
            data-risk={meta.heatRisk ?? "pending"}
          >
            {meta.heatLabel}
          </span>
        </li>
        <li>
          <span>Engineering overshadow</span>
          <span className={css.soon}>Stage 2</span>
        </li>
      </ul>

      <p className={metaCss.foot}>
        Shade mesh and sun cast are indicative — not EnergyPlus or neighbour
        solar rights. Sticky card stays until you dismiss it.
      </p>
    </div>
  );
}
