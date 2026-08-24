/**
 * Address-keyed title search — `v_property_mp_address` on the DELWP WFS.
 *
 * The point-based hydrate (`fetchTitleParcel(lat, lng)`) gambles that a
 * geocoded pin lands inside the right parcel; when it lands on a road or a
 * boundary line the survey stalls. This module resolves the way a title
 * search does: address → property record → parcel polygon, keyed by the
 * address fields themselves (house number + road + locality), carrying
 * prop_pfi / propnum alongside the geometry. One deterministic query; no
 * pin, no containment gamble.
 *
 * Verified live 2026-08-24 against `open-data-platform:v_property_mp_address`:
 * `add_ezi_address='10 HOPETOUN ROAD TOORAK 3142'` → 16-vertex MultiPolygon.
 */

import { polygonArea, type LngLat } from "@workstream/domain";
import {
  extractVicmapParcelAttrs,
  toGeoJsonPolygon,
  wfsFetchJson,
  type RawFeature,
  type Ring,
  type VicmapTitleParcel,
} from "./vicmap";

const LAYER = "open-data-platform:v_property_mp_address";

/** A parcel ring above this is a park / suburb aggregate, never one lot. */
const MAX_SANE_TITLE_AREA_M2 = 80_000;

/**
 * Common Melbourne street-type abbreviations → the full form GNAF stores
 * (`ezi_address` carries "ROAD"/"STREET"/…, never "RD"/"ST").
 */
const STREET_TYPE_EXPANSIONS: Record<string, string> = {
  ST: "STREET",
  RD: "ROAD",
  AVE: "AVENUE",
  CT: "COURT",
  CRT: "COURT",
  DRV: "DRIVE",
  DR: "DRIVE",
  GDNS: "GARDENS",
  HWY: "HIGHWAY",
  LN: "LANE",
  PDE: "PARADE",
  PL: "PLACE",
  TCE: "TERRACE",
  CIR: "CIRCLE",
  CL: "CLOSE",
  ESP: "ESPLANADE",
  GR: "GROVE",
  GRV: "GROVE",
  RDG: "RIDGE",
  PKWY: "PARKWAY",
  BVD: "BOULEVARD",
  BLVD: "BOULEVARD",
};

export type ParsedStreetAddress = {
  unit: string | null;
  houseNumber: string;
  roadName: string;
  roadType: string | null;
  locality: string;
};

/** CQL literal escape — double any single quote (O'Brien St). */
function cqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function expandStreetType(token: string): string {
  const up = token.toUpperCase();
  return STREET_TYPE_EXPANSIONS[up] ?? up;
}

/**
 * Parse a free-text Victorian street address into keyed search terms.
 * Accepts "10 Hopetoun Road Toorak", "10 Hopetoun Rd, Toorak VIC 3142",
 * "5/10 Leake Street Essendon", "Unit 3, 12 Smith St Fitzroy".
 * Returns null when a house number or road name cannot be recovered.
 */
export function parseStreetAddress(raw: string): ParsedStreetAddress | null {
  const cleaned = raw
    .toUpperCase()
    .replace(/\b(VIC|VICTORIA)\s+\d{4}\b\s*$/i, "")
    .replace(/\s+\d{4}\s*$/, "") // bare postcode tail ("HEALESVILLE 3777")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 5) return null;

  // Leading unit forms: "5/10 …", "UNIT 3 10 …", "U3 10 …".
  let rest = cleaned;
  let unit: string | null = null;
  const slash = rest.match(/^(\d+[A-Z]?)\s*\/\s*(\d+[A-Z]?)\s+(.+)$/);
  const unitWord = rest.match(/^(?:UNIT|APT|APARTMENT)\s*([\dA-Z]+)\s+(.+)$/i);
  if (slash) {
    unit = slash[1]!;
    rest = `${slash[2]!} ${slash[3]!}`;
  } else if (unitWord) {
    unit = unitWord[1]!;
    rest = unitWord[2]!;
  }

  const tokens = rest.split(" ");
  const houseNumber = tokens[0]!;
  if (!/^\d+[A-Z]?$/.test(houseNumber)) return null;
  if (tokens.length < 3) return null;

  // Road name runs until a street-type token (expanded or full form) or the
  // final token (some rural roads carry no type — "Yarra Road" style names
  // still end in a type, but "Oliver Hill Road Olinda" needs the last-token
  // locality heuristic: type is optional, locality is whatever follows it).
  const FULL_TYPES = new Set(Object.values(STREET_TYPE_EXPANSIONS));
  const roadNameTokens: string[] = [];
  let roadType: string | null = null;
  let i = 1;
  for (; i < tokens.length; i++) {
    const t = tokens[i]!;
    const expanded = STREET_TYPE_EXPANSIONS[t] ?? null;
    if (expanded || FULL_TYPES.has(t)) {
      roadType = expanded ?? t;
      i++;
      break;
    }
    roadNameTokens.push(t);
  }
  if (roadNameTokens.length === 0) return null;

  // Road suffix ("E", "N", "EXTENSION") may trail the type.
  const afterType = tokens.slice(i);
  const localityTokens =
    afterType.length > 0 && /^(E|N|S|W|EXT|EXTENSION|NORTH|SOUTH|EAST|WEST)$/.test(afterType[0]!)
      ? afterType.slice(1)
      : afterType;
  if (localityTokens.length === 0) return null;

  return {
    unit,
    houseNumber,
    roadName: roadNameTokens.join(" "),
    roadType,
    locality: localityTokens.join(" "),
  };
}

/**
 * Anchored ezi_address match — "10 HOPETOUN ROAD TOORAK…" as a PREFIX, so
 * "110 HOPETOUN ROAD" can never satisfy "10 HOPETOUN ROAD" (the trailing
 * space before the road name carries the guard).
 */
export function buildExactEziCql(p: ParsedStreetAddress): string {
  const head = `${p.houseNumber} ${expandStreetType(p.roadName)}${
    p.roadType ? ` ${p.roadType}` : ""
  } ${expandStreetType(p.locality)}`;
  return `add_ezi_address ILIKE '${cqlLiteral(head)} %' OR add_ezi_address = '${cqlLiteral(head)}'`;
}

/** Structured match on the address key fields — the title-search form. */
export function buildStructuredCql(p: ParsedStreetAddress): string {
  const parts = [
    `add_house_number_1='${cqlLiteral(p.houseNumber)}'`,
    `add_road_name ILIKE '${cqlLiteral(expandStreetType(p.roadName))} %' OR add_road_name = '${cqlLiteral(expandStreetType(p.roadName))}'`,
    `add_locality_name='${cqlLiteral(expandStreetType(p.locality))}'`,
    `add_is_primary='Y'`,
  ];
  if (p.unit) parts.splice(0, 0, `add_blg_unit_id_1='${cqlLiteral(p.unit)}'`);
  return parts.join(" AND ");
}

/** Largest exterior ring under the sane-area cap — the lot, not the suburb. */
function pickLotRing(geom: RawFeature["geometry"]): Ring | null {
  if (!geom) return null;
  let best: Ring | null = null;
  let bestArea = 0;
  const rings: Ring[] = [];
  if (geom.type === "Polygon" && geom.coordinates[0]) rings.push(geom.coordinates[0]);
  if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) if (poly[0]) rings.push(poly[0]);
  }
  for (const ring of rings) {
    if (ring.length < 4) continue;
    const area = polygonArea(ring as LngLat[]);
    if (Number.isFinite(area) && area > bestArea && area <= MAX_SANE_TITLE_AREA_M2) {
      bestArea = area;
      best = ring;
    }
  }
  return best;
}

export type TitleSearchResult = VicmapTitleParcel & {
  /** The GNAF formatted address that matched. */
  eziAddress: string;
  /** "exact" (ezi prefix) or "structured" (keyed fields) — for telemetry. */
  matchType: "exact" | "structured";
};

async function queryWith(cql: string): Promise<TitleSearchResult | null> {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    count: "10",
    typeNames: LAYER,
    CQL_FILTER: cql,
  });
  const fc = await wfsFetchJson(
    `https://opendata.maps.vic.gov.au/geoserver/wfs?${params.toString()}`,
  );
  for (const f of fc.features ?? []) {
    const ring = pickLotRing(f.geometry);
    if (!ring) continue;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const ezi =
      typeof props.add_ezi_address === "string" ? props.add_ezi_address : "";
    const lotAreaM2 = Math.round(polygonArea(ring as LngLat[]));
    return {
      polygon: toGeoJsonPolygon(ring),
      attrs: extractVicmapParcelAttrs(props, lotAreaM2),
      eziAddress: ezi,
      matchType: "exact",
    };
  }
  return null;
}

/**
 * Resolve the title parcel for a free-text address via keyed lookup:
 * exact ezi match first, structured fields second. Returns null when the
 * address does not resolve — the caller's point-based path remains the
 * fallback for pins and unusual addresses.
 */
export async function searchTitleParcelByAddress(
  address: string,
): Promise<TitleSearchResult | null> {
  const parsed = parseStreetAddress(address);
  if (!parsed) return null;

  const exact = await queryWith(buildExactEziCql(parsed)).catch(() => null);
  if (exact) return exact;

  const structured = await queryWith(buildStructuredCql(parsed)).catch(() => null);
  if (structured) return { ...structured, matchType: "structured" };
  return null;
}
