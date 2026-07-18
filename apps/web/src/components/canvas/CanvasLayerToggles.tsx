"use client";

import type { CanvasViewLayers } from "../../lib/canvas-view-layers";
import css from "./canvasLayerToggles.module.css";

type Props = {
  layers: CanvasViewLayers;
  onChange: (next: CanvasViewLayers) => void;
};

const ITEMS: Array<{
  key: keyof CanvasViewLayers;
  label: string;
  hint: string;
}> = [
  { key: "titleParcel", label: "Title parcel", hint: "Vicmap lot ring" },
  { key: "draftGrid", label: "Draft grid", hint: "Layout dots" },
  { key: "orchestrationChips", label: "Risk chips", hint: "TRP / drainage overlays" },
  { key: "ghostSuggestions", label: "AI ghosts", hint: "Unaccepted suggestions" },
  { key: "shade", label: "Sun/shade", hint: "Predicted solar grid" },
  { key: "easements", label: "Easements", hint: "Indicative corridors" },
];

/** Site intelligence layer toggles — canvas chrome, not a separate page. */
export function CanvasLayerToggles({ layers, onChange }: Props) {
  return (
    <div
      className={css.root}
      role="group"
      aria-label="Canvas layers"
      data-testid="canvas-layer-toggles"
    >
      {ITEMS.map((item) => (
        <label key={item.key} className={css.row} title={item.hint}>
          <input
            type="checkbox"
            checked={layers[item.key]}
            onChange={(e) =>
              onChange({ ...layers, [item.key]: e.target.checked })
            }
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}
