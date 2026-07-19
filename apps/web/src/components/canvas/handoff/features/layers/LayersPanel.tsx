"use client";

import type { LayerKey, LayerOpacity } from "../../state/studioTypes";
import css from "./layers.module.css";

const LAYERS: Array<{ key: LayerKey; label: string; hint: string }> = [
  { key: "survey", label: "Survey & existing", hint: "Title, existing trees, as-built" },
  { key: "boundary", label: "Boundary & hardscape", hint: "Title bounds, paving, deck" },
  { key: "council", label: "Council & setbacks", hint: "Overlays, easements, setback lines" },
  { key: "vegetation", label: "Vegetation", hint: "Canopy, hedge, beds, lawn" },
];

type Props = {
  open: boolean;
  opacity: LayerOpacity;
  setbackOn: boolean;
  onClose: () => void;
  onOpacity: (key: LayerKey, value: number) => void;
  onSetback: (on: boolean) => void;
};

export function LayersPanel({
  open,
  opacity,
  setbackOn,
  onClose,
  onOpacity,
  onSetback,
}: Props) {
  if (!open) return null;

  return (
    <div className={css.panel} data-testid="layers-panel" role="dialog" aria-label="Layers">
      <div className={css.head}>
        <p className={css.kicker}>Layers</p>
        <button type="button" className={css.close} onClick={onClose} aria-label="Close layers">
          Close
        </button>
      </div>
      <ul className={css.list}>
        {LAYERS.map((layer) => (
          <li key={layer.key} className={css.row}>
            <div className={css.rowText}>
              <span className={css.label}>{layer.label}</span>
              <span className={css.hint}>{layer.hint}</span>
            </div>
            <label className={css.sliderLabel}>
              <span className={css.pct}>{Math.round(opacity[layer.key] * 100)}%</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(opacity[layer.key] * 100)}
                onChange={(e) => onOpacity(layer.key, Number(e.target.value) / 100)}
                aria-label={`${layer.label} opacity`}
              />
            </label>
          </li>
        ))}
      </ul>
      <label className={css.toggle}>
        <input
          type="checkbox"
          checked={setbackOn}
          onChange={(e) => onSetback(e.target.checked)}
        />
        <span>Show setback overlays</span>
      </label>
      <p className={css.foot}>
        Survey mode dims design layers; leaving survey restores the design preset.
      </p>
    </div>
  );
}
