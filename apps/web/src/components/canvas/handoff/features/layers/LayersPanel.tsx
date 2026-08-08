"use client";

import { ITEM_LAYER, type LayerKey, type LayerOpacity } from "../../state/studioTypes";
import type { StudioItem } from "../../studioCatalog";
import kit from "../chromeKit/summonedDock.module.css";
import css from "./layers.module.css";

const LAYERS: Array<{ key: LayerKey; label: string; hint: string }> = [
  { key: "survey", label: "Survey (existing)", hint: "Existing trees, as-built sketches" },
  { key: "boundary", label: "Boundary & hardscape", hint: "Bounds, paving, deck" },
  { key: "council", label: "Council & compliance", hint: "Setbacks, TPZ" },
  { key: "vegetation", label: "Vegetation (proposed)", hint: "Canopy, hedge, beds, lawn" },
  { key: "notes", label: "Notes", hint: "Hand-lettered annotations with leaders" },
];

type Props = {
  open: boolean;
  opacity: LayerOpacity;
  setbackOn: boolean;
  shadeOn: boolean;
  buildableAreaOn: boolean;
  items: StudioItem[];
  noteCount?: number;
  /** Layer keys frozen as survey site context (no opacity slider). */
  lockedLayers?: LayerKey[];
  onClose: () => void;
  onOpacity: (key: LayerKey, value: number) => void;
  onSetback: (on: boolean) => void;
  onShade: (on: boolean) => void;
  onBuildableArea: (on: boolean) => void;
  /** Open the Services ledger (replaces the old services opacity dial). */
  onOpenServices?: () => void;
};

function countFor(
  key: LayerKey,
  items: StudioItem[],
  noteCount = 0,
) {
  if (key === "council") return setbackCountLabel();
  if (key === "notes") return noteCount;
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
  buildableAreaOn,
  items,
  noteCount = 0,
  lockedLayers = [],
  onClose,
  onOpacity,
  onSetback,
  onShade,
  onBuildableArea,
  onOpenServices,
}: Props) {
  if (!open) return null;

  const locked = new Set(lockedLayers);

  return (
    <div
      className={`${kit.dock} ${css.panel}`}
      data-testid="layers-panel"
      role="dialog"
      aria-label="Layers"
    >
      <div className={`${kit.head} ${css.head}`}>
        <h2 className={`${kit.kicker} ${css.kicker}`}>Layers</h2>
        <button
          type="button"
          className={`${kit.close} ${css.close}`}
          onClick={onClose}
          aria-label="Close layers"
        >
          Close
        </button>
      </div>
      {onOpenServices ? (
        <button
          type="button"
          className={css.servicesLink}
          data-testid="layers-open-services"
          onClick={onOpenServices}
        >
          Services ledger — per-feature ticks & focus (not a dial)
        </button>
      ) : null}
      <ul className={css.list}>
        {LAYERS.map((layer) => {
          const count = countFor(layer.key, items, noteCount);
          const frozen = locked.has(layer.key);
          return (
            <li key={layer.key} className={css.row} data-locked={frozen ? "1" : undefined}>
              <div className={css.rowText}>
                <span className={css.label}>
                  {layer.label}
                  <span className={css.count}>{count}</span>
                  {frozen ? (
                    <span className={css.lockedTag} data-testid={`layers-${layer.key}-locked`}>
                      Survey locked
                    </span>
                  ) : null}
                </span>
                <span className={css.hint}>{layer.hint}</span>
              </div>
              {frozen ? (
                <span
                  className={css.frozenOpacity}
                  data-testid={`layers-${layer.key}-frozen-opacity`}
                  aria-label={`${layer.label} opacity locked at ${Math.round(opacity[layer.key] * 100)} percent`}
                >
                  {Math.round(opacity[layer.key] * 100)}%
                </span>
              ) : (
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
              )}
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
      <label className={css.switchRow} data-testid="layers-buildable-area-toggle">
        <span className={css.switchText}>Pin buildable area</span>
        <span className={css.switch} data-on={buildableAreaOn ? "true" : "false"}>
          <input
            type="checkbox"
            className={css.switchInput}
            checked={buildableAreaOn}
            onChange={(e) => onBuildableArea(e.target.checked)}
            aria-label="Buildable area"
          />
          <span className={css.knob} aria-hidden />
        </span>
      </label>
      <p className={css.foot}>
        Compliance pass/fail stays visible regardless of Council opacity. Survey mode
        auto-dims proposed layers. Use the Services ledger for corridors, easements,
        RLs, lighting and trenches — ticks freeze at Quote. Sun mesh is indicative —
        not EnergyPlus.
      </p>
    </div>
  );
}
