/**
 * Keyless aerial view model — StateView ortho WMS GetMap bbox.
 * Replaces the retired Mapbox Static Images parsing (2026-08-19): the bbox
 * IS the view, so overlay projection is plain EPSG:4326 linear mapping.
 */

export type StaticMapView = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  width: number;
  height: number;
};

export type MercatorBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const METRES_PER_DEG_LAT = 111_320;

/** Parse an aerial URI into its bbox view. Accepts both providers:
 *  - Esri World Imagery export (bbox= + size=W,H)
 *  - StateView ortho WMS (bbox= + width=/height=) */
export function parseStaticAerial(uri: string): StaticMapView | null {
  try {
    const url = new URL(uri);
    const bbox = url.searchParams.get("bbox");
    if (!bbox) return null;
    let width: number;
    let height: number;
    const size = url.searchParams.get("size");
    if (size) {
      const [w, h] = size.split(",").map(Number);
      width = w;
      height = h;
    } else {
      width = Number(url.searchParams.get("width"));
      height = Number(url.searchParams.get("height"));
    }
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
    if (
      ![minLng, minLat, maxLng, maxLat].every(Number.isFinite) ||
      maxLng <= minLng ||
      maxLat <= minLat
    ) {
      return null;
    }
    return { minLng, minLat, maxLng, maxLat, width, height };
  } catch {
    return null;
  }
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

/** Project WGS84 to 0–100 % inside the ortho frame (north-up, linear). */
export function projectLngLatToPercent(
  lng: number,
  lat: number,
  view: StaticMapView,
): [number, number] {
  const spanLng = Math.max(view.maxLng - view.minLng, 1e-9);
  const spanLat = Math.max(view.maxLat - view.minLat, 1e-9);
  const xPct = ((lng - view.minLng) / spanLng) * 100;
  const yPct = ((view.maxLat - lat) / spanLat) * 100; // north-up
  return [xPct, yPct];
}

/** Inverse of projectLngLatToPercent — percent in the ortho frame → WGS84. */
export function percentToLngLat(
  xPct: number,
  yPct: number,
  view: StaticMapView,
): [number, number] {
  const spanLng = Math.max(view.maxLng - view.minLng, 1e-9);
  const spanLat = Math.max(view.maxLat - view.minLat, 1e-9);
  const lng = view.minLng + (xPct / 100) * spanLng;
  const lat = view.maxLat - (yPct / 100) * spanLat;
  return [lng, lat];
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

/** Display pixel size for the aerial world, capped before stage scaling. */
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
  const parsed = parseStaticAerial(aerialUri);
  if (parsed) return parsed;
  const c = ringCentroid(lotRing);
  const span = 0.003; // ≈ 300 m context around the fallback centre
  return {
    minLng: c.lng - span,
    maxLng: c.lng + span,
    minLat: c.lat - span * 0.6,
    maxLat: c.lat + span * 0.6,
    width: 800,
    height: 480,
  };
}

/** Ground span covered by the ortho frame (metres, north-up). */
export function groundSpanMetres(view: StaticMapView): {
  widthM: number;
  heightM: number;
} {
  const centreLat = ((view.minLat + view.maxLat) / 2) * (Math.PI / 180);
  const lngSpanM = (view.maxLng - view.minLng) * METRES_PER_DEG_LAT * Math.cos(centreLat);
  const latSpanM = (view.maxLat - view.minLat) * METRES_PER_DEG_LAT;
  return { widthM: lngSpanM, heightM: latSpanM };
}

/** Same as groundSpanMetres but for an arbitrary widened bbox. */
export function groundSpanMetresAtZoom(
  view: StaticMapView,
  _zoom: number,
): { widthM: number; heightM: number } {
  return groundSpanMetres(view);
}

/**
 * Rebuild the WMS ortho URI with a factor-widened bbox so the same pixel
 * budget covers a wider ground span (3D ground extends past the lot edge).
 * Returns the original URI when it isn't a parseable ortho URI.
 */
export function widerStaticAerial(
  uri: string,
  targetSpanM: { widthM: number; heightM: number },
): string {
  const view = parseStaticAerial(uri);
  if (!view) return uri;
  const span = groundSpanMetres(view);
  const factor = Math.max(
    targetSpanM.widthM / Math.max(span.widthM, 1),
    targetSpanM.heightM / Math.max(span.heightM, 1),
    1,
  );
  if (factor <= 1) return uri;
  const centreLng = (view.minLng + view.maxLng) / 2;
  const centreLat = (view.minLat + view.maxLat) / 2;
  const halfLng = ((view.maxLng - view.minLng) / 2) * factor;
  const halfLat = ((view.maxLat - view.minLat) / 2) * factor;
  const url = new URL(uri);
  url.searchParams.set(
    "bbox",
    `${centreLng - halfLng},${centreLat - halfLat},${centreLng + halfLng},${centreLat + halfLat}`,
  );
  return url.toString();
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
