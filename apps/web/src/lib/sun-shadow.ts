import * as SunCalc from "suncalc";

export type LngLat = [number, number];

const METERS_PER_DEG_LAT = 110_540;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function openRing(ring: LngLat[]): LngLat[] {
  if (ring.length < 2) return ring;
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  return ring;
}

function closeRing(ring: LngLat[]): LngLat[] {
  const open = openRing(ring);
  if (open.length < 3) return open;
  return [...open, open[0]!];
}

/** Offset metres east/north → WGS84. */
export function offsetLngLat(
  lng: number,
  lat: number,
  eastM: number,
  northM: number,
): LngLat {
  return [
    lng + eastM / metersPerDegLng(lat),
    lat + northM / METERS_PER_DEG_LAT,
  ];
}

export type SunCast = {
  /** Radians above horizon. */
  altitude: number;
  /** Radians — SunCalc: 0 = south, toward west. */
  azimuth: number;
  /** Ground shadow length for a 1 m vertical (metres). */
  shadowPerMetre: number;
  /** Unit ground vector of shadow fall (east, north). */
  shadowDir: { east: number; north: number };
  up: boolean;
};

/**
 * Sun position + shadow direction at a site.
 * Shadow falls opposite the sun along the horizon.
 */
export function sunCastAt(
  date: Date,
  lat: number,
  lng: number,
): SunCast {
  const pos = SunCalc.getPosition(date, lat, lng);
  const altitude = pos.altitude;
  const azimuth = pos.azimuth;
  const up = altitude > 0.04;
  const shadowPerMetre = up ? 1 / Math.tan(altitude) : 0;
  // SunCalc azimuth: 0 = south → west positive.
  // Shadow opposite sun: east = +sin(az), north = +cos(az).
  return {
    altitude,
    azimuth,
    shadowPerMetre,
    shadowDir: {
      east: Math.sin(azimuth),
      north: Math.cos(azimuth),
    },
    up,
  };
}

/**
 * 2D footprint of a building shadow (union-style extrusion).
 * Returns a polygon ring (closed) or null at night / degenerate.
 */
export function castBuildingShadow(
  buildingRing: LngLat[],
  heightM: number,
  date: Date,
  siteLat: number,
  siteLng: number,
): LngLat[] | null {
  const open = openRing(buildingRing);
  if (open.length < 3 || heightM <= 0) return null;
  const cast = sunCastAt(date, siteLat, siteLng);
  if (!cast.up || cast.shadowPerMetre > 80) return null;

  const len = heightM * cast.shadowPerMetre;
  const de = cast.shadowDir.east * len;
  const dn = cast.shadowDir.north * len;

  const base = open;
  const tip = open.map(([lng, lat]) => offsetLngLat(lng, lat, de, dn));

  // Classic silhouette: walk base, then tip reversed.
  const silhouette: LngLat[] = [
    ...base,
    ...tip.slice().reverse(),
  ];
  return closeRing(silhouette);
}

export function formatSunClock(date: Date): string {
  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Minutes from local midnight for a Date. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Build a Date on the same calendar day with given minutes since midnight. */
export function dateAtMinutes(base: Date, minutes: number): Date {
  const d = new Date(base);
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutes));
  d.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
  return d;
}

export function sunDayBounds(
  date: Date,
  lat: number,
  lng: number,
): { sunriseMin: number; sunsetMin: number } {
  const times = SunCalc.getTimes(date, lat, lng);
  const rise = times.sunrise;
  const set = times.sunset;
  if (
    !rise ||
    !set ||
    Number.isNaN(rise.getTime()) ||
    Number.isNaN(set.getTime())
  ) {
    return { sunriseMin: 6 * 60, sunsetMin: 18 * 60 };
  }
  return {
    sunriseMin: minutesOfDay(rise),
    sunsetMin: minutesOfDay(set),
  };
}
