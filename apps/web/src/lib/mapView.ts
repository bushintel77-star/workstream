/** Mapbox Static Images — geographic bounds for overlay alignment. */

/** Mapbox Static Images API uses 256 px tiles (not 512). */
export const MAPBOX_TILE_PX = 256;

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
  const scale = MAPBOX_TILE_PX * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
    scale;
  return [x, y];
}

/** Inverse of lngLatToWorldPx (Web Mercator, Mapbox 256 px tiles). */
export function worldPxToLngLat(
  x: number,
  y: number,
  zoom: number,
): [number, number] {
  const scale = MAPBOX_TILE_PX * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
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
  // Optional Static Images overlay (e.g. pin-l+c45c26(lng,lat)/) before centre.
  const match = uri.match(
    /\/static\/(?:[^/]+\/)?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?),0\/(\d+)x(\d+)/,
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

/**
 * Arithmetic mean of ring vertices — adequate for small lot fallback views,
 * not a true polygon centroid (can sit outside non-convex rings).
 * Assumes spec-compliant GeoJSON (closed ring uses identical first/last coords).
 */
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
  const spanX = Math.max(b.maxX - b.minX, 1);
  const spanY = Math.max(b.maxY - b.minY, 1);
  const xPct = ((wx - b.minX) / spanX) * 100;
  const yPct = ((wy - b.minY) / spanY) * 100;
  return [xPct, yPct];
}

/** Inverse of projectLngLatToPercent — percent in the static frame → WGS84. */
export function percentToLngLat(
  xPct: number,
  yPct: number,
  view: StaticMapView,
): [number, number] {
  const b = staticImageMercatorBounds(view);
  const wx = b.minX + (xPct / 100) * (b.maxX - b.minX);
  const wy = b.minY + (yPct / 100) * (b.maxY - b.minY);
  return worldPxToLngLat(wx, wy, view.zoom);
}

/**
 * Fit a world (aerial) rectangle into the stage with padding.
 * Returns pan/zoom for `transform: translate(tx,ty) scale(s)`.
 */
export function fitWorldToStage(
  stageW: number,
  stageH: number,
  worldW: number,
  worldH: number,
  pad = 48,
): { scale: number; tx: number; ty: number } {
  if (worldW <= 0 || worldH <= 0 || stageW <= 0 || stageH <= 0) {
    return { scale: 1, tx: pad, ty: pad };
  }
  const scale = Math.min(
    (stageW - pad * 2) / worldW,
    (stageH - pad * 2) / worldH,
    3,
  );
  const clamped = Math.max(0.2, scale);
  return {
    scale: clamped,
    tx: (stageW - worldW * clamped) / 2,
    ty: (stageH - worldH * clamped) / 2,
  };
}

/**
 * Display pixel size for the aerial world — preserves Mapbox / natural aspect,
 * capped so Fit has a stable base before stage scaling.
 */
export function displaySizeForAerial(
  naturalW: number,
  naturalH: number,
  maxEdge = 960,
): { width: number; height: number } {
  const w = Math.max(1, naturalW);
  const h = Math.max(1, naturalH);
  const aspect = w / h;
  if (aspect >= 1) {
    return { width: maxEdge, height: Math.round(maxEdge / aspect) };
  }
  return { width: Math.round(maxEdge * aspect), height: maxEdge };
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

/** Ground span covered by the static image frame (metres, north-up). */
export function groundSpanMetres(view: StaticMapView): {
  widthM: number;
  heightM: number;
} {
  return groundSpanMetresAtZoom(view, view.zoom);
}

/** Same as groundSpanMetres but for an arbitrary zoom (e.g. a widened capture). */
export function groundSpanMetresAtZoom(
  view: Pick<StaticMapView, "lat" | "width" | "height">,
  zoom: number,
): { widthM: number; heightM: number } {
  const latRad = (view.lat * Math.PI) / 180;
  const metresPerWorldPx =
    (40_075_016.686 * Math.cos(latRad)) / (MAPBOX_TILE_PX * 2 ** zoom);
  return {
    widthM: view.width * metresPerWorldPx,
    heightM: view.height * metresPerWorldPx,
  };
}

/**
 * Mapbox static URL zoom token (preserves optional pin overlay + @2x suffix).
 * Groups: 1=prefix 2=overlay 3=lng 4=lat 5=zoom 6=width 7=height 8=@2x
 */
const MAPBOX_STATIC_ZOOM_RE =
  /(\/static\/)((?:[^/]+\/)?)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?),0\/(\d+)x(\d+)(@2x)?/;

/**
 * Zoom reduction (whole levels) so a static view covers at least `factor`× its
 * original ground span — each level down doubles the covered span. Clamped so
 * widened captures never drop below a site-context floor.
 */
export function zoomForWiderCoverage(view: StaticMapView, factor: number): number {
  const safe = Math.max(factor, 1);
  const reduced = view.zoom - Math.ceil(Math.log2(safe));
  return Math.max(14, reduced);
}

/**
 * Rebuild a Mapbox static satellite URL at a lower zoom so the same pixel
 * budget covers a wider ground span. Used to extend the aerial past the lot
 * so the 3D ground (3× board) doesn't smear at the tile edge. Preserves the
 * token, optional pin overlay, size and @2x. Returns the original URI when it
 * isn't a parseable Mapbox static URL (e.g. the dev placeholder).
 */
export function widerMapboxStaticAerial(
  uri: string,
  targetSpanM: { widthM: number; heightM: number },
): string {
  const view = parseMapboxStaticAerial(uri);
  if (!view) return uri;
  const span = groundSpanMetres(view);
  const factor = Math.max(
    targetSpanM.widthM / Math.max(span.widthM, 1),
    targetSpanM.heightM / Math.max(span.heightM, 1),
    1,
  );
  const zoom = zoomForWiderCoverage(view, factor);
  if (zoom === view.zoom) return uri;
  return uri.replace(
    MAPBOX_STATIC_ZOOM_RE,
    (m, p1, p2, lng, lat, _z, w, h, at2x) =>
      `${p1}${p2}${lng},${lat},${zoom},0/${w}x${h}${at2x ?? ""}`,
  );
}

/** Horizontal metres per canvas pixel (scale bar / indicative readouts). */
export function metresPerCanvasPixelX(
  view: StaticMapView,
  canvasWidthPx: number,
): number {
  const ground = groundSpanMetres(view);
  return ground.widthM / Math.max(canvasWidthPx, 1);
}

export function metresPerCanvasPixel(
  view: StaticMapView,
  canvasWidthPx: number,
  canvasHeightPx: number,
): { x: number; y: number } {
  const ground = groundSpanMetres(view);
  return {
    x: ground.widthM / Math.max(canvasWidthPx, 1),
    y: ground.heightM / Math.max(canvasHeightPx, 1),
  };
}

const SCALE_BAR_NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500] as const;

/** Indicative scale bar for overlay (not survey-grade). */
export function indicativeScaleBar(
  view: StaticMapView,
  canvasWidthPx: number,
  targetBarPx = 120,
): { metres: number; barPx: number } {
  const mpp = metresPerCanvasPixelX(view, canvasWidthPx);
  let best: number = SCALE_BAR_NICE[0];
  for (const m of SCALE_BAR_NICE) {
    const px = m / mpp;
    if (px <= targetBarPx) best = m;
  }
  return { metres: best, barPx: Math.max(24, Math.round(best / mpp)) };
}

export function placementIndicativeMetres(
  baseMetres: number,
  scale: number,
): number {
  return Math.round(baseMetres * scale * 10) / 10;
}
