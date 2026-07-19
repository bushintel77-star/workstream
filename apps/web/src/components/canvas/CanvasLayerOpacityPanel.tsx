"use client";

import type { CanvasViewLayers } from "../../lib/canvas-view-layers";
import {
  LAYER_BUCKET_LABELS,
  type CanvasLayerBucket,
  type CanvasLayerOpacity,
} from "../../lib/canvas-layer-opacity";
import css from "./canvasLayerOpacity.module.css";

type Props = {
  opacity: CanvasLayerOpacity;
  onOpacityChange: (next: CanvasLayerOpacity) => void;
  counts?: Partial<Record<CanvasLayerBucket, number>>;
  viewLayers?: CanvasViewLayers;
  onViewLayersChange?: (next: CanvasViewLayers) => void;
};

const OVERLAY_TOGGLES: Array<{
  key: keyof CanvasViewLayers;
  label: string;
}> = [
  { key: "titleParcel", label: "Title parcel" },
  { key: "draftGrid", label: "Draft grid" },
  { key: "ghostSuggestions", label: "AI ghosts" },
  { key: "shade", label: "Sun/shade" },
  { key: "easements", label: "Easements" },
  { key: "setback", label: "1.5 m setback" },
];

export function CanvasLayerOpacityPanel({
  opacity,
  onOpacityChange,
  counts = {},
  viewLayers,
  onViewLayersChange,
}: Props) {
  const buckets = Object.keys(LAYER_BUCKET_LABELS) as CanvasLayerBucket[];

  return (
    <div className={css.root} data-testid="canvas-layer-opacity">
      {buckets.map((key) => {
        const pct = Math.round(opacity[key] * 100);
        return (
          <div key={key} className={css.row}>
            <span className={css.label}>
              {LAYER_BUCKET_LABELS[key].label}
              {counts[key] != null ? ` (${counts[key]})` : ""}
            </span>
            <span className={css.pct}>{pct}%</span>
            <p className={css.hint}>{LAYER_BUCKET_LABELS[key].hint}</p>
            <input
              type="range"
              className={css.slider}
              min={0}
              max={100}
              value={pct}
              aria-label={`${LAYER_BUCKET_LABELS[key].label} opacity`}
              onChange={(e) => {
                const nextPct = Number(e.target.value);
                onOpacityChange({
                  ...opacity,
                  [key]: nextPct / 100,
                });
              }}
            />
          </div>
        );
      })}

      {viewLayers && onViewLayersChange ? (
        <>
          <div className={css.divider} />
          <p className={css.overlaysTitle}>Overlays</p>
          {OVERLAY_TOGGLES.map((item) => (
            <label key={item.key} className={css.toggleRow}>
              <input
                type="checkbox"
                checked={viewLayers[item.key]}
                onChange={(e) =>
                  onViewLayersChange({
                    ...viewLayers,
                    [item.key]: e.target.checked,
                  })
                }
              />
              <span>{item.label}</span>
            </label>
          ))}
        </>
      ) : null}
    </div>
  );
}
