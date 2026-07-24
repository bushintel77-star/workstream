"use client";

import type { WeatherCondition } from "@workstream/domain";
import css from "./weatherIcon.module.css";

type Props = {
  condition: WeatherCondition;
  size?: number;
  /** Accessible label override. */
  label?: string;
};

const LABELS: Record<WeatherCondition, string> = {
  sun: "Sunny",
  cloud: "Cloudy",
  rain: "Rain",
  wind: "Windy",
};

/**
 * Compact weather glyphs for the Env boundary rail — sun / cloud / rain / wind.
 * Static SVG (no emoji); blush-compatible ink.
 */
export function WeatherIcon({ condition, size = 18, label }: Props) {
  const aria = label ?? LABELS[condition];
  const s = size;
  return (
    <span
      className={css.root}
      data-testid={`weather-icon-${condition}`}
      data-condition={condition}
      style={{ width: s, height: s }}
      role="img"
      aria-label={aria}
      title={aria}
    >
      {condition === "sun" ? (
        <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
          <circle cx="16" cy="16" r="6" fill="#F59E0B" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={16 + Math.cos(rad) * 9}
                y1={16 + Math.sin(rad) * 9}
                x2={16 + Math.cos(rad) * 12.2}
                y2={16 + Math.sin(rad) * 12.2}
                stroke="#D97706"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      ) : null}
      {condition === "cloud" ? (
        <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
          <ellipse cx="14" cy="18" rx="9" ry="6" fill="#A8A29E" />
          <ellipse cx="20" cy="16" rx="7" ry="5" fill="#D6D3D1" />
          <ellipse cx="11" cy="15" rx="5" ry="4" fill="#E7E5E4" />
        </svg>
      ) : null}
      {condition === "rain" ? (
        <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
          <ellipse cx="16" cy="13" rx="10" ry="6" fill="#78716C" />
          <ellipse cx="21" cy="11" rx="6" ry="4" fill="#A8A29E" />
          <path
            d="M10 20 L10 26 M16 18 L16 25 M22 20 L22 27"
            stroke="#0EA5E9"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      ) : null}
      {condition === "wind" ? (
        <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
          <path
            d="M8 12 Q18 8 24 12 M6 18 Q16 14 26 18 M10 24 Q20 20 28 24"
            fill="none"
            stroke="#C2455F"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </span>
  );
}
