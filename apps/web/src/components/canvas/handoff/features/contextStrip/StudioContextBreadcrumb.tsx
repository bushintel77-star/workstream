"use client";

import type { GrowthStage, LayerKey, LayerOpacity } from "../../state/studioTypes";
import { LAYER_LABEL } from "../../state/layerIsolate";
import type { StudioMode } from "../../studioCatalog";
import css from "./contextStrip.module.css";

type Props = {
  mode: StudioMode;
  isolatedLayer: LayerKey | null;
  layerOpacity: LayerOpacity;
  setbackOn: boolean;
  shadeOn: boolean;
  growth: GrowthStage;
  onClearIsolation: () => void;
  onClearSetback: () => void;
  onClearShade: () => void;
  onResetGrowth: () => void;
  onResetLayer: (layer: LayerKey) => void;
};

const LAYERS = Object.keys(LAYER_LABEL) as LayerKey[];

export function StudioContextBreadcrumb({
  mode,
  isolatedLayer,
  layerOpacity,
  setbackOn,
  shadeOn,
  growth,
  onClearIsolation,
  onClearSetback,
  onClearShade,
  onResetGrowth,
  onResetLayer,
}: Props) {
  const dimmedLayers = LAYERS.filter((layer) => layerOpacity[layer] < 0.95);
  return (
    <nav className={css.root} data-testid="studio-context-breadcrumb" aria-label="Canvas state">
      <span className={css.mode}>{mode.toUpperCase()}</span>
      {dimmedLayers.map((layer) => (
        <button
          key={layer}
          type="button"
          className={css.segment}
          onClick={() => onResetLayer(layer)}
          aria-label={`Reset ${LAYER_LABEL[layer]} opacity`}
        >
          {LAYER_LABEL[layer]} {Math.round(layerOpacity[layer] * 100)}%
          <span aria-hidden>×</span>
        </button>
      ))}
      {setbackOn ? (
        <button type="button" className={css.segment} onClick={onClearSetback}>
          Compliance on <span aria-hidden>×</span>
        </button>
      ) : null}
      {shadeOn ? (
        <button type="button" className={css.segment} onClick={onClearShade}>
          Shade on <span aria-hidden>×</span>
        </button>
      ) : null}
      {growth !== "mature" ? (
        <button type="button" className={css.segment} onClick={onResetGrowth}>
          Growth: {growth === "plant" ? "Plant" : "5 yr"} <span aria-hidden>×</span>
        </button>
      ) : null}
      {isolatedLayer ? (
        <button
          type="button"
          className={`${css.segment} ${css.isolated}`}
          onClick={onClearIsolation}
        >
          Isolated: {LAYER_LABEL[isolatedLayer]} <span aria-hidden>×</span>
        </button>
      ) : null}
    </nav>
  );
}
