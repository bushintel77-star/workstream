export type CanvasViewLayers = {
  titleParcel: boolean;
  draftGrid: boolean;
  orchestrationChips: boolean;
  ghostSuggestions: boolean;
  shade: boolean;
  easements: boolean;
};

export const DEFAULT_CANVAS_VIEW_LAYERS: CanvasViewLayers = {
  titleParcel: true,
  draftGrid: true,
  orchestrationChips: true,
  ghostSuggestions: true,
  shade: false,
  easements: false,
};
