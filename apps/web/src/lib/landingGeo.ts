import { operatorApiUrl } from "./public-env";

/**
 * Landing hero geometry — the marketing page renders a real Vicmap title
 * boundary over a real Stonnington aerial (zero mock data). Everything here
 * is pure math except loadHeroTitle(), which reads the API's keyless
 * `/geo/hero` feed (the same Vicmap pipeline as the studio).
 */

/** Hero pin — 10 Hopetoun Road, Toorak (GNAF-verified; imagery-probed:
 *  a real swimming pool and landscaped gardens inside the title). */
export const HERO_PIN = { lat: -37.849765, lng: 145.028079 } as const;
export const HERO_ADDRESS = "10 Hopetoun Road, Toorak";

/**
 * Hero frame in degrees — a ~460 m × 275 m block centred on the pin. Sized
 * so the 2,169 m² title reads as a proper estate while the shadowed
 * neighbourhood stays "canvas", per the art brief.
 */
export const HERO_SPAN = { lng: 0.0052, lat: 0.002464 } as const;

export const HERO_IMAGE_W = 2000;
export const HERO_IMAGE_H = 1200;

export type Bbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type GeoPin = {
  lat: number;
  lng: number;
};

export function heroBboxFor(pin: GeoPin): Bbox {
  return {
    west: pin.lng - HERO_SPAN.lng / 2,
    east: pin.lng + HERO_SPAN.lng / 2,
    south: pin.lat - HERO_SPAN.lat / 2,
    north: pin.lat + HERO_SPAN.lat / 2,
  };
}

export function heroBbox(): Bbox {
  return heroBboxFor(HERO_PIN);
}

/**
 * Keyless Esri World Imagery export — the same sub-metre source the survey
 * canvas drapes. `size` is "W,H" pixels; a tiny size renders the instant
 * low-res base the hero fades up from (no blank first paint).
 */
export function buildHeroAerialUrlFor(
  pin: GeoPin,
  sizeW = HERO_IMAGE_W,
  sizeH = HERO_IMAGE_H,
): string {
  const { west, south, east, north } = heroBboxFor(pin);
  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    size: `${sizeW},${sizeH}`,
    format: "png32",
    f: "image",
    bboxSR: "4326",
    imageSR: "4326",
  });
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`;
}

export function buildHeroAerialUrl(
  sizeW = HERO_IMAGE_W,
  sizeH = HERO_IMAGE_H,
): string {
  return buildHeroAerialUrlFor(HERO_PIN, sizeW, sizeH);
}

/** Linear EPSG:4326 → percent (0..100) within the hero bbox. */
export function projectLngLatToPct(
  lng: number,
  lat: number,
  bbox: Bbox,
): [number, number] {
  const x = ((lng - bbox.west) / (bbox.east - bbox.west)) * 100;
  const y = ((bbox.north - lat) / (bbox.north - bbox.south)) * 100;
  return [x, y];
}

/** Percent (0..100) → hero image pixels (the SVG overlay's space). */
export function pctToImagePx(
  xPct: number,
  yPct: number,
): [number, number] {
  return [(xPct / 100) * HERO_IMAGE_W, (yPct / 100) * HERO_IMAGE_H];
}

export function projectRingToPct(
  ring: ReadonlyArray<readonly [number, number]>,
  bbox: Bbox,
): [number, number][] {
  return ring.map(([lng, lat]) => projectLngLatToPct(lng, lat, bbox));
}

export function ringCentroidPct(
  ring: ReadonlyArray<readonly [number, number]>,
): [number, number] {
  if (ring.length === 0) return [50, 50];
  let x = 0;
  let y = 0;
  for (const [px, py] of ring) {
    x += px;
    y += py;
  }
  return [x / ring.length, y / ring.length];
}

export type HeroBoundary = {
  /** Title polygon in hero-image pixel space. */
  polygon: [number, number][];
  /** Dwelling footprint in the same space; null when Vicmap has none. */
  building: [number, number][] | null;
};

type HeroFeed = {
  polygon?: { coordinates?: number[][][] } | null;
  building?: { coordinates?: number[][][] } | null;
};

/**
 * Read the real title boundary + dwelling footprint from the API and project
 * both into hero-image pixels. Returns null on any failure — the landing then
 * renders the aerial without the overlay (never a fabricated polygon).
 */
export async function loadHeroBoundary(
  pin: GeoPin = HERO_PIN,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4500,
): Promise<HeroBoundary | null> {
  const api = operatorApiUrl();
  const url = `${api}/geo/hero?lat=${pin.lat}&lng=${pin.lng}`;
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as HeroFeed;
    const polyRing = body.polygon?.coordinates?.[0];
    if (!polyRing || polyRing.length < 4) return null;
    const bbox = heroBboxFor(pin);
    const titleRing: [number, number][] = polyRing.map((c) => [
      Number(c[0]),
      Number(c[1]),
    ]);
    const polygon = projectRingToPct(titleRing, bbox).map(([x, y]) =>
      pctToImagePx(x, y),
    );
    const bldRing = body.building?.coordinates?.[0];
    const building =
      bldRing && bldRing.length >= 4
        ? projectRingToPct(
            bldRing.map((c) => [Number(c[0]), Number(c[1])] as [number, number]),
            bbox,
          ).map(([x, y]) => pctToImagePx(x, y))
        : null;
    return { polygon, building };
  } catch {
    return null;
  }
}

/** DMS label for a pin — mono coordinate chip in the top bar. */
export function pinDmsLabel(pin: GeoPin): string {
  const latAbs = Math.abs(pin.lat);
  const latDeg = Math.floor(latAbs);
  const latMin = (latAbs - latDeg) * 60;
  const latSec = Math.round(((latMin - Math.floor(latMin)) * 60) * 10) / 10;
  const lngAbs = Math.abs(pin.lng);
  const lngDeg = Math.floor(lngAbs);
  const lngMin = (lngAbs - lngDeg) * 60;
  const lngSec = Math.round(((lngMin - Math.floor(lngMin)) * 60) * 10) / 10;
  const ns = pin.lat >= 0 ? "N" : "S";
  const ew = pin.lng >= 0 ? "E" : "W";
  return `${latDeg}°${Math.floor(latMin)}′${latSec}″${ns} · ${lngDeg}°${Math.floor(lngMin)}′${lngSec}″${ew}`;
}

/** DMS label for the default hero pin. */
export function heroPinLabel(): string {
  return pinDmsLabel(HERO_PIN);
}
