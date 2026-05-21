/** Mapbox Static Images — geographic bounds for overlay alignment. */

export type StaticMapView = {
  lng: number;
  lat: number;
  zoom: number;
  width: number;
  height: number;
};

export type MercatorBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export function lngLatToWorldPx(
  lng: number,
  lat: number,
  zoom: number,
): [number, number] {
  const scale = 512 * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
    scale;
  return [x, y];
}

export function staticImageMercatorBounds(
  view: StaticMapView,
): MercatorBounds {
  const [cx, cy] = lngLatToWorldPx(view.lng, view.lat, view.zoom);
  const halfW = view.width / 2;
  const halfH = view.height / 2;
  return {
    minX: cx - halfW,
    maxX: cx + halfW,
    minY: cy - halfH,
    maxY: cy + halfH,
  };
}

/** Parse Mapbox static satellite URL produced by apps/api mapbox.ts */
export function parseMapboxStaticAerial(uri: string): StaticMapView | null {
  const match = uri.match(
    /\/static\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?),0\/(\d+)x(\d+)/,
  );
  if (!match) return null;
  return {
    lng: Number(match[1]),
    lat: Number(match[2]),
    zoom: Number(match[3]),
    width: Number(match[4]),
    height: Number(match[5]),
  };
}

export function ringCentroid(ring: [number, number][]): {
  lng: number;
  lat: number;
} {
  const closed =
    ring.length >= 2 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring;
  if (pts.length === 0) return { lng: 0, lat: 0 };
  const lng = pts.reduce((s, c) => s + c[0], 0) / pts.length;
  const lat = pts.reduce((s, c) => s + c[1], 0) / pts.length;
  return { lng, lat };
}

/** Project WGS84 to 0–100 % inside the static image frame (north-up). */
export function projectLngLatToPercent(
  lng: number,
  lat: number,
  view: StaticMapView,
): [number, number] {
  const [wx, wy] = lngLatToWorldPx(lng, lat, view.zoom);
  const b = staticImageMercatorBounds(view);
  const spanX = Math.max(b.maxX - b.minX, 1e-9);
  const spanY = Math.max(b.maxY - b.minY, 1e-9);
  const xPct = ((wx - b.minX) / spanX) * 100;
  const yPct = ((wy - b.minY) / spanY) * 100;
  return [xPct, yPct];
}

export function resolveStaticMapView(
  aerialUri: string,
  lotRing: [number, number][],
): StaticMapView {
  const parsed = parseMapboxStaticAerial(aerialUri);
  if (parsed) return parsed;
  const c = ringCentroid(lotRing);
  return { lng: c.lng, lat: c.lat, zoom: 19, width: 800, height: 480 };
}
