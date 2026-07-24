/**
 * Indicative plant-climate cues from daily forecast temps.
 * Melbourne landscape planning — not Bureau of Meteorology warnings.
 */

export type FrostRiskLevel = "clear" | "risk" | "hard";
export type HeatRiskLevel = "ok" | "warm" | "excessive";

/** Ground frost risk for soft planting from overnight min (°C). */
export function frostRiskFromMinTemp(tempMinC: number): FrostRiskLevel {
  if (!Number.isFinite(tempMinC)) return "clear";
  if (tempMinC <= 0) return "hard";
  if (tempMinC <= 2) return "risk";
  return "clear";
}

/** Heat stress band for outdoor planting / crew comfort from daily max (°C). */
export function heatRiskFromMaxTemp(tempMaxC: number): HeatRiskLevel {
  if (!Number.isFinite(tempMaxC)) return "ok";
  if (tempMaxC >= 35) return "excessive";
  if (tempMaxC >= 32) return "warm";
  return "ok";
}

export function frostRiskLabel(level: FrostRiskLevel): string {
  switch (level) {
    case "hard":
      return "hard frost";
    case "risk":
      return "frost risk";
    default:
      return "clear";
  }
}

export function heatRiskLabel(level: HeatRiskLevel): string {
  switch (level) {
    case "excessive":
      return "excessive heat";
    case "warm":
      return "warm";
    default:
      return "ok";
  }
}
