"use client";

import {
  melbourneSeason,
  sunPositionAt,
} from "@workstream/domain";
import css from "./sunShadeControls.module.css";

type Props = {
  lat: number;
  lng: number;
  when: Date;
  onWhenChange: (next: Date) => void;
};

function parseHour(when: Date): number {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(when);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour + minute / 60;
}

function setMelbourneHour(base: Date, hourFloat: number): Date {
  const next = new Date(base);
  const h = Math.floor(hourFloat);
  const m = Math.round((hourFloat - h) * 60);
  const melbourne = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(next);
  const y = melbourne.find((p) => p.type === "year")?.value ?? "2026";
  const mo = melbourne.find((p) => p.type === "month")?.value ?? "06";
  const d = melbourne.find((p) => p.type === "day")?.value ?? "21";
  const iso = `${y}-${mo}-${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+10:00`;
  return new Date(iso);
}

function solsticeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
}

/** Time + date presets for indicative sun/shade overlay. */
export function SunShadeControls({ lat, lng, when, onWhenChange }: Props) {
  const sun = sunPositionAt(lat, lng, when);
  const season = melbourneSeason(when);
  const hour = parseHour(when);
  const year = when.getFullYear();

  return (
    <div className={css.root} data-testid="sun-shade-controls">
      <p className={css.hud}>
        {season.label} · {String(Math.floor(hour)).padStart(2, "0")}:
        {String(Math.round((hour % 1) * 60)).padStart(2, "0")} · Alt{" "}
        {sun.altitude_deg}° · {sun.azimuth_label}
      </p>
      <label className={css.sliderRow}>
        <span className={css.sliderLabel}>Time</span>
        <input
          type="range"
          min={6}
          max={20}
          step={0.25}
          value={hour}
          onChange={(e) =>
            onWhenChange(setMelbourneHour(when, Number(e.target.value)))
          }
          aria-label="Sun time of day"
        />
      </label>
      <div className={css.presets} role="group" aria-label="Sun date presets">
        <button
          type="button"
          className={css.preset}
          onClick={() => onWhenChange(new Date())}
        >
          Today
        </button>
        <button
          type="button"
          className={css.preset}
          onClick={() =>
            onWhenChange(setMelbourneHour(solsticeDate(year, 6, 21), 14.5))
          }
        >
          Jun 21
        </button>
        <button
          type="button"
          className={css.preset}
          onClick={() =>
            onWhenChange(setMelbourneHour(solsticeDate(year, 12, 21), 14.5))
          }
        >
          Dec 21
        </button>
      </div>
      <p className={css.caption}>Predicted sun/shade — indicative only</p>
    </div>
  );
}
