"use client";

import { useMemo } from "react";
import { sunPositionAt } from "@workstream/domain";
import ss from "./sunShadeControls.module.css";

type Props = {
  lat: number;
  lng: number;
  timeHour: number;
  solstice: "summer" | "equinox" | "winter";
  onTimeHour: (h: number) => void;
  onSolstice: (s: "summer" | "equinox" | "winter") => void;
  zoomPercent: number;
  cursorPct: { x: number; y: number } | null;
};

function solsticeDate(solstice: Props["solstice"]): Date {
  const y = new Date().getFullYear();
  if (solstice === "summer") return new Date(Date.UTC(y, 11, 21, 5, 0));
  if (solstice === "winter") return new Date(Date.UTC(y, 5, 21, 5, 0));
  return new Date(Date.UTC(y, 2, 20, 5, 0));
}

export function SunShadeControls({
  lat,
  lng,
  timeHour,
  solstice,
  onTimeHour,
  onSolstice,
  zoomPercent,
  cursorPct,
}: Props) {
  const when = useMemo(() => {
    const d = solsticeDate(solstice);
    d.setHours(Math.floor(timeHour), (timeHour % 1) * 60, 0, 0);
    return d;
  }, [solstice, timeHour]);

  const sun = sunPositionAt(lat, lng, when);
  const timeLabel = `${String(Math.floor(timeHour)).padStart(2, "0")}:${String(
    Math.round((timeHour % 1) * 60),
  ).padStart(2, "0")}`;

  return (
    <div className={ss.panel} data-testid="sun-shade-controls">
      <label className={ss.label}>
        time of day
        <input
          type="range"
          min={6}
          max={20}
          step={0.5}
          value={timeHour}
          onChange={(e) => onTimeHour(Number(e.target.value))}
        />
        <span className={ss.value}>{timeLabel}</span>
      </label>
      <div className={ss.chips}>
        {(["summer", "equinox", "winter"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`${ss.chip} ${solstice === s ? ss.chipActive : ""}`}
            onClick={() => onSolstice(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <p className={ss.hud}>
        {cursorPct
          ? `${cursorPct.x.toFixed(1)}%, ${cursorPct.y.toFixed(1)}%`
          : "—, —"}{" "}
        · {zoomPercent}% zoom · {solstice} · {timeLabel} · Alt {sun.altitude_deg.toFixed(0)}°
      </p>
      <p className={ss.footer}>
        Predicted solar position — indicative, not survey-grade
      </p>
    </div>
  );
}
