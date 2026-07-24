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
      <polygon points={ptsAttr(boundary)} className={css[tone]} />
    </svg>
  );
}
