"use client";

import { useEffect } from "react";
import type { GrowthStage } from "../../state/studioTypes";
import css from "./sunGrowth.module.css";

type Props = {
  sunMin: number;
  growth: GrowthStage;
  playing: boolean;
  onSunMin: (min: number) => void;
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

function shadowLengthM(sunMin: number, growth: GrowthStage) {
  const t = (sunMin - DAY_START) / (DAY_END - DAY_START);
  const elev = Math.sin(Math.max(0.05, Math.min(0.95, t)) * Math.PI);
  const canopy = growth === "plant" ? 0.55 : growth === "5yr" ? 0.85 : 1;
  // Midday short, morning/evening long — handoff-ish 1.2–3.4 m
  return Math.max(1.1, Math.min(3.6, (2.8 / elev) * 0.55 * canopy));
}

export function SunGrowthDock({
  sunMin,
  growth,
  playing,
  onSunMin,
  onGrowth,
  onPlaying,
}: Props) {
  const t = Math.max(0, Math.min(1, (sunMin - DAY_START) / (DAY_END - DAY_START)));
  const sunX = 2 + t * 96;
  const sunY = 38 - Math.sin(t * Math.PI) * 40;
  const sunPX = sunX;
  const sunPY = (sunY / 40) * 100;
  const shadow = shadowLengthM(sunMin, growth);

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
    <aside className={css.dock} data-testid="sun-shade-controls">
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
            stroke="rgba(36,19,24,0.22)"
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
        Shadow ≈ {shadow.toFixed(1)} m · eaves 5 m · canopies cast at {growth}
      </p>
    </aside>
  );
}
