/** Melbourne-centric season, sun position, and daylight (AU southern hemisphere). */

const AZIMUTH_LABELS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export type MelbourneSeason = {
  label: string;
  month: string;
  day_of_year: number;
};

export type SunPosition = {
  altitude_deg: number;
  azimuth_deg: number;
  azimuth_label: string;
};

export type DaylightSummary = {
  date_iso: string;
  sunrise_local: string;
  sunset_local: string;
  daylight_hours: number;
  solar_noon_altitude_deg: number;
};

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((now - start) / 86_400_000);
}

/** Southern hemisphere seasons for display on site titles. */
export function melbourneSeason(
  when: Date = new Date(),
  timeZone = "Australia/Melbourne",
): MelbourneSeason {
  const month = Number(
    new Intl.DateTimeFormat("en-AU", { timeZone, month: "numeric" }).format(
      when,
    ),
  );
  const monthLabel = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    month: "long",
  }).format(when);
  const doy = dayOfYear(when);

  let label: string;
  if (month === 12 || month <= 2) label = "Summer";
  else if (month <= 5) label = "Autumn";
  else if (month <= 8) label = "Winter";
  else label = "Spring";

  const fine =
    month === 12 || month === 1 || month === 2
      ? month === 12
        ? "Early summer"
        : month === 1
          ? "Mid summer"
          : "Late summer"
      : month === 3 || month === 4 || month === 5
        ? month === 3
          ? "Early autumn"
          : month === 5
            ? "Late autumn"
            : "Mid autumn"
        : month === 6 || month === 7 || month === 8
          ? month === 6
            ? "Early winter"
            : month === 8
              ? "Late winter"
              : "Mid winter"
          : month === 9
            ? "Early spring"
            : month === 11
              ? "Late spring"
              : "Mid spring";

  return { label: fine, month: monthLabel, day_of_year: doy };
}

function solarDeclinationDeg(dayOfYear: number): number {
  return 23.45 * Math.sin((Math.PI * 2 * (284 + dayOfYear)) / 365);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Solar elevation and azimuth (0° = north, 90° = east), Melbourne convention. */
export function sunPositionAt(
  lat: number,
  lng: number,
  when: Date = new Date(),
): SunPosition {
  const doy = dayOfYear(when);
  const decl = solarDeclinationDeg(doy);
  const latRad = toRad(lat);

  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(when);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const solarTime = hour + minute / 60 + lng / 15 - 10; // AEDT approx
  const hourAngle = toRad(15 * (solarTime - 12));

  const sinAlt =
    Math.sin(latRad) * Math.sin(toRad(decl)) +
    Math.cos(latRad) * Math.cos(toRad(decl)) * Math.cos(hourAngle);
  const altitude = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));

  const cosAz =
    (Math.sin(toRad(decl)) - Math.sin(latRad) * sinAlt) /
    (Math.cos(latRad) * Math.cos(toRad(altitude)) || 1e-9);
  let azimuth = toDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
  if (hourAngle > 0) azimuth = 360 - azimuth;

  const idx =
    Math.round(azimuth / 22.5) % AZIMUTH_LABELS.length;
  return {
    altitude_deg: Math.round(altitude * 10) / 10,
    azimuth_deg: Math.round(azimuth * 10) / 10,
    azimuth_label: AZIMUTH_LABELS[idx] ?? "N",
  };
}

export function solarNoonAltitudeDeg(
  lat: number,
  when: Date = new Date(),
): number {
  const decl = solarDeclinationDeg(dayOfYear(when));
  return (
    Math.round(
      toDeg(
        Math.asin(
          Math.sin(toRad(lat)) * Math.sin(toRad(decl)) +
            Math.cos(toRad(lat)) * Math.cos(toRad(decl)),
        ),
      ) * 10,
    ) / 10
  );
}

/** Approximate sunrise/sunset when API unavailable (local HH:MM). */
export function approximateDaylight(
  lat: number,
  when: Date = new Date(),
  timeZone = "Australia/Melbourne",
): DaylightSummary {
  const decl = solarDeclinationDeg(dayOfYear(when));
  const latRad = toRad(lat);
  const cosH =
    -Math.tan(latRad) * Math.tan(toRad(decl));
  const h = toDeg(Math.acos(Math.max(-1, Math.min(1, cosH))));
  const daylightHours = Math.round(((2 * h) / 15) * 10) / 10;
  const noonAlt = solarNoonAltitudeDeg(lat, when);

  const dateIso = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);

  const fmt = (hour: number, minute: number) =>
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const sunriseH = 12 - h / 15;
  const sunsetH = 12 + h / 15;
  const srH = Math.floor(sunriseH);
  const srM = Math.round((sunriseH - srH) * 60);
  const ssH = Math.floor(sunsetH);
  const ssM = Math.round((sunsetH - ssH) * 60);

  return {
    date_iso: dateIso,
    sunrise_local: fmt(srH, srM),
    sunset_local: fmt(ssH, ssM),
    daylight_hours: daylightHours,
    solar_noon_altitude_deg: noonAlt,
  };
}

/** Place sun marker on 0–100 % site plan (centre + azimuth). */
export function sunMarkerOnPlanPercent(
  centroid: [number, number],
  azimuthDeg: number,
  radiusPct = 38,
): [number, number] {
  const rad = toRad(azimuthDeg);
  const x = centroid[0] + radiusPct * Math.sin(rad);
  const y = centroid[1] - radiusPct * Math.cos(rad);
  return [
    Math.max(4, Math.min(96, x)),
    Math.max(4, Math.min(96, y)),
  ];
}
