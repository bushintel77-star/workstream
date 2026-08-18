/**
 * Domain Layer Registry — the single immutable source of truth for how
 * spatial entities are styled and governed.
 *
 * Every rendered spatial entity points (or is classified) to a `LayerID`
 * defined here. The registry carries:
 *
 *   - style: token-allowlisted color, metric dash array (world units),
 *     line width, opacity, and a DETERMINISTIC y-offset (metres) used as
 *     the surface clearance when the line is draped — no ad-hoc lifts.
 *   - policies: boundary-constraint status (drives asset clamping),
 *     dig-safety flag (drives `strike_alert` cross-layer checks), and
 *     select/lock affordances.
 *
 * Y-bias ladder (all values distinct — the documented z-fight pairs from
 * the depth audit, e.g. trench ∩ easements at y=0.05, are separated here):
 *
 *   0.020 draft.user_draft             (sketch ink)
 *   0.025 hardscape.paving             (paving/deck linework)
 *   0.028 cadastre.building_footprint  (footprint hairline)
 *   0.030 softscape.planting           (bed/planting linework)
 *   0.040 services.gas                 (utility corridor)
 *   0.050 civil.trench                 (drainage trench)
 *   0.055 vicmap.easement              (servitude — clears trench at 0.050)
 *   0.060 cadastre.title_boundary      (truth anchor — highest survey line)
 *   0.070 vicmap.gov_overlay           (keyless overlay rings)
 *   0.072 civil.irrigation_main        (zone stroke)
 *   0.075 civil.lighting_low_volt      (fixture runs)
 *
 * Renders read via getLayerStyle(layerId) — hardcoded hex in components is
 * the failure mode this registry exists to remove.
 */

export const LAYER_GROUPS = [
  "survey",
  "underground",
  "hardscape",
  "softscape",
  "draft",
] as const;
export type LayerGroup = (typeof LAYER_GROUPS)[number];

export const LAYER_IDS = [
  "cadastre.title_boundary",
  "cadastre.building_footprint",
  "vicmap.easement",
  "vicmap.gov_overlay",
  "services.gas",
  "civil.trench",
  "civil.irrigation_main",
  "civil.lighting_low_volt",
  "hardscape.paving",
  "softscape.planting",
  "draft.user_draft",
] as const;
export type LayerID = (typeof LAYER_IDS)[number];

export type ProvenanceSource =
  | "state_cadastre"
  | "council_gis"
  | "user_drawn"
  | "inferred";

export interface LayerStyle {
  /** Hex color — token-allowlisted (Studio Paper / drafting family). */
  color: string;
  /** Metric dash pattern [dash, gap] in world metres; undefined = solid. */
  dashArray?: readonly [number, number];
  lineWidthPx: number;
  opacity: number;
  /** Deterministic surface clearance (metres) — the y-bias for draping. */
  yOffsetMeters: number;
}

export interface LayerPolicies {
  /** Drives asset clamping — geometry that is a boundary constraint. */
  isBoundaryConstraint: boolean;
  /** Crossing this layer with a trench/footings raises strike_alert. */
  triggersDigSafetyAlert: boolean;
  selectable: boolean;
  lockable: boolean;
}

export interface LayerDefinition {
  id: LayerID;
  group: LayerGroup;
  displayName: string;
  provenanceSource: ProvenanceSource;
  style: LayerStyle;
  policies: LayerPolicies;
}

/** Immutable registry — never mutate at runtime. */
export const LAYER_REGISTRY: Readonly<Record<LayerID, LayerDefinition>> = {
  "cadastre.title_boundary": {
    id: "cadastre.title_boundary",
    group: "survey",
    displayName: "Title boundary",
    provenanceSource: "state_cadastre",
    style: {
      color: "#0030CF", // --gs-truth data stroke (8.22:1 on paper)
      lineWidthPx: 2.5,
      opacity: 1,
      yOffsetMeters: 0.06,
    },
    policies: {
      isBoundaryConstraint: true,
      triggersDigSafetyAlert: false,
      selectable: true,
      lockable: true,
    },
  },
  "cadastre.building_footprint": {
    id: "cadastre.building_footprint",
    group: "survey",
    displayName: "Building footprint",
    provenanceSource: "state_cadastre",
    style: {
      color: "#262626", // --gs-ink-strong family (surveyor hairline)
      lineWidthPx: 1.5,
      opacity: 1,
      yOffsetMeters: 0.028,
    },
    policies: {
      isBoundaryConstraint: true,
      triggersDigSafetyAlert: false,
      selectable: true,
      lockable: true,
    },
  },
  "vicmap.easement": {
    id: "vicmap.easement",
    group: "survey",
    displayName: "Vicmap easement",
    provenanceSource: "council_gis",
    style: {
      color: "#2450C7", // cobalt L600 — the designed easement stroke, distinct
      dashArray: [0.4, 0.3],
      lineWidthPx: 1,
      opacity: 0.5,
      yOffsetMeters: 0.055, // clears civil.trench at 0.050 (was a z-fight pair)
    },
    policies: {
      isBoundaryConstraint: false,
      triggersDigSafetyAlert: true,
      selectable: true,
      lockable: true,
    },
  },
  "vicmap.gov_overlay": {
    id: "vicmap.gov_overlay",
    group: "survey",
    displayName: "Government overlay",
    provenanceSource: "council_gis",
    style: {
      color: "#8A9BB5", // sky-cool (per-kind overlay hues apply at render)
      dashArray: [0.32, 0.2],
      lineWidthPx: 1.5,
      opacity: 0.85,
      yOffsetMeters: 0.07,
    },
    policies: {
      isBoundaryConstraint: false,
      triggersDigSafetyAlert: false,
      selectable: false,
      lockable: true,
    },
  },
  "services.gas": {
    id: "services.gas",
    group: "underground",
    displayName: "Gas service",
    provenanceSource: "council_gis",
    style: {
      color: "#E8B000", // APWA gas
      dashArray: [0.3, 0.25],
      lineWidthPx: 1.5,
      opacity: 0.9,
      yOffsetMeters: 0.04,
    },
    policies: {
      isBoundaryConstraint: false,
      triggersDigSafetyAlert: true,
      selectable: true,
      lockable: true,
    },
  },
  "civil.trench": {
    id: "civil.trench",
    group: "underground",
    displayName: "Construction trench",
    provenanceSource: "user_drawn",
    style: {
      color: "#2E86AB", // water L500 — the drainage-trench stroke identity
      dashArray: [2.4, 0.7],
      lineWidthPx: 1.5,
      opacity: 0.9,
      yOffsetMeters: 0.05,
    },
    policies: {
      isBoundaryConstraint: false,
      triggersDigSafetyAlert: false, // the digger, not the hazard
      selectable: true,
      lockable: true,
    },
  },
  "civil.irrigation_main": {
    id: "civil.irrigation_main",
    group: "underground",
    displayName: "Irrigation main",
    provenanceSource: "user_drawn",
    style: {
      color: "#4FA3D1", // drafting blue — irrigation/water family
      dashArray: [0.5, 0.35],
      lineWidthPx: 1.5,
      opacity: 0.85,
      yOffsetMeters: 0.072,
    },
    policies: {
      isBoundaryConstraint: false,
      triggersDigSafetyAlert: false,
      selectable: true,
      lockable: true,
    },
  },
  "civil.lighting_low_volt": {
    id: "civil.lighting_low_volt",
    group: "underground",
    displayName: "Low-voltage lighting",
    provenanceSource: "user_drawn",
    style: {
      color: "#9AA0AC", // gray L500 — the lighting-conduit stroke identity
      dashArray: [1.6, 0.8],
      lineWidthPx: 1,
      opacity: 0.85,
      yOffsetMeters: 0.075,
    },
    policies: {
      isBoundaryConstraint: false,
      triggersDigSafetyAlert: false,
      selectable: true,
      lockable: true,
    },
  },
  "hardscape.paving": {
    id: "hardscape.paving",
    group: "hardscape",
    displayName: "Paving / hardscape",
    provenanceSource: "user_drawn",
    style: {
      color: "#1A1A1A", // --gs-ink
      lineWidthPx: 1.5,
      opacity: 1,
      yOffsetMeters: 0.025,
    },
    policies: {
      isBoundaryConstraint: false,
      triggersDigSafetyAlert: false,
      selectable: true,
      lockable: true,
    },
  },
  "softscape.planting": {
    id: "softscape.planting",
    group: "softscape",
    displayName: "Planting bed",
    provenanceSource: "user_drawn",
    style: {
      color: "#4C9662", // summer green — softscape family
      lineWidthPx: 1.5,
      opacity: 0.9,
      yOffsetMeters: 0.03,
    },
    policies: {
      isBoundaryConstraint: false,
      triggersDigSafetyAlert: false,
      selectable: true,
      lockable: true,
    },
  },
  "draft.user_draft": {
    id: "draft.user_draft",
    group: "draft",
    displayName: "User draft",
    provenanceSource: "user_drawn",
    style: {
      color: "#FF2EF6", // sketch ink (CanvasStroke default)
      lineWidthPx: 2,
      opacity: 0.85,
      yOffsetMeters: 0.02,
    },
    policies: {
      isBoundaryConstraint: false,
      triggersDigSafetyAlert: false,
      selectable: true,
      lockable: false,
    },
  },
};

export function getLayerDefinition(id: LayerID): LayerDefinition {
  return LAYER_REGISTRY[id];
}

export function getLayerStyle(id: LayerID): LayerStyle {
  return LAYER_REGISTRY[id].style;
}

/** The registry y-bias — the deterministic surface clearance for draping. */
export function layerYOffset(id: LayerID): number {
  return LAYER_REGISTRY[id].style.yOffsetMeters;
}

export function isBoundaryConstraintLayer(id: LayerID): boolean {
  return LAYER_REGISTRY[id].policies.isBoundaryConstraint;
}

export function layerTriggersDigSafety(id: LayerID): boolean {
  return LAYER_REGISTRY[id].policies.triggersDigSafetyAlert;
}

/** Every registered layer id — used by the classifier to validate mappings. */
export function isRegisteredLayerId(value: string): value is LayerID {
  return (LAYER_IDS as readonly string[]).includes(value);
}
