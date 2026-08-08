import type { LayerKey } from "./studioTypes";

export const ISOLATE_DIM_OPACITY = 0.15;

export const LAYER_LABEL: Record<LayerKey, string> = {
  survey: "Survey",
  boundary: "Hardscape",
  council: "Compliance",
  vegetation: "Planting",
  services: "Services",
  notes: "Notes",
};

export function resolveLayerVisual(
  layer: LayerKey,
  layerOpacity: number,
  isolatedLayer: LayerKey | null,
): { opacity: number; hittable: boolean } {
  if (isolatedLayer == null || isolatedLayer === layer) {
    return { opacity: layerOpacity, hittable: true };
  }
  return { opacity: ISOLATE_DIM_OPACITY, hittable: false };
}
