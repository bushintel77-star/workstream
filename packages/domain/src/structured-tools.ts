import { toBoardPoint, type LandscapeFeature } from "@workstream/contracts";

export type StructuredToolKind = "ditch" | "path" | "wall" | "bed";

export type StructuredToolProps = {
  width_m: number;
  depth_m: number;
  height_m?: number;
  layer: LandscapeFeature["metadata"]["layer"];
  material_sku: string;
  friendly_name: string;
};

export function defaultStructuredToolProps(
  kind: StructuredToolKind,
): StructuredToolProps {
  switch (kind) {
    case "ditch":
      return {
        width_m: 0.3,
        depth_m: 0.45,
        layer: "hardscape",
        material_sku: "DRAIN-AG",
        friendly_name: "French drain / ditch",
      };
    case "path":
      return {
        width_m: 1.2,
        depth_m: 0.075,
        layer: "hardscape",
        material_sku: "PAVE-BLUESTONE",
        friendly_name: "Path",
      };
    case "wall":
      return {
        width_m: 0.25,
        depth_m: 0.4,
        height_m: 0.9,
        layer: "structure",
        material_sku: "WALL-BLOCK",
        friendly_name: "Retaining wall",
      };
    case "bed":
      return {
        width_m: 0,
        depth_m: 0.15,
        layer: "softscape_beds",
        material_sku: "MULCH-ORG",
        friendly_name: "Planting bed",
      };
  }
}

export function buildLandscapeFeatureFromStroke(args: {
  kind: StructuredToolKind;
  points: Array<{ x_pct: number; y_pct: number }>;
  id?: string;
  now?: string;
  /**
   * Elevation of the base plane (metres above grade) the converted feature
   * sits on — the depth-rail Z-plane from the Tidy routing (e.g. +4.0 for
   * massing, +1.5 for planting). Stored as `plane_z_m`: the feature's
   * geometry is positioned at that elevation, but it is NOT a cut/fill pad
   * (that is what `extrude_height_m` means, and overloading it would make a
   * planting bed render as an earthworks mass). Absent/0 = on grade
   * (backward-compatible).
   */
  planeZ?: number;
  /**
   * Emit a CLOSED Polygon instead of the kind's default LineString. Phase 4
   * seam: a wall drawn as a closed outline on a standing canvas lands as a
   * plan footprint — a ring, not a zero-width line (the drawn outline IS the
   * wall's thickness; inventing one would be fake precision).
   */
  closed?: boolean;
}): LandscapeFeature {
  const props = defaultStructuredToolProps(args.kind);
  const id = args.id ?? crypto.randomUUID();
  const now = args.now ?? new Date().toISOString();
  /*
   * Feature geometry is board-bounded by contract, while stroke points are not
   * — ink drawn on the context ground beyond the board is legal. Landing the
   * ink on the board is therefore mandatory here, not optional: without it the
   * feature fails validation and every autosave of the whole canvas is
   * rejected (2026-08-22).
   */
  const pts = args.points.map((p, i) => ({
    id: `${id}-v${i}`,
    pct: toBoardPoint(p),
  }));

  const isBed = args.kind === "bed";
  const isClosed = args.closed === true;
  let points = pts;
  if ((isBed || isClosed) && points.length >= 3) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    if (
      first.pct.x_pct !== last.pct.x_pct ||
      first.pct.y_pct !== last.pct.y_pct
    ) {
      points = [
        ...points,
        { id: `${id}-close`, pct: { ...first.pct } },
      ];
    }
  }

  const dimNote =
    args.kind === "bed"
      ? `${props.depth_m} m depth`
      : `${props.width_m} m × ${props.depth_m} m` +
      (props.height_m != null ? ` × ${props.height_m} m h` : "");

  return {
    id,
    type: "LandscapeFeature",
    metadata: {
      layer: props.layer,
      friendly_name: `${props.friendly_name} (${dimNote})`,
      timestamp_created: now,
      source_attribution: "human_drawn",
      user_modification_state: "draft",
    },
    geometry: {
      type: isBed || isClosed ? "Polygon" : "LineString",
      spatial_reference: "EPSG:3857",
      canvas_origin_pct: { x_pct: 0, y_pct: 0 },
      points,
    },
    material_fill: {
      type: isBed ? "volumetric_surface" : "surface",
      sku: props.material_sku,
      depth_m: props.depth_m,
      waste_allocation_pct: 10,
    },
    labor_profile: {
      base_difficulty_tier: "standard_soil",
      estimated_install_hours: Math.max(0.5, points.length * 0.35),
      calculated_labor_cost_aud: 0,
    },
    ...(args.planeZ != null && args.planeZ > 0
      ? { plane_z_m: args.planeZ }
      : {}),
  };
}
