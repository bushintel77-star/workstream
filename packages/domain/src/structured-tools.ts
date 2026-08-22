import type { LandscapeFeature } from "@workstream/contracts";

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

/**
 * Feature geometry is board-bounded by contract (`CanvasPctPointSchema` is
 * 0-100), while stroke points are not (`CanvasPointPctSchema` is unbounded —
 * ink drawn on the context ground beyond the board is legal). Ink converted
 * into a feature therefore clamps to the board edge, the same convention every
 * other feature writer uses (`draftShape.ts` toFeaturePoint, `sketchCad.ts`
 * clampPct). Without it the feature fails validation and every autosave of the
 * whole canvas is rejected.
 */
function clampToBoard(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export function buildLandscapeFeatureFromStroke(args: {
  kind: StructuredToolKind;
  points: Array<{ x_pct: number; y_pct: number }>;
  id?: string;
  now?: string;
}): LandscapeFeature {
  const props = defaultStructuredToolProps(args.kind);
  const id = args.id ?? crypto.randomUUID();
  const now = args.now ?? new Date().toISOString();
  const pts = args.points.map((p, i) => ({
    id: `${id}-v${i}`,
    pct: { x_pct: clampToBoard(p.x_pct), y_pct: clampToBoard(p.y_pct) },
  }));

  const isBed = args.kind === "bed";
  let points = pts;
  if (isBed && points.length >= 3) {
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
      type: isBed ? "Polygon" : "LineString",
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
  };
}
