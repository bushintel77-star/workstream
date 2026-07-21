"use client";

import { ITEM_LAYER, type LayerKey, type LayerOpacity } from "../../state/studioTypes";
import type { StudioItem } from "../../studioCatalog";
import css from "./layers.module.css";

const LAYERS: Array<{ key: LayerKey; label: string; hint: string }> = [
  { key: "survey", label: "Survey (existing)", hint: "Existing trees, as-built sketches" },
  { key: "boundary", label: "Boundary & hardscape", hint: "Bounds, paving, deck" },
  {
    key: "services",
    label: "Services & utilities",
    hint: "Drainage, service corridors, easements, RL levels",
  },
  { key: "council", label: "Council & compliance", hint: "Setbacks, TPZ" },
  { key: "vegetation", label: "Vegetation (proposed)", hint: "Canopy, hedge, beds, lawn" },
];

type Props = {
  open: boolean;
  opacity: LayerOpacity;
  setbackOn: boolean;
  shadeOn: boolean;
  items: StudioItem[];
  onClose: () => void;
  onOpacity: (key: LayerKey, value: number) => void;
  onSetback: (on: boolean) => void;
  onShade: (on: boolean) => void;
};

function countFor(key: LayerKey, items: StudioItem[]) {
  if (key === "council") return setbackCountLabel();
  return items.filter((i) => ITEM_LAYER[i.t] === key).length;
}

function setbackCountLabel() {
  return 2; // setback ring + TPZ — geometric overlays
}

export function LayersPanel({
  open,
  opacity,
  setbackOn,
  shadeOn,
  items,
  onClose,
  onOpacity,
  onSetback,
  onShade,
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
        {LAYERS.map((layer) => {
          const count = countFor(layer.key, items);
          return (
            <li key={layer.key} className={css.row}>
              <div className={css.rowText}>
                <span className={css.label}>
                  {layer.label}
                  <span className={css.count}>{count}</span>
                </span>
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
          );
        })}
      </ul>
      <label className={css.switchRow}>
        <span className={css.switchText}>Setback overlays</span>
        <span className={css.switch} data-on={setbackOn ? "true" : "false"}>
          <input
            type="checkbox"
            className={css.switchInput}
            checked={setbackOn}
            onChange={(e) => onSetback(e.target.checked)}
          />
          <span className={css.knob} aria-hidden />
        </span>
      </label>
      <label className={css.switchRow} data-testid="layers-shade-toggle">
        <span className={css.switchText}>Sun/shade mesh</span>
        <span className={css.switch} data-on={shadeOn ? "true" : "false"}>
          <input
            type="checkbox"
            className={css.switchInput}
            checked={shadeOn}
            onChange={(e) => onShade(e.target.checked)}
            aria-label="Sun/shade"
          />
          <span className={css.knob} aria-hidden />
        </span>
      </label>
      <p className={css.foot}>
        Compliance pass/fail stays visible regardless of Council opacity. Survey mode
        auto-dims proposed layers. Sun mesh is indicative — not EnergyPlus.
      </p>
    </div>
  );
}
