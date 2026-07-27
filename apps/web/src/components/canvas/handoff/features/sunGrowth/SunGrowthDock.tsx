"use client";

import { useEffect } from "react";
import { CSS_TOKEN, mixOnCanvas } from "@/styles/colorTokens";
import { CameraChrome } from "../../CameraChrome";
import type { GrowthStage } from "../../state/studioTypes";
import {
  sunDatePresetLabel,
  type SunDatePreset,
} from "./sunDatePreset";
import css from "./sunGrowth.module.css";

type Props = {
  sunMin: number;
  datePreset: SunDatePreset;
  growth: GrowthStage;
  playing: boolean;
  /** Indicative shadow length from live sun cast (m). */
  shadowLengthM?: number | null;
  onSunMin: (min: number) => void;
  onDatePreset: (preset: SunDatePreset) => void;
  onGrowth: (g: GrowthStage) => void;
  onPlaying: (v: boolean) => void;
};

const DAY_START = 6 * 60 + 20; // ~6:20
const DAY_END = 19 * 60 + 40; // ~19:40

function formatSun(min: number) {
  const hh = Math.floor(min / 60);
  const mm = Math.round(min % 60);
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh >= 12 ? "pm" : "am";
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export function SunGrowthDock({
  sunMin,
  datePreset,
  growth,
  playing,
  shadowLengthM = null,
  onSunMin,
  onDatePreset,
  onGrowth,
  onPlaying,
}: Props) {
  const t = Math.max(0, Math.min(1, (sunMin - DAY_START) / (DAY_END - DAY_START)));
  const sunX = 2 + t * 96;
  const sunY = 38 - Math.sin(t * Math.PI) * 40;
  const sunPX = sunX;
  const sunPY = (sunY / 40) * 100;
  const shadow =
    shadowLengthM != null && shadowLengthM > 0
      ? shadowLengthM
      : Math.max(1.1, Math.min(3.6, 2.2));

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = sunMin + 4;
      if (next >= DAY_END) onSunMin(DAY_START);
      else onSunMin(next);
    }, 80);
    return () => window.clearInterval(id);
  }, [playing, sunMin, onSunMin]);

  const setFromClientX = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    const nt = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onSunMin(DAY_START + nt * (DAY_END - DAY_START));
  };

  return (
    <CameraChrome place={{ kind: "dock" }} testId="sun-shade-controls">
      <aside className={css.dock} data-testid="sun-shade-dock">
        <div className={css.head}>
          <p className={css.kicker}>Sun &amp; growth</p>
          <div className={css.timeRow}>
            <p className={css.time}>{formatSun(sunMin)}</p>
            <button
              type="button"
              className={css.play}
              data-active={playing ? "true" : "false"}
              aria-label={playing ? "Pause sun" : "Play sun"}
              onClick={() => onPlaying(!playing)}
            >
              {playing ? "Pause" : "Play"}
            </button>
          </div>
        </div>
        <div className={css.dateRow} aria-label="Sun study date">
          {(
            [
              ["today", "Today"],
              ["march-equinox", "20 Mar"],
              ["winter", "21 Jun"],
              ["september-equinox", "22 Sep"],
              ["summer", "21 Dec"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={css.dateChip}
              data-active={datePreset === id ? "true" : "false"}
              onClick={() => onDatePreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className={css.arc}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setFromClientX(e.currentTarget, e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons !== 1) return;
            setFromClientX(e.currentTarget, e.clientX);
          }}
        >
          <svg viewBox="0 0 100 40" preserveAspectRatio="none">
            <path
              d="M2,38 Q50,-14 98,38"
              fill="none"
              stroke="rgba(194,69,95,0.3)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={0}
              y1={38}
              x2={100}
              y2={38}
              stroke={mixOnCanvas(CSS_TOKEN.textPrimary, 22)}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={sunX}
              y1={sunY}
              x2={sunX}
              y2={38}
              stroke="rgba(232,184,75,0.6)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className={css.dot} style={{ left: `${sunPX}%`, top: `${sunPY}%` }} />
        </div>
        <div className={css.chips}>
          {(
            [
              ["plant", "Plant"],
              ["5yr", "+5 yr"],
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
        <p className={css.foot}>
          {sunDatePresetLabel(datePreset)} · shadow ≈ {shadow.toFixed(1)} m ·
          indicative until surveyed heights are available
        </p>
      </aside>
    </CameraChrome>
  );
}
