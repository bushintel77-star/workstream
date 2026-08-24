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
export type Ring = Coord[];
export type RawGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] }
  | { type: "LineString"; coordinates: Coord[] }
  | { type: "MultiLineString"; coordinates: Coord[][] }
  | { type: "Point"; coordinates: Coord }
  | { type: "MultiPoint"; coordinates: Coord[] };

export type RawFeature = {
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
  | "wetland"
  | "native_vegetation";

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
    [/plan.?zone/, /zone.?polygon/, /\bpg_/, /land.?use.?zone/],
    [/annotation/, /label/, /address/],
    { plan_zone: 100, planning_zone: 95, v_zone_polygon: 90 },
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

/**
 * Score native vegetation / EVC layers (NatureKit's modelled Ecological
 * Vegetation Classes, published as open WFS on the same DELWP GeoServer).
 * These drive Clause 52.17 native-vegetation permit considerations.
 */
export function scoreNativeVegetationLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/native.?veg/, /ecological.?vegetation/, /\bevc/, /remnant.?veg/],
    [/annotation/, /label/, /point$/, /observation/],
    { nv2005_evcbcs: 100, native_vegetation: 95, evc: 90 },
  );
}

export function scoreContourLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/contour/, /hypsometric/, /elevation.?line/],
    [/spot.?height/, /annotation/],
    {
      contour: 90,
      contours_1m: 100,
      contours_5m: 85,
      el_contour: 95,
      el_contour_1to5m: 92,
    },
  );
}

export function scoreFloodLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/flood/, /lsio/, /inundation/, /overlay.?flood/, /special.?building/],
    [/annotation/, /label/],
    {
      plan_overlay: 90,
      lsio: 95,
      flood_extent: 90,
    },
  );
}

export function scoreHeritageLayerName(typeName: string): number {
  return scoreNamed(
    typeName,
    [/heritage/, /\bho\b/, /heritage.?overlay/],
    [/annotation/, /label/],
    { plan_overlay: 90, heritage_overlay: 100, heritage: 80 },
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

/**
 * KEYLESS layer spec — how to discover + query each overlay kind.
 *
 * `scorer` picks the layer from GetCapabilities. `cql` is an extra attribute
 * predicate ANDed onto the spatial filter (e.g. heritage overlays live inside
 * the shared `plan_overlay` layer under `zone_code LIKE 'HO%'`). `bbox` marks
 * line layers (contours) — a point INTERSECTS never matches a line, so those
 * query a window around the pin instead.
 */
export type KeylessLayerSpec = {
  scorer: (name: string) => number;
  /** Extra CQL predicate ANDed onto the spatial filter. */
  cql?: string;
  /** Line layer: query a BBOX around the pin instead of INTERSECTS(point). */
  bbox?: boolean;
};

export const VICMAP_KEYLESS_SPECS: Record<VicmapKeylessKind, KeylessLayerSpec> =
  {
    easement: { scorer: scoreEasementLayerName },
    planning: { scorer: scorePlanningLayerName },
    bushfire: { scorer: scoreBushfireLayerName },
    urban_tree: { scorer: scoreUrbanTreeLayerName },
    contour: { scorer: scoreContourLayerName, bbox: true },
    flood: {
      scorer: scoreFloodLayerName,
      cql: "(zone_code LIKE 'LSIO%' OR zone_code LIKE 'SBO%' OR zone_code LIKE 'FLO%')",
    },
    heritage: {
      scorer: scoreHeritageLayerName,
      cql: "zone_code LIKE 'HO%'",
    },
    water_corp: { scorer: scoreWaterCorpLayerName },
    road_casement: { scorer: scoreRoadCasementLayerName },
    acid_sulfate: { scorer: scoreAcidSulfateLayerName },
    wetland: { scorer: scoreWetlandLayerName },
    native_vegetation: { scorer: scoreNativeVegetationLayerName },
  };

/** @deprecated Use VICMAP_KEYLESS_SPECS — kept for tests and tooling. */
export const VICMAP_KEYLESS_SCORERS: Record<
  VicmapKeylessKind,
  (typeName: string) => number
> = Object.fromEntries(
  Object.entries(VICMAP_KEYLESS_SPECS).map(([k, v]) => [k, v.scorer]),
) as Record<VicmapKeylessKind, (typeName: string) => number>;

/**
 * Build the CQL filter for a KEYLESS kind.
 * Line layers (contours) query a BBOX window — a single point never
 * intersects a line. Polygon kinds use INTERSECTS(point) plus the spec's
 * attribute filter (e.g. heritage overlays inside `plan_overlay`).
 */
export function buildKeylessCql(
  spec: KeylessLayerSpec,
  geomField: string,
  lat: number,
  lng: number,
): string {
  // ~0.008° ≈ 800 m each way — enough to catch nearby contour lines.
  const cql = spec.bbox
    ? `BBOX(${geomField}, ${lng - 0.008}, ${lat - 0.008}, ${lng + 0.008}, ${lat + 0.008}, 'EPSG:4326')`
    : `INTERSECTS(${geomField}, SRID=4326;POINT(${lng} ${lat}))`;
  return spec.cql ? `${cql} AND ${spec.cql}` : cql;
}

/** Pick best KEYLESS layer names from a capabilities list (discovery only). */
export function discoverKeylessLayerNames(
  typeNames: string[],
): Partial<Record<VicmapKeylessKind, string>> {
  const out: Partial<Record<VicmapKeylessKind, string>> = {};
  for (const [kind, spec] of Object.entries(VICMAP_KEYLESS_SPECS) as Array<
    [VicmapKeylessKind, KeylessLayerSpec]
  >) {
    const best = pickBestLayerName(typeNames, spec.scorer);
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

/**
 * Pin bounds — every lat/lng entering a CQL filter is checked at this choke
 * point so request-derived data can only ever select a geographic window,
 * never steer the fetch target itself. The value is re-derived from its
 * plain-decimal string form: anything that is not a finite plain decimal
 * (NaN, Infinity, exponent or hex forms) is rejected outright.
 */
export function assertVicmapPin(lat: number, lng: number): void {
  for (const v of [lat, lng]) {
    const s = String(v);
    if (!/^-?\d{1,3}(\.\d+)?$/.test(s)) {
      throw new RangeError(`Vicmap pin is not a plain decimal: ${s}`);
    }
  }
  if (
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new RangeError(`Vicmap pin out of EPSG:4326 range: lat=${lat} lng=${lng}`);
  }
}

/** Ring → WKT with every coordinate bounds-checked (same invariant). */
function wktPolygon(ring: Ring): string {
  const closed = ensureClosedRing(ring);
  for (const [x, y] of closed) {
    if (
      !/^-?\d{1,3}(\.\d+)?$/.test(String(x)) ||
      !/^-?\d{1,3}(\.\d+)?$/.test(String(y)) ||
      x < -180 ||
      x > 180 ||
      y < -90 ||
      y > 90
    ) {
      throw new RangeError("Vicmap ring coordinate out of EPSG:4326 range");
    }
  }
  return `POLYGON((${closed.map(([x, y]) => `${x} ${y}`).join(", ")}))`;
}

/** Guarded WFS fetch shared with the keyed title-search module — refuses
 * any URL that is not the constant public GeoServer (SSRF invariant). */
export async function wfsFetchJson(url: string): Promise<FeatureCollection> {
  return wfsFetch(url);
}

async function wfsFetch(url: string): Promise<FeatureCollection> {
  /* SSRF invariant: every Vicmap fetch targets the constant public GeoServer
   * above. Filter text is URLSearchParams-encoded, so request data cannot
   * break out of the query string — this assertion enforces that explicitly. */
  if (!url.startsWith(`${WFS_BASE}?`)) {
    throw new Error(`Vicmap fetch refused non-WFS URL: ${url.slice(0, 80)}`);
  }
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

export function toGeoJsonPolygon(ring: Ring): GeoJsonPolygon {
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

function propNumFinite(
  props: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null {
  if (!props) return null;
  for (const k of keys) {
    const v = props[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number.parseFloat(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
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
    // DCM / Vicmap HPU — only when the WFS feature actually carries it.
    hpuM: propNumFinite(
      props,
      "HPU",
      "hpu",
      "HORIZONTAL_POSITIONAL_UNCERTAINTY",
      "horizontal_positional_uncertainty",
      "POS_UNCERTAINTY",
      "pos_uncertainty",
    ),
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
  assertVicmapPin(lat, lng);
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
  const wkt = wktPolygon(closed);
  const cql = `INTERSECTS(${geomField}, SRID=4326;${wkt})`;
  const url = buildUrl(typeName, cql);
  const fc = await wfsFetch(url);
  if (fc.features.length === 0) return null;

  const rings = fc.features.flatMap((f) => explodeExteriorRings(f.geometry));
  const best = pickPlausibleBuildingRing(closed, rings);
  // No footprint fits the lot — prefer empty over an envelope larger than title.
  return best ? toGeoJsonPolygon(best) : null;
}

/** Max neighbour footprints returned for overshadowing — bounds the payload. */
export const NEIGHBOUR_BUILDING_CAP = 12;

/** Plausible neighbour footprint area window (m²) — drop noise + park-scale. */
const MIN_NEIGHBOUR_AREA_M2 = 8;
const MAX_NEIGHBOUR_AREA_M2 = 4000;

function ringCentroidCoord(ring: Ring): Coord {
  let x = 0;
  let y = 0;
  for (const [px, py] of ring) {
    x += px;
    y += py;
  }
  const n = ring.length || 1;
  return [x / n, y / n];
}

/**
 * Expand a title ring's bbox outward to reach immediately adjacent lots.
 * Immediate neighbours dominate overshadowing, so the reach is indicative, not
 * exhaustive. `marginFrac` grows with the lot; the floor (~35 m in degrees)
 * keeps tiny lots reaching past their own fence line. Returns a closed
 * rectangular ring in EPSG:4326.
 */
export function bufferedTitleBboxRing(titleRing: Ring, marginFrac = 1.5): Ring {
  const xs = titleRing.map((c) => c[0]);
  const ys = titleRing.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const mx = Math.max((maxX - minX) * marginFrac, 0.0004);
  const my = Math.max((maxY - minY) * marginFrac, 0.00035);
  return [
    [minX - mx, minY - my],
    [maxX + mx, minY - my],
    [maxX + mx, maxY + my],
    [minX - mx, maxY + my],
    [minX - mx, minY - my],
  ];
}

/**
 * From INTERSECTS candidates in the buffered area, keep the neighbour
 * footprints: drop the subject dwelling (its centroid sits inside the title
 * ring; neighbours' do not), drop noise / park-scale rings, cap the count.
 * Largest first so the most significant overshadowers survive the cap.
 * Pure — unit-tested without a live WFS.
 */
export function selectNeighbourRings(
  titleRing: Ring,
  candidateRings: Ring[],
  cap = NEIGHBOUR_BUILDING_CAP,
): Ring[] {
  const closed = ensureClosedRing(titleRing) as LngLat[];
  return candidateRings
    .map((ring) => ({ ring, area: polygonArea(ring as Coord[]) }))
    .filter(
      (c) =>
        Number.isFinite(c.area) &&
        c.area >= MIN_NEIGHBOUR_AREA_M2 &&
        c.area <= MAX_NEIGHBOUR_AREA_M2,
    )
    .filter((c) => {
      const [cx, cy] = ringCentroidCoord(c.ring);
      return !pointInRing(cx, cy, closed);
    })
    .sort((a, b) => b.area - a.area)
    .slice(0, cap)
    .map((c) => c.ring);
}

export type VicmapNeighbourBuilding = {
  polygon: GeoJsonPolygon;
  /** Vicmap height attr in metres when present — usually absent for residential. */
  heightM: number | null;
};

/**
 * Fetch adjacent building footprints around a title for sun/overshadowing so
 * the design does not sit in a vacuum. INTERSECTS a buffered bbox (not the
 * title ring), then drops the subject dwelling and absurd rings. Height is read
 * opportunistically; Vicmap rarely carries it for residential, so the caller
 * usually falls back to a default storey assumption (height_source "assumed").
 */
export async function fetchNeighbourBuildingPolygons(
  titleRing: Ring,
): Promise<VicmapNeighbourBuilding[]> {
  const { typeName, geomField } = await discoverBuildingLayer();
  const buffered = bufferedTitleBboxRing(titleRing);
  const wkt = wktPolygon(buffered);
  const cql = `INTERSECTS(${geomField}, SRID=4326;${wkt})`;
  const url = buildUrl(typeName, cql);
  const bumpCount = NEIGHBOUR_BUILDING_CAP * 3;
  const bumped = url.includes("count=")
    ? url.replace(/([?&])count=\d+/i, `$1count=${bumpCount}`)
    : `${url}&count=${bumpCount}`;
  const fc = await wfsFetch(bumped);
  if (fc.features.length === 0) return [];

  // Keep each exterior ring tagged with its feature so height attrs survive selection.
  const tagged: { ring: Ring; feature: RawFeature }[] = [];
  for (const f of fc.features) {
    for (const ring of explodeExteriorRings(f.geometry)) {
      tagged.push({ ring, feature: f });
    }
  }
  const kept = selectNeighbourRings(
    titleRing,
    tagged.map((t) => t.ring),
  );
  return kept.map((ring) => {
    const feature = tagged.find((t) => t.ring === ring)?.feature;
    const heightM = propNum(
      feature?.properties,
      "height_m",
      "HEIGHT_M",
      "height",
      "bld_height",
      "roof_height",
    );
    return { polygon: toGeoJsonPolygon(ring), heightM };
  });
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
  const wkt = wktPolygon(closed);
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
  const wkt = wktPolygon(closed);
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
  const spec = VICMAP_KEYLESS_SPECS[kind];
  const typeName = pickBestLayerName(names, spec.scorer);
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
  /**
   * Contour elevation per ring (metres AHD), aligned with `rings` index.
   * Absent for non-contour kinds. Vicmap contour layers typically carry
   * ELEVATION, ELEV, HEIGHT, or ALTI_300 as the altitude attribute.
   */
  elevations?: (number | null)[];
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
  assertVicmapPin(lat, lng);
  const layer = await discoverKeylessLayer(kind);
  if (!layer) return null;
  const url = buildUrl(
    layer.typeName,
    buildKeylessCql(VICMAP_KEYLESS_SPECS[kind], layer.geomField, lat, lng),
  );
  const fc = await wfsFetch(url);
  if (fc.features.length === 0) return null;

  const rings: Ring[] = [];
  const elevations: (number | null)[] = [];
  let label: string | null = null;
  for (const f of fc.features) {
    const parts =
      kind === "contour"
        ? explodeLineRings(f.geometry)
        : explodeExteriorRings(f.geometry);
    // Contour elevation — Vicmap layers use ELEVATION, ELEV, HEIGHT, ALTI_300.
    const elev =
      kind === "contour"
        ? propNum(
          f.properties,
          "ELEVATION",
          "ELEV",
          "HEIGHT",
          "ALTI_300",
          "ALTITUDE",
          "Z_VALUE",
          "CONTOUR",
          "elevation",
          "elev",
          "height",
        )
        : null;
    for (const r of parts) {
      rings.push(r);
      elevations.push(elev);
    }
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
  const cap = kind === "contour" ? 40 : 12;
  const capped = rings.slice(0, cap);
  const cappedElev = elevations.slice(0, cap);
  return {
    kind,
    typeName: layer.typeName,
    rings: capped,
    label,
    ...(kind === "contour" ? { elevations: cappedElev } : {}),
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
