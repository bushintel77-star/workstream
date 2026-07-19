export type CanvasLayerOpacity = {
  survey: number;
  boundary: number;
  council: number;
  vegetation: number;
};

export const DEFAULT_LAYER_OPACITY: CanvasLayerOpacity = {
  survey: 0.2,
  boundary: 1,
  council: 1,
  vegetation: 1,
};

export const SURVEY_LAYER_PRESET: CanvasLayerOpacity = {
  survey: 1,
  boundary: 1,
  council: 0.15,
  vegetation: 0.15,
};

export type CanvasLayerBucket = keyof CanvasLayerOpacity;

export const LAYER_BUCKET_LABELS: Record<
  CanvasLayerBucket,
  { label: string; hint: string }
> = {
  survey: {
    label: "Survey (existing)",
    hint: "Existing trees, site sketches",
  },
  boundary: {
    label: "Boundary & hardscape",
    hint: "Traces, paving, decks, drainage",
  },
  council: {
    label: "Council & compliance",
    hint: "Setback ring, TPZ circles",
  },
  vegetation: {
    label: "Vegetation (proposed)",
    hint: "New planting, lawn, beds",
  },
};
