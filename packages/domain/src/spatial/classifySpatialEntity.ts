/**
 * Spatial Classification Engine — maps raw ingested geometry (Vicmap GIS,
 * DXF, user strokes) to semantic LayerIDs from the Domain Layer Registry.
 *
 * The classifier is pure: it reads attributes/metadata only and returns a
 * typed, layer-bound entity. All raw metadata is preserved on
 * `meta.rawAttributes` so inspectors can always show provenance.
 */

import {
  isRegisteredLayerId,
  type LayerID,
  type ProvenanceSource,
} from "../layers/layerRegistry";

export type SpatialEntitySource =
  | "vicmap"
  | "dxf"
  | "user_stroke"
  | "cad"
  | "inferred";

export interface SpatialEntityInput {
  id: string;
  source: SpatialEntitySource;
  /** Optional raw geometry — passed through untouched. */
  geometry?: unknown;
  /** Classifier hints: feature_type / layer name / service class / etc. */
  attributes?: Record<string, unknown>;
}

export interface ClassifiedSpatialFeature {
  id: string;
  layerId: LayerID;
  geometry?: unknown;
  meta: {
    source: SpatialEntitySource;
    importedAt: number;
    /** Full raw attributes preserved for inspector readouts. */
    rawAttributes?: Record<string, unknown>;
    classification: {
      rule: string;
      confidence: "high" | "medium" | "low";
    };
  };
  userModificationState: "system_imported" | "user_drawn" | "user_edited";
}

const VICMAP_RULES: ReadonlyArray<{
  rule: string;
  match: (a: Record<string, unknown>) => boolean;
  layerId: LayerID;
  confidence: "high" | "medium";
}> = [
  {
    rule: "cadastre boundary kind",
    match: (a) => {
      const kind = String(a.kind ?? a.feature_type ?? "").toLowerCase();
      return (
        kind.includes("boundary") ||
        kind.includes("lot") ||
        kind.includes("parcel") ||
        kind.includes("cadastre")
      );
    },
    layerId: "cadastre.title_boundary",
    confidence: "high",
  },
  {
    rule: "easement kind or easement_type attribute",
    match: (a) =>
      String(a.kind ?? a.feature_type ?? "").toLowerCase().includes("easement") ||
      a.easement_type !== undefined,
    layerId: "vicmap.easement",
    confidence: "high",
  },
  {
    rule: "building kind",
    match: (a) => {
      const kind = String(a.kind ?? a.feature_type ?? "").toLowerCase();
      return kind.includes("building") || kind.includes("structure");
    },
    layerId: "cadastre.building_footprint",
    confidence: "high",
  },
  {
    rule: "utility service class",
    match: (a) => {
      const cls = String(a.service_class ?? a.utility ?? "").toLowerCase();
      return cls.includes("gas") || cls.includes("fuel");
    },
    layerId: "services.gas",
    confidence: "high",
  },
  {
    rule: "overlay kind fallback for state/council GIS",
    match: (a) => {
      const kind = String(a.kind ?? a.feature_type ?? "").toLowerCase();
      return (
        kind.includes("overlay") ||
        kind.includes("planning") ||
        kind.includes("bushfire") ||
        kind.includes("contour")
      );
    },
    layerId: "vicmap.gov_overlay",
    confidence: "medium",
  },
];

/**
 * Map raw Vicmap/state-GIS attributes to a canonical LayerID.
 * Order matters — the first matching rule wins.
 */
export function matchVicmapToLayerId(
  attributes: Record<string, unknown>,
): LayerID {
  for (const r of VICMAP_RULES) {
    if (r.match(attributes)) return r.layerId;
  }
  return "vicmap.gov_overlay";
}

const DXF_LAYER_MAP: Readonly<Record<string, LayerID>> = {
  BOUNDARY: "cadastre.title_boundary",
  LOT: "cadastre.title_boundary",
  BUILDING: "cadastre.building_footprint",
  EASEMENT: "vicmap.easement",
  GAS: "services.gas",
  TRENCH: "civil.trench",
  IRRIGATION: "civil.irrigation_main",
  LIGHTING: "civil.lighting_low_volt",
  PAVING: "hardscape.paving",
  BED: "softscape.planting",
  PLANTING: "softscape.planting",
  DRAFT: "draft.user_draft",
};

function dxfLayerToId(layerName: string): LayerID {
  const key = layerName.trim().toUpperCase();
  return DXF_LAYER_MAP[key] ?? "draft.user_draft";
}

/** Classify a raw Vicmap feature — the canonical ingestion path. */
export function classifyVicmapFeature(raw: {
  id: string;
  geometry?: unknown;
  attributes: Record<string, unknown>;
}): ClassifiedSpatialFeature {
  const layerId = matchVicmapToLayerId(raw.attributes);
  const rule = VICMAP_RULES.find((r) => r.layerId === layerId);
  return {
    id: raw.id,
    layerId,
    geometry: raw.geometry,
    meta: {
      source: "vicmap",
      importedAt: Date.now(),
      rawAttributes: { ...raw.attributes },
      classification: {
        rule: rule?.rule ?? "vicmap fallback (unclassified → gov_overlay)",
        confidence: rule?.confidence ?? "low",
      },
    },
    userModificationState: "system_imported",
  };
}

/**
 * Generic classifier for any spatial input (DXF layers, user strokes, CAD).
 * `layerId` hints are honoured only when they name a registered layer —
 * unknown ids are never trusted.
 */
export function classifySpatialEntity(
  input: SpatialEntityInput,
): ClassifiedSpatialFeature {
  const attributes = input.attributes ?? {};
  let layerId: LayerID;
  let rule: string;
  let confidence: "high" | "medium" | "low";

  if (input.source === "vicmap") {
    layerId = matchVicmapToLayerId(attributes);
    rule = VICMAP_RULES.find((r) => r.layerId === layerId)?.rule ?? "vicmap fallback";
    confidence = VICMAP_RULES.find((r) => r.layerId === layerId)?.confidence ?? "low";
  } else if (input.source === "dxf") {
    const layerName = String(attributes.layer ?? "");
    layerId = dxfLayerToId(layerName);
    rule = `dxf layer name → ${layerId}`;
    confidence = layerName.trim() === "" ? "low" : "high";
  } else if (input.source === "user_stroke") {
    layerId = "draft.user_draft";
    rule = "user stroke → draft.user_draft";
    confidence = "high";
  } else {
    // cad / inferred — try the hint, never trust an unregistered id.
    const hint = String(attributes.layerId ?? "");
    layerId = isRegisteredLayerId(hint) ? hint : "draft.user_draft";
    rule = isRegisteredLayerId(hint)
      ? `explicit registered layerId`
      : `unknown layerId '${hint}' → draft.user_draft fallback`;
    confidence = isRegisteredLayerId(hint) ? "high" : "low";
  }

  return {
    id: input.id,
    layerId,
    geometry: input.geometry,
    meta: {
      source: input.source,
      importedAt: Date.now(),
      rawAttributes: attributes,
      classification: { rule, confidence },
    },
    userModificationState:
      input.source === "user_stroke" ? "user_drawn" : "system_imported",
  };
}

/** Provenance shorthand for a classified entity. */
export function provenanceOf(feature: ClassifiedSpatialFeature): ProvenanceSource {
  return LAYER_SOURCE_TO_PROVENANCE[feature.meta.source];
}

const LAYER_SOURCE_TO_PROVENANCE: Record<SpatialEntitySource, ProvenanceSource> = {
  vicmap: "state_cadastre",
  dxf: "council_gis",
  user_stroke: "user_drawn",
  cad: "user_drawn",
  inferred: "inferred",
};
