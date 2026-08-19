/**
 * Solar window — real daylight hours from latitude + day of year.
 *
 * The ambient meta chip-set's "sun" chip carries the UNshaded potential:
 * how many hours the sun is above the horizon at this site on the sampled
 * date, from the standard sunrise-hour-angle equation (declination → hour
 * angle → daylight fraction). Canopy/building-adjusted exposure is a
 * different, point-specific model (the flora ring's live sun grid) and is
 * never conflated with this figure — the chip's detail line says so.
 *
 * Honest by construction: no fabricated "5.8h direct sun" numbers, only
 * real solar geometry.
 */

/** Solar declination (radians) for a given day of year. */
export function solarDeclinationRad(dayOfYear: number): number {
  // 23.44° obliquity; 172 = day of the June solstice (approx).
  return (23.44 * Math.PI) / 180 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
}

/**
 * Daylight hours at a latitude on a day of year.
 * Latitude in degrees (southern negative). Returns 0 inside the polar
 * circles when the sun never rises (Melbourne never hits this).
 */
export function daylightHoursAt(latDeg: number, dayOfYear: number): number {
  const lat = (latDeg * Math.PI) / 180;
  const dec = solarDeclinationRad(dayOfYear);
  const cosH = -Math.tan(lat) * Math.tan(dec);
  const clamped = Math.min(1, Math.max(-1, cosH));
  const hourAngle = Math.acos(clamped); // radians
  // Daylight fraction = 2 × hourAngle / 2π; × 24 h.
  return (hourAngle / Math.PI) * 24;
}

/** Day of year (1–366) from a Date, UTC-based so it is timezone-stable. */
export function dayOfYearFrom(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86400000) + 1;
}
