import type { GeoJsonPolygon } from "@workstream/contracts";
import {
  pointInRing,
  polygonArea,
  type LngLat,
  type VicmapParcelAttrs,
} from "@workstream/domain";

/** Reject park / suburb-scale MultiPolygon parts when a residential ring exists. */
const MAX_SANE_TITLE_AREA_M2 = 80_000;

/**
 * DELWP public GeoServer — Vicmap Property / buildings as keyless WFS GeoJSON.
 * Not developer.vic.gov.au (that portal does not carry Vicmap Property).
 * Layer names are discovered from GetCapabilities rather than hard-coded.
 */
const WFS_BASE = "https://opendata.maps.vic.gov.au/geoserver/wfs";

const COMMON_PARAMS = {
  service: "WFS",
  version: "2.0.0",
  request: "GetFeature",
  outputFormat: "application/json",
  srsName: "EPSG:4326",
  count: "20",
};

/** Vicmap WFS can stall; abort each call so runSurvey never hangs the loader. */
const WFS_TIMEOUT_MS = 8000;

type Coord = [number, number];
type Ring = Coord[];

type RawGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] }
  | { type: "LineString"; coordinates: Coord[] }
  | { type: "MultiLineString"; coordinates: Coord[][] }
  | { type: "Point"; coordinates: Coord }
  | { type: "MultiPoint"; coordinates: Coord[] };

type RawFeature = {
  type: "Feature";
  geometry: RawGeometry;
  properties?: Record<string, unknown>;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: RawFeature[];
};

export type VicmapTitleParcel = {
  polygon: GeoJsonPolygon;
  attrs: VicmapParcelAttrs;
};

type DiscoveredLayer = {
  typeName: string;
  geomField: string;
};

let capabilitiesCache: string[] | null = null;
let capabilitiesCacheAt = 0;
const CAPABILITIES_TTL_MS = 60 * 60 * 1000;

let propertyLayerCache: DiscoveredLayer | null = null;
let buildingLayerCache: DiscoveredLayer | null = null;
let easementLayerCache: DiscoveredLayer | null = null;

export type VicmapEasementLine = {
  /** EPSG:4326 vertices along the easement curve. */
  coordinates: Coord[];
  pfi: string | null;
  status: string | null;
};

/**
 * Vicmap cadastral is always available via the public GeoServer.
 * Kept as a function so call sites stay readable; the old API-key gate is gone.
 */
export function isVicmapEnabled(): boolean {
  return true;
}

function localName(typeName: string): string {
  const i = typeName.indexOf(":");
  return (i >= 0 ? typeName.slice(i + 1) : typeName).toLowerCase();
}

/** Score a GetCapabilities FeatureType name for Vicmap property / parcel polygons. */
export function scorePropertyLayerName(typeName: string): number {
  const n = localName(typeName);
  if (!n) return -Infinity;

  // Hard rejects — wrong product or non-polygon / non-title layers.
  if (
    /solar|bushfire|address|point$|_line$|annotation|tenure|proposed|approved|region|lga|locality|farm/.test(
      n,
    )
  ) {
    return -100;
  }

  let score = 0;
  if (n === "property_view") score += 100;
  else if (n === "parcel_view") score += 90;
  else if (n === "v_property_mp") score += 80;
  else if (n === "vlat_property_view") score += 75;
  else if (n === "parcel_property") score += 70;
  else if (n === "v_parcel_mp") score += 65;
  else if (n.includes("property") && n.includes("view")) score += 60;
  else if (n.includes("parcel") && n.includes("view")) score += 55;
  else if (n.includes("property")) score += 40;
  else if (n.includes("parcel")) score += 35;
  else if (n.includes("cad") && n.includes("bdy")) score += 25;
  else return -Infinity;

  if (n.endsWith("_view")) score += 8;
  if (n.startsWith("v_s_")) score -= 20;
  return score;
}

/** Score a GetCapabilities FeatureType name for building footprints. */
export function scoreBuildingLayerName(typeName: string): number {
  const n = localName(typeName);
  if (!n) return -Infinity;
  if (!n.includes("building")) return -Infinity;
  if (/point$|_line$|address/.test(n)) return -50;

  let score = 0;
  if (n === "building_polygon") score += 100;
  else if (n.includes("building") && n.includes("polygon")) score += 80;
  else if (n.includes("building")) score += 40;
  return score;
}

/**
 * KEYLESS next — same GetCapabilities stack as title/building.
 * Prefer view / polygon layers. Easement hydrate is LIVE via
 * `fetchEasementLinesForTitle` (title-ring INTERSECTS).
 */
export type VicmapKeylessKind =
  | "easement"
  | "planning"
  | "bushfire"
  | "urban_tree"
  | "contour"
  | "flood"
  | "heritage"
  | "water_corp"
  | "road_casement"
  | "acid_sulfate"
  | "wetland";

function scoreNamed(
  typeName: string,
  prefer: RegExp[],
  reject: RegExp[],
  exactBoost: Record<string, number> = {},
): number {
  const n = localName(typeName);
  if (!n) return -Infinity;
  for (const r of reject) {
    if (r.test(n)) return -100;
  }
  if (exactBoost[n] != null) return exactBoost[n]!;
  let score = -Infinity;
  for (const p of prefer) {
    if (p.test(n)) {
      score = Math.max(score, 40);
      if (n.includes("view") || n.includes("polygon")) score += 20;
      if (n.includes("proposed")) score -= 15;
    }
  }
  return score;
}

/**
 * Score Vicmap Property easement line layers.
 * Prefer the full `easement` layer over simplified approved/proposed views.
 */
export function scoreEasementLayerName(typeName: string): number {
  const n = localName(typeName);
  if (!n) return -Infinity;
  if (!n.includes("easement")) return -Infinity;
  if (/anno|annotation|label|point$/.test(n)) return -80;

  let score = 0;
  if (n === "easement") score += 100;
  else if (n.includes("easement") && n.includes("approved") && !n.includes("proposed")) {
    score += 70;
  } else if (n.includes("easement") && n.includes("proposed")) score += 40;
  else if (n.includes("easement")) score += 50;

  if (n.startsWith("v_s_")) score -= 5;
  return score;
}

export function scorePlanningLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/planning.?zone/, /zone.?polygon/, /\bpg_/, /land.?use.?zone/],
    [/annotation/, /label/, /address/],
    { planning_zone: 100, v_zone_polygon: 90 },
  );
}

export function scoreBushfireLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/bushfire/, /\bbpa\b/, /bmo/, /fire.?prone/],
    [/annotation/, /label/],
    { bushfire_prone_area: 100, bpa: 90 },
  );
}

export function scoreUrbanTreeLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/tree_urban/, /urban.?tree/, /canopy/, /veg.?tree/],
    [/annotation/, /farm/, /plantation/],
    { tree_urban: 100, urban_tree: 90 },
  );
}

export function scoreContourLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/contour/, /hypsometric/, /elevation.?line/],
    [/spot.?height/, /annotation/],
    { contour: 90, contours_1m: 100, contours_5m: 85 },
  );
}

export function scoreFloodLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/flood/, /lsio/, /inundation/, /overlay.?flood/],
    [/annotation/, /label/],
    { flood_extent: 90, lsio: 95 },
  );
}

export function scoreHeritageLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/heritage/, /\bho\b/, /heritage.?overlay/],
    [/annotation/, /label/],
    { heritage_overlay: 100, heritage: 80 },
  );
}

export function scoreWaterCorpLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/water.?corp/, /watercorp/, /melb.?water/, /authority.?boundary/],
    [/pipe/, /main/, /sewer/, /annotation/],
    { water_corporation: 100 },
  );
}

export function scoreRoadCasementLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/road.?casement/, /road.?reserve/, /tr_road/, /road.?polygon/],
    [/annotation/, /centerline/, /centreline/],
    { road_casement_polygon: 100, tr_road: 80 },
  );
}

export function scoreAcidSulfateLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/acid.?sulfate/, /acid.?sulphate/, /\bass\b/],
    [/annotation/],
    { acid_sulfate_soil: 100 },
  );
}

export function scoreWetlandLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/wetland/, /ramsar/, /swamp/],
    [/annotation/, /label/],
    { wetland: 100 },
  );
}

export const VICMAP_KEYLESS_SCORERS: Record<
  VicmapKeylessKind,
  (typeName: string) => number
> = {
  easement: scoreEasementLayerName,
  planning: scorePlanningLayerName,
  bushfire: scoreBushfireLayerName,
  urban_tree: scoreUrbanTreeLayerName,
  contour: scoreContourLayerName,
  flood: scoreFloodLayerName,
  heritage: scoreHeritageLayerName,
  water_corp: scoreWaterCorpLayerName,
  road_casement: scoreRoadCasementLayerName,
  acid_sulfate: scoreAcidSulfateLayerName,
  wetland: scoreWetlandLayerName,
};

/** Pick best KEYLESS layer names from a capabilities list (discovery only). */
export function discoverKeylessLayerNames(
  typeNames: string[],
): Partial<Record<VicmapKeylessKind, string>> {
  const out: Partial<Record<VicmapKeylessKind, string>> = {};
  for (const [kind, scoreFn] of Object.entries(VICMAP_KEYLESS_SCORERS) as Array<
    [VicmapKeylessKind, (n: string) => number]
  >) {
    const best = pickBestLayerName(typeNames, scoreFn);
    if (best) out[kind] = best;
  }
  return out;
}

/** Pick the best-scoring typeName from a capabilities list. */
export function pickBestLayerName(
  typeNames: string[],
  scoreFn: (name: string) => number,
): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const name of typeNames) {
    const s = scoreFn(name);
    if (s > bestScore) {
      bestScore = s;
      best = name;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Parse FeatureType Name elements from a WFS GetCapabilities document. */
export function parseFeatureTypeNames(capabilitiesXml: string): string[] {
  const names: string[] = [];
  const re = /<(?:\w+:)?Name>\s*([^<]+?)\s*<\/(?:\w+:)?Name>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(capabilitiesXml))) {
    const name = m[1]?.trim();
    if (!name || !name.includes(":")) continue;
    // Skip ows: metadata Name elements that are not layer typeNames —
    // FeatureType names are typically workspace:layer.
    if (/^(WFS|Get|Describe|Create|List|service|version)/i.test(name)) continue;
    names.push(name);
  }
  return [...new Set(names)];
}

/**
 * Parse geometry property name from DescribeFeatureType XSD.
 * Prefers elements typed as gml:*PropertyType (geom, the_geom, shape, …).
 */
export function parseGeometryFieldName(describeXml: string): string | null {
  const preferred = ["geom", "the_geom", "geometry", "shape", "wkb_geometry"];
  const found: string[] = [];
  const re =
    /<(?:\w+:)?element[^>]*\bname=["']([^"']+)["'][^>]*\btype=["']([^"']+)["'][^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(describeXml))) {
    const name = m[1]?.trim();
    const type = m[2]?.trim() ?? "";
    if (!name) continue;
    if (/gml:|Geometry|Surface|Polygon|MultiPolygon|Curve/i.test(type)) {
      found.push(name);
    }
  }
  for (const p of preferred) {
    const hit = found.find((f) => f.toLowerCase() === p);
    if (hit) return hit;
  }
  return found[0] ?? null;
}

async function fetchCapabilitiesTypeNames(): Promise<string[]> {
  const now = Date.now();
  if (capabilitiesCache && now - capabilitiesCacheAt < CAPABILITIES_TTL_MS) {
    return capabilitiesCache;
  }
  const url = `${WFS_BASE}?${new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetCapabilities",
  }).toString()}`;
  const res = await fetch(url, {
    headers: { accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(WFS_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Vicmap GetCapabilities ${res.status}: ${await res.text()}`);
  }
  const xml = await res.text();
  const names = parseFeatureTypeNames(xml);
  if (names.length === 0) {
    throw new Error("Vicmap GetCapabilities returned no FeatureType names");
  }
  capabilitiesCache = names;
  capabilitiesCacheAt = now;
  return names;
}

async function describeGeometryField(typeName: string): Promise<string> {
  const url = `${WFS_BASE}?${new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "DescribeFeatureType",
    typeNames: typeName,
  }).toString()}`;
  const res = await fetch(url, {
    headers: { accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(WFS_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(
      `Vicmap DescribeFeatureType ${res.status} for ${typeName}: ${await res.text()}`,
    );
  }
  const xml = await res.text();
  const field = parseGeometryFieldName(xml);
  if (!field) {
    throw new Error(
      `Vicmap layer ${typeName}: could not find a geometry field in DescribeFeatureType. ` +
      `Inspect ${url} and update the CQL INTERSECTS(<geomField>, …) field name.`,
    );
  }
  return field;
}

/** Discover Vicmap property/parcel polygon layer + its geometry field. */
export async function discoverPropertyLayer(): Promise<DiscoveredLayer> {
  if (propertyLayerCache) return propertyLayerCache;
  const names = await fetchCapabilitiesTypeNames();
  const typeName = pickBestLayerName(names, scorePropertyLayerName);
  if (!typeName) {
    throw new Error(
      "Vicmap: no property/parcel FeatureType found in GetCapabilities. " +
      `Inspect ${WFS_BASE}?service=WFS&request=GetCapabilities`,
    );
  }
  const geomField = await describeGeometryField(typeName);
  propertyLayerCache = { typeName, geomField };
  return propertyLayerCache;
}

/** Discover Vicmap building footprint polygon layer + its geometry field. */
export async function discoverBuildingLayer(): Promise<DiscoveredLayer> {
  if (buildingLayerCache) return buildingLayerCache;
  const names = await fetchCapabilitiesTypeNames();
  const typeName = pickBestLayerName(names, scoreBuildingLayerName);
  if (!typeName) {
    throw new Error(
      "Vicmap: no building polygon FeatureType found in GetCapabilities. " +
      `Inspect ${WFS_BASE}?service=WFS&request=GetCapabilities`,
    );
  }
  const geomField = await describeGeometryField(typeName);
  buildingLayerCache = { typeName, geomField };
  return buildingLayerCache;
}

/** Discover Vicmap Property easement line layer + its geometry field. */
export async function discoverEasementLayer(): Promise<DiscoveredLayer> {
  if (easementLayerCache) return easementLayerCache;
  const names = await fetchCapabilitiesTypeNames();
  const typeName = pickBestLayerName(names, scoreEasementLayerName);
  if (!typeName) {
    throw new Error(
      "Vicmap: no easement FeatureType found in GetCapabilities. " +
      `Inspect ${WFS_BASE}?service=WFS&request=GetCapabilities`,
    );
  }
  const geomField = await describeGeometryField(typeName);
  easementLayerCache = { typeName, geomField };
  return easementLayerCache;
}

/** @deprecated Prefer discoverPropertyLayer(); kept for call-site clarity. */
export async function discoverPropertyLayerName(): Promise<string> {
  return (await discoverPropertyLayer()).typeName;
}

function buildUrl(typeName: string, cqlFilter: string): string {
  const params = new URLSearchParams({
    ...COMMON_PARAMS,
    typeNames: typeName,
    CQL_FILTER: cqlFilter,
  });
  return `${WFS_BASE}?${params.toString()}`;
}

async function wfsFetch(url: string): Promise<FeatureCollection> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(WFS_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text();
    const geomHint =
      /geom|geometry|IllegalAttribute|Could not locate/i.test(body)
        ? " Geometry field may be wrong — check DescribeFeatureType for this layer."
        : "";
    throw new Error(`Vicmap WFS ${res.status}: ${body.slice(0, 400)}${geomHint}`);
  }
  return (await res.json()) as FeatureCollection;
}

/** Exterior rings from a Polygon or MultiPolygon (no holes). */
export function explodeExteriorRings(geom: RawGeometry): Ring[] {
  if (geom.type === "Polygon") {
    const ring = geom.coordinates[0];
    return ring && ring.length >= 3 ? [ring] : [];
  }
  if (geom.type === "MultiPolygon") {
    const out: Ring[] = [];
    for (const poly of geom.coordinates) {
      const ring = poly[0];
      if (ring && ring.length >= 3) out.push(ring);
    }
    return out;
  }
  return [];
}

/** Line / multiline rings for contour-style KEYLESS layers. */
export function explodeLineRings(geom: RawGeometry): Ring[] {
  if (geom.type === "LineString") {
    return geom.coordinates.length >= 2 ? [geom.coordinates] : [];
  }
  if (geom.type === "MultiLineString") {
    return geom.coordinates.filter((r) => r.length >= 2);
  }
  // Some contour layers ship as thin polygons — accept those too.
  return explodeExteriorRings(geom);
}

/** Largest exterior ring — used for building footprints (main mass). */
function _largestPolygonRing(geom: RawGeometry): Ring | null {
  let best: Ring | null = null;
  let bestArea = 0;
  for (const ring of explodeExteriorRings(geom)) {
    const area = polygonArea(ring as Coord[]);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  return best;
}

/**
 * Pick the cadastral title ring for a pin: smallest ring that contains the
 * point and is under {@link MAX_SANE_TITLE_AREA_M2}. Avoids Vicmap
 * MultiPolygon parts that are parks / suburb aggregates.
 */
export function pickTitleRingForPin(
  rings: Ring[],
  lng: number,
  lat: number,
  maxAreaM2 = MAX_SANE_TITLE_AREA_M2,
): Ring | null {
  const scored = rings
    .map((ring) => {
      const area = polygonArea(ring as Coord[]);
      return {
        ring,
        area,
        contains: pointInRing(lng, lat, ring as LngLat[]),
      };
    })
    .filter((r) => Number.isFinite(r.area) && r.area > 1)
    .sort((a, b) => a.area - b.area);

  const containingSane = scored.filter(
    (r) => r.contains && r.area <= maxAreaM2,
  );
  if (containingSane[0]) return containingSane[0].ring;

  const containingAny = scored.filter((r) => r.contains);
  if (containingAny[0]) return containingAny[0].ring;

  const sane = scored.filter((r) => r.area <= maxAreaM2);
  if (sane[0]) return sane[0].ring;

  return scored[0]?.ring ?? null;
}

function ensureClosedRing(ring: Ring): Ring {
  if (ring.length < 3) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function toGeoJsonPolygon(ring: Ring): GeoJsonPolygon {
  return { type: "Polygon", coordinates: [ensureClosedRing(ring)] };
}

function propStr(
  props: Record<string, unknown> | undefined,
  ...keys: string[]
): string | null {
  if (!props) return null;
  const lower = new Map(
    Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "null" && s !== "undefined") return s;
  }
  return null;
}

function propNum(
  props: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null {
  if (!props) return null;
  const lower = new Map(
    Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Point / MultiPoint coordinates from a WFS feature geometry. */
export function extractPoints(geom: RawGeometry | undefined): Coord[] {
  if (!geom) return [];
  if (geom.type === "Point") {
    const [lng, lat] = geom.coordinates;
    return Number.isFinite(lng) && Number.isFinite(lat)
      ? [[lng, lat]]
      : [];
  }
  if (geom.type === "MultiPoint") {
    return geom.coordinates.filter(
      (c): c is Coord =>
        Array.isArray(c) &&
        c.length >= 2 &&
        Number.isFinite(c[0]) &&
        Number.isFinite(c[1]),
    );
  }
  return [];
}

/** LineString / MultiLineString parts from a WFS feature geometry. */
export function extractPolylines(geom: RawGeometry | undefined): Coord[][] {
  if (!geom) return [];
  if (geom.type === "LineString") {
    return geom.coordinates.length >= 2 ? [geom.coordinates] : [];
  }
  if (geom.type === "MultiLineString") {
    return geom.coordinates.filter((line) => line.length >= 2);
  }
  return [];
}

export function extractVicmapParcelAttrs(
  props: Record<string, unknown> | undefined,
  lotAreaM2: number,
): VicmapParcelAttrs {
  return {
    pfi: propStr(props, "PROP_PFI", "PROPV_PFI", "prop_pfi", "propv_pfi", "PFI", "pfi"),
    propNum: propStr(
      props,
      "PROP_PROPNUM",
      "PROPNUM",
      "prop_propnum",
      "propnum",
    ),
    spi: propStr(props, "SPI", "PARCEL_SPI", "spi", "parcel_spi"),
    lgaCode: propStr(
      props,
      "PROP_LGA_CODE",
      "LGA_CODE",
      "prop_lga_code",
      "lga_code",
    ),
    lotAreaM2: lotAreaM2 > 0 ? lotAreaM2 : null,
  };
}

/**
 * Fetch the property polygon + cadastral attributes enclosing a lat/lng.
 * Returns null on miss.
 */
export async function fetchTitleParcel(
  lat: number,
  lng: number,
): Promise<VicmapTitleParcel | null> {
  const { typeName, geomField } = await discoverPropertyLayer();
  const cql = `INTERSECTS(${geomField}, SRID=4326;POINT(${lng} ${lat}))`;
  const url = buildUrl(typeName, cql);
  const fc = await wfsFetch(url);
  if (fc.features.length === 0) return null;

  // Collect every exterior ring with its parent feature attrs.
  const candidates: Array<{ ring: Ring; feature: RawFeature }> = [];
  for (const f of fc.features) {
    for (const ring of explodeExteriorRings(f.geometry)) {
      candidates.push({ ring, feature: f });
    }
  }
  const bestRing = pickTitleRingForPin(
    candidates.map((c) => c.ring),
    lng,
    lat,
  );
  if (!bestRing) return null;
  const best =
    candidates.find((c) => c.ring === bestRing)?.feature ??
    candidates[0]!.feature;

  const lotAreaM2 = Math.round(polygonArea(bestRing as Coord[]));
  return {
    polygon: toGeoJsonPolygon(bestRing),
    attrs: extractVicmapParcelAttrs(best.properties, lotAreaM2),
  };
}

/** Fetch the property polygon enclosing a lat/lng. Returns null on miss. */
export async function fetchTitlePolygon(
  lat: number,
  lng: number,
): Promise<GeoJsonPolygon | null> {
  const parcel = await fetchTitleParcel(lat, lng);
  return parcel?.polygon ?? null;
}

/**
 * Max dwelling footprint as a fraction of title area. Matches web
 * `MAX_FOOTPRINT_COVERAGE_FRAC` — Vicmap INTERSECTS can return a neighbour
 * complex larger than the lot; never hydrate that as the house.
 */
export const MAX_DWELLING_COVERAGE_FRAC = 0.8;

/**
 * Among INTERSECTS candidates, pick the largest footprint that still fits
 * under the title coverage cap. Returns null when every candidate is absurd.
 */
export function pickPlausibleBuildingRing(
  titleRing: Ring,
  candidateRings: Ring[],
  maxCoverageFrac = MAX_DWELLING_COVERAGE_FRAC,
): Ring | null {
  const closed = ensureClosedRing(titleRing);
  const titleArea = polygonArea(closed as Coord[]);
  if (!(titleArea > 1)) return null;
  const maxHouse = titleArea * maxCoverageFrac;
  const sane = candidateRings
    .map((ring) => ({ ring, area: polygonArea(ring as Coord[]) }))
    .filter((c) => Number.isFinite(c.area) && c.area > 1 && c.area <= maxHouse)
    .sort((a, b) => b.area - a.area);
  return sane[0]?.ring ?? null;
}

/** Fetch the building footprint(s) intersecting a property polygon. Returns the
 * largest *plausible* one as a Polygon. Returns null if none fit the title. */
export async function fetchBuildingPolygon(
  titleRing: Ring,
): Promise<GeoJsonPolygon | null> {
  const { typeName, geomField } = await discoverBuildingLayer();
  const closed = ensureClosedRing(titleRing);
  const wkt = `POLYGON((${closed.map(([x, y]) => `${x} ${y}`).join(", ")}))`;
  const cql = `INTERSECTS(${geomField}, SRID=4326;${wkt})`;
  const url = buildUrl(typeName, cql);
  const fc = await wfsFetch(url);
  if (fc.features.length === 0) return null;

  const rings = fc.features.flatMap((f) => explodeExteriorRings(f.geometry));
  const best = pickPlausibleBuildingRing(closed, rings);
  // No footprint fits the lot — prefer empty over an envelope larger than title.
  return best ? toGeoJsonPolygon(best) : null;
}

type LineGeometry =
  | { type: "LineString"; coordinates: Coord[] }
  | { type: "MultiLineString"; coordinates: Coord[][] };

function isLineGeometry(geom: unknown): geom is LineGeometry {
  if (!geom || typeof geom !== "object") return false;
  const g = geom as { type?: string; coordinates?: unknown };
  return g.type === "LineString" || g.type === "MultiLineString";
}

function explodeLineCoordinates(geom: LineGeometry): Coord[][] {
  if (geom.type === "LineString") {
    return geom.coordinates.length >= 2 ? [geom.coordinates] : [];
  }
  return geom.coordinates.filter((line) => line.length >= 2);
}

/** Max easement LineStrings per title — keeps auto-trace payload bounded. */
export const EASEMENT_LINE_CAP = 24;

/** Max urban tree points per title — keeps auto-trace payload bounded. */
export const URBAN_TREE_CAP = 40;

export type VicmapUrbanTreePoint = {
  /** EPSG:4326 tree centre. */
  lng: number;
  lat: number;
  /** Indicative canopy radius (m) when Vicmap attrs present — never DBH. */
  canopyRadiusM: number | null;
  /** Indicative height (m) when present. */
  heightM: number | null;
  label: string | null;
};

/**
 * Fetch Vicmap urban tree points intersecting a title ring.
 * Ghost seed only — never invent DBH; TPZ stays operator-measured.
 */
export async function fetchUrbanTreePointsForTitle(
  titleRing: Ring,
): Promise<VicmapUrbanTreePoint[]> {
  const layer = await discoverKeylessLayer("urban_tree");
  if (!layer) return [];
  const closed = ensureClosedRing(titleRing);
  const wkt = `POLYGON((${closed.map(([x, y]) => `${x} ${y}`).join(", ")}))`;
  const cql = `INTERSECTS(${layer.geomField}, SRID=4326;${wkt})`;
  const url = buildUrl(layer.typeName, cql);
  // Raise count for dense canopy lots (COMMON_PARAMS.count is 20).
  const treeUrl = url.replace(/([?&])count=\d+/i, `$1count=${URBAN_TREE_CAP}`);
  const fc = await wfsFetch(treeUrl.includes("count=") ? treeUrl : `${url}&count=${URBAN_TREE_CAP}`);
  if (fc.features.length === 0) return [];

  const out: VicmapUrbanTreePoint[] = [];
  for (const f of fc.features) {
    const canopyRadiusM = propNum(
      f.properties,
      "canopy_radius_m",
      "CANOPY_RADIUS_M",
      "canopy_radius",
      "radius_m",
    );
    const heightM = propNum(
      f.properties,
      "height_m",
      "HEIGHT_M",
      "height",
      "tree_height",
    );
    const label = propStr(
      f.properties,
      "common_name",
      "COMMON_NAME",
      "species",
      "SPECIES",
      "genus",
      "NAME",
      "name",
      "LABEL",
    );
    for (const [lng, lat] of extractPoints(f.geometry)) {
      out.push({ lng, lat, canopyRadiusM, heightM, label });
      if (out.length >= URBAN_TREE_CAP) return out;
    }
  }
  return out;
}

/**
 * Fetch Vicmap Property easement lines intersecting a title ring.
 * Vicmap captures only a subset of easements — treat as indicative site context.
 */
export async function fetchEasementLinesForTitle(
  titleRing: Ring,
): Promise<VicmapEasementLine[]> {
  const { typeName, geomField } = await discoverEasementLayer();
  const closed = ensureClosedRing(titleRing);
  const wkt = `POLYGON((${closed.map(([x, y]) => `${x} ${y}`).join(", ")}))`;
  const cql = `INTERSECTS(${geomField}, SRID=4326;${wkt})`;
  const url = buildUrl(typeName, cql);
  const fc = await wfsFetch(url);
  if (fc.features.length === 0) return [];

  const out: VicmapEasementLine[] = [];
  for (const f of fc.features) {
    if (!isLineGeometry(f.geometry)) continue;
    const pfi = propStr(f.properties, "pfi", "PFI");
    const status = propStr(f.properties, "status", "STATUS");
    for (const coordinates of explodeLineCoordinates(f.geometry)) {
      out.push({ coordinates, pfi, status });
      if (out.length >= EASEMENT_LINE_CAP) return out;
    }
  }
  return out;
}

const keylessLayerCache = new Map<VicmapKeylessKind, DiscoveredLayer>();

/** Discover a KEYLESS layer + geometry field via scorers + DescribeFeatureType. */
export async function discoverKeylessLayer(
  kind: VicmapKeylessKind,
): Promise<DiscoveredLayer | null> {
  const hit = keylessLayerCache.get(kind);
  if (hit) return hit;
  const names = await fetchCapabilitiesTypeNames();
  const scoreFn = VICMAP_KEYLESS_SCORERS[kind];
  const typeName = pickBestLayerName(names, scoreFn);
  if (!typeName) return null;
  const geomField = await describeGeometryField(typeName);
  const discovered = { typeName, geomField };
  keylessLayerCache.set(kind, discovered);
  return discovered;
}

export type KeylessFetchResult = {
  kind: VicmapKeylessKind;
  typeName: string;
  /** Exterior rings or contour polylines in EPSG:4326. */
  rings: Ring[];
  label: string | null;
};

/**
 * Fetch KEYLESS overlay geometry intersecting a lat/lng pin.
 * Contours prefer line rings; planning / bushfire prefer polygons.
 */
export async function fetchKeylessRings(
  kind: VicmapKeylessKind,
  lat: number,
  lng: number,
): Promise<KeylessFetchResult | null> {
  const layer = await discoverKeylessLayer(kind);
  if (!layer) return null;
  const cql = `INTERSECTS(${layer.geomField}, SRID=4326;POINT(${lng} ${lat}))`;
  const url = buildUrl(layer.typeName, cql);
  const fc = await wfsFetch(url);
  if (fc.features.length === 0) return null;

  const rings: Ring[] = [];
  let label: string | null = null;
  for (const f of fc.features) {
    const parts =
      kind === "contour"
        ? explodeLineRings(f.geometry)
        : explodeExteriorRings(f.geometry);
    for (const r of parts) rings.push(r);
    if (!label) {
      label = propStr(
        f.properties,
        "ZONE_CODE",
        "ZONE",
        "OVERLAY",
        "BMO",
        "LABEL",
        "NAME",
        "name",
      );
    }
  }
  if (rings.length === 0) return null;
  // Cap payload — board washes do not need every contour statewide.
  const capped = rings.slice(0, kind === "contour" ? 40 : 12);
  return {
    kind,
    typeName: layer.typeName,
    rings: capped,
    label,
  };
}

export type VicmapEasement = {
  /** Easement centreline as [lng, lat] pairs (EPSG:4326). */
  line: Coord[];
  status: string | null;
};

/**
 * Fetch easement polylines intersecting a property polygon.
 * Indicative only — verify on title before excavation.
 */
export async function fetchEasementPolylines(
  titleRing: Ring,
): Promise<VicmapEasement[]> {
  const { typeName, geomField } = await discoverEasementLayer();
  const wkt = `POLYGON((${titleRing
    .map(([x, y]) => `${x} ${y}`)
    .join(", ")}))`;
  const cql = `INTERSECTS(${geomField}, SRID=4326;${wkt})`;
  const url = buildUrl(typeName, cql);
  const fc = await wfsFetch(url);

  const easements: VicmapEasement[] = [];
  for (const f of fc.features) {
    const status = propStr(f.properties, "STATUS", "status");
    for (const line of extractPolylines(f.geometry)) {
      easements.push({ line, status });
    }
  }
  return easements;
}

/** Test helper — clear discovery caches between unit tests. */
export function __resetVicmapDiscoveryCacheForTests(): void {
  capabilitiesCache = null;
  capabilitiesCacheAt = 0;
  propertyLayerCache = null;
  buildingLayerCache = null;
  easementLayerCache = null;
  keylessLayerCache.clear();
}
