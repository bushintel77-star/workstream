"use client";

import type { EnvLiveMeta } from "../stickyMeta/envLiveMeta";
import type { PctPoint } from "../../geometry";
import css from "./climateBedWash.module.css";

type Props = {
  active: boolean;
  boundary: PctPoint[];
  meta: EnvLiveMeta;
};

function ptsAttr(ring: PctPoint[]): string {
  return ring.map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * Soft outdoor-bed wash from live Open-Meteo frost / heat / humidity cues.
 * Face of the climate risk — not a BoM warning layer.
 */
export function ClimateBedWash({ active, boundary, meta }: Props) {
  if (!active || boundary.length < 3) return null;

  const frost =
    meta.frostRisk === "hard"
      ? "hard"
      : meta.frostRisk === "risk"
        ? "risk"
        : "clear";
  const heat =
    meta.heatRisk === "excessive"
      ? "excessive"
      : meta.heatRisk === "warm"
        ? "warm"
        : "ok";
  const humid =
    meta.humidityPct != null && meta.humidityPct >= 75
      ? "high"
      : meta.humidityPct != null && meta.humidityPct <= 35
        ? "dry"
        : "mid";

  // Priority: hard frost > excessive heat > frost risk > warm > humidity tint.
  let tone: "frost" | "heat" | "warm" | "humid" | "dry" | "neutral" = "neutral";
  if (frost === "hard" || frost === "risk") tone = "frost";
  else if (heat === "excessive") tone = "heat";
  else if (heat === "warm") tone = "warm";
  else if (humid === "high") tone = "humid";
  else if (humid === "dry") tone = "dry";

  if (tone === "neutral") return null;

  return (
    <svg
      className={css.root}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="climate-bed-wash"
      data-tone={tone}
      aria-hidden
    >
      <defs>
        {/* Frost pools low in the bed; heat gathers up-slope. Others grade
            gently top-to-bottom. Object-bbox units keep bands undistorted. */}
        <linearGradient id="ws-climate-frost" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fbdd6" stopOpacity="0.06" />
          <stop offset="0.55" stopColor="#7fb4d3" stopOpacity="0.14" />
          <stop offset="1" stopColor="#6ea7cc" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="ws-climate-heat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d47a68" stopOpacity="0.2" />
          <stop offset="0.6" stopColor="#d98374" stopOpacity="0.1" />
          <stop offset="1" stopColor="#dc9184" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="ws-climate-warm" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#dfa24d" stopOpacity="0.14" />
          <stop offset="1" stopColor="#e2ac5f" stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id="ws-climate-humid" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#6fa98a" stopOpacity="0.12" />
          <stop offset="1" stopColor="#7cb397" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="ws-climate-dry" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#c08a3e" stopOpacity="0.11" />
          <stop offset="1" stopColor="#c9974f" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={ptsAttr(boundary)}
        className={css[tone]}
        fill={`url(#ws-climate-${tone})`}
      />
    </svg>
  );
}
