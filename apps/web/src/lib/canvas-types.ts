/** Client-safe types for the canvas-first UI (no server-only imports). */

/** Subset of CadEntity fields needed for clay walk + dock counts. */
export type CadEntityLite = {
  id: string;
  ghost: boolean;
  /** Prefer over ghost when present (UNVERIFIED = AI suggestion). */
  verification_state?: "UNVERIFIED" | "VERIFIED";
  kind?: string;
  layer?: string;
  points?: Array<{ x: number; y: number }>;
  closed?: boolean;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  position?: { x: number; y: number };
  center?: { x: number; y: number };
  block_name?: string;
};

export type CadDocumentLite = {
  id: string;
  project_id: string;
  width_m: number;
  height_m: number;
  entities: CadEntityLite[];
};

export type CadApiResultLite = {
  document: CadDocumentLite | null;
  svg: string | null;
  ghost_count: number;
  rationale?: string;
};

export type CadQuantitySurveyApi = {
  project_id: string;
  committed_only: boolean;
  rows: Array<{
    id: string;
    entity_id: string;
    layer: string;
    kind: string;
    label: string;
    qty: number;
    unit: "m2" | "lm" | "ea";
    anchor: { x: number; y: number };
    ghost: boolean;
  }>;
  totals: {
    hardscape_m2: number;
    planting_ea: number;
    irrigation_lm: number;
    structure_m2: number;
    other_m2: number;
    other_lm: number;
    other_ea: number;
  };
};

export type CadBuildApi = {
  survey: CadQuantitySurveyApi;
  line_items: Array<{
    sku: string;
    label: string;
    unit: string;
    qty: number;
    rate: number;
    total: number;
    notes?: string;
    is_provisional?: boolean;
  }>;
  scenario: "lean" | "standard" | "buffer";
  subtotal: number;
  contingency: number;
  gst: number;
  total: number;
};

export type BoundaryVertexLite = {
  vertex_id: string;
  sequence_index: number;
  source: "AI_GENERATED" | "HUMAN_EDITED" | "HUMAN_ADDED" | "GIS_PARCEL";
  is_locked: boolean;
  canvas_coords: { x: number; y: number };
  geo_coords: { lng: number; lat: number };
  is_master_reference?: boolean;
};

export type SiteBoundaryLite = {
  id: string;
  project_id: string;
  layer_id: string;
  status: "UNVERIFIED" | "VERIFIED";
  source_kind: "vicmap" | "geojson_ingest" | "ai_trace" | "manual";
  width_m: number;
  height_m: number;
  geo_reference: {
    crs: "EPSG:4326";
    canvas_origin_geo: { lng: number; lat: number };
    metres_per_canvas_unit: 1;
  };
  calculated_metrics: {
    total_area_m2: number;
    perimeter_m: number;
    ai_confidence: number | null;
  };
  vertices: BoundaryVertexLite[];
  updated_at: string;
};
