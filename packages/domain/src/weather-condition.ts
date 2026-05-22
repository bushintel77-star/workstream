export type WeatherCondition = "sun" | "cloud" | "rain" | "wind";

export function weatherConditionFromDay(
  precipitationMm: number,
  windKph: number,
  index: number,
): WeatherCondition {
  if (precipitationMm > 4) return "rain";
  if (windKph > 40) return "wind";
  if (precipitationMm > 0.5) return "cloud";
  if (index === 0) return "sun";
  return precipitationMm > 0.2 ? "cloud" : "sun";
}
