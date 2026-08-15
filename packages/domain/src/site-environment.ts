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

  const _seasonLabel =
    month === 12 || month <= 2
      ? "Summer"
      : month <= 5
        ? "Autumn"
        : month <= 8
          ? "Winter"
          : "Spring";

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

/** Melbourne UTC offset in hours at the given instant — +10 AEST, +11 AEDT
 *  (first Sunday of October → first Sunday of April). Read from the zone
 *  rules rather than hard-coding, so solar time doesn't drift an hour
 *  during daylight saving. */
function melbourneUtcOffsetHours(when: Date): number {
  const tzName = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    timeZoneName: "longOffset",
  })
    .formatToParts(when)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = tzName ? /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(tzName) : null;
  if (!match) return 10;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) + Number(match[3] ?? 0) / 60);
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
  const solarTime =
    hour + minute / 60 + lng / 15 - melbourneUtcOffsetHours(when);
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

/**
 * Indicative plan shadow cast from solar azimuth/altitude.
 * Board is north-up, y-down. Azimuth 0° = north (same as `sunPositionAt`).
 * Shadow runs opposite the sun — Melbourne noon → south (+y).
 */
export type BoardShadowCast = {
  /** Dwelling polygon translate in board % */
  dxPct: number;
  dyPct: number;
  /** Glyph ellipse offset as fraction of canopy radius */
  dxFactor: number;
  dyFactor: number;
  /** Indicative shadow length in metres (eave / tan(alt)) */
  lengthM: number;
  altitude_deg: number;
  azimuth_deg: number;
};

export type BoardShadowOpts = {
  /** 0.55 plant · 0.85 +5yr · 1 mature */
  growthScale?: number;
  /** Assumed casting height in metres (dwelling eave default). */
  heightM?: number;
  /** Board width in metres for % mapping (default 110). */
  boardWidthM?: number;
};

export function boardShadowCast(
  azimuthDeg: number,
  altitudeDeg: number,
  opts: BoardShadowOpts = {},
): BoardShadowCast {
  const growth = opts.growthScale ?? 1;
  const heightM = opts.heightM ?? 5;
  const boardM = opts.boardWidthM ?? 110;
  const az = Number.isFinite(azimuthDeg) ? azimuthDeg : 0;
  const alt = Number.isFinite(altitudeDeg) ? altitudeDeg : 0;

  if (alt <= 2) {
    return {
      dxPct: 0,
      dyPct: 0,
      dxFactor: 0,
      dyFactor: 0,
      lengthM: 0,
      altitude_deg: alt,
      azimuth_deg: az,
    };
  }

  const altRad = toRad(Math.min(78, Math.max(2.5, alt)));
  const lengthM =
    Math.round(
      Math.min(16, Math.max(0.9, heightM / Math.tan(altRad))) * growth * 10,
    ) / 10;

  // Opposite sun on north-up / y-down board.
  const rad = toRad(az);
  const sx = -Math.sin(rad);
  const sy = Math.cos(rad);

  const dwellingPct = Math.min(
    3.2,
    Math.max(0.28, (lengthM / boardM) * 100 * 0.4),
  );
  const glyphFactor = Math.min(0.55, Math.max(0.14, 0.1 + (lengthM / 14) * 0.42));

  return {
    dxPct: Math.round(sx * dwellingPct * 100) / 100,
    dyPct: Math.round(sy * dwellingPct * 100) / 100,
    dxFactor: Math.round(sx * glyphFactor * 1000) / 1000,
    dyFactor: Math.round(sy * glyphFactor * 1000) / 1000,
    lengthM,
    altitude_deg: alt,
    azimuth_deg: az,
  };
}

/**
 * Convert a true-north solar azimuth (0° = true north, as `sunPositionAt`
 * returns) into a board azimuth for a board whose up direction (screen-up)
 * points at compass bearing `northBearingDeg` (the `DesignSiteFrame.north_bearing`
 * convention). `boardShadowCast` expects a board azimuth (0° = board-up), so
 * overshadowing on a rotated board must pass its azimuth through here first.
 * A north-up board (bearing 0 / omitted) makes this a no-op. This is the single
 * orientation adjustment shared by dwelling sun/shade and neighbour massing.
 */
export function boardAzimuthDeg(
  trueAzimuthDeg: number,
  northBearingDeg = 0,
): number {
  const t = Number.isFinite(trueAzimuthDeg) ? trueAzimuthDeg : 0;
  const n = Number.isFinite(northBearingDeg) ? northBearingDeg : 0;
  const a = (((t - n) % 360) + 360) % 360;
  return Math.round(a * 10) / 10;
}
