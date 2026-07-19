"use client";

import { useEffect, useState } from "react";
import { TOOLS, type StudioTool } from "../../studioCatalog";
import type { LayerKey, LayerOpacity } from "../../state/studioTypes";
import css from "./ambientRibbon.module.css";

type LayerChip = {
  key: LayerKey;
  label: string;
  count: number;
};

type Props = {
  tool: StudioTool;
  locked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  layerChips: LayerChip[];
  layerOpacity: LayerOpacity;
  onTool: (t: StudioTool) => void;
  onMeasure: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (delta: number) => void;
  onFit: () => void;
  onOpacity: (key: LayerKey, value: number) => void;
};

const EDGE_PX = 52;

/**
 * Ambient left ribbon — dormant ultra-low opacity; expands on left-edge proximity.
 * Canvas-first: glyphs + micro counts, no permanent toolbar chrome.
 */
export function AmbientRibbon({
  tool,
  locked,
  canUndo,
  canRedo,
  layerChips,
  layerOpacity,
  onTool,
  onMeasure,
  onUndo,
  onRedo,
  onZoom,
  onFit,
  onOpacity,
}: Props) {
  const [hot, setHot] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setHot(e.clientX <= EDGE_PX);
    };
    const onLeave = () => setHot(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <nav
      className={`${css.ribbon}${hot ? ` ${css.hot}` : ""}`}
      data-testid="ambient-ribbon"
      data-expanded={hot ? "true" : "false"}
      aria-label="Drawing tools"
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
    >
      <div className={css.tools}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${css.btn}${tool === t.id || (t.id === "lock" && locked) ? ` ${css.active}` : ""}`}
            data-testid={`canvas-tool-${t.id}`}
            title={t.label}
            onClick={() => onTool(t.id)}
          >
            <span className={css.glyph}>{t.icon}</span>
            <span className={css.label}>{t.label}</span>
          </button>
        ))}
        <div className={css.div} />
        <button
          type="button"
          className={`${css.btn}${tool === "measure" ? ` ${css.active}` : ""}`}
          data-testid="canvas-tool-measure"
          title="Measure"
          onClick={onMeasure}
        >
          <span className={css.glyph}>⟋</span>
          <span className={css.label}>Measure</span>
        </button>
        <button type="button" className={css.btn} title="Zoom out" onClick={() => onZoom(-0.1)}>
          <span className={css.glyph}>−</span>
        </button>
        <button type="button" className={css.btn} title="Fit" onClick={onFit}>
          <span className={css.glyph}>⛶</span>
          <span className={css.label}>Fit</span>
        </button>
        <button type="button" className={css.btn} title="Zoom in" onClick={() => onZoom(0.1)}>
          <span className={css.glyph}>+</span>
        </button>
        <div className={css.div} />
        <button type="button" className={css.btn} title="Undo" disabled={!canUndo} onClick={onUndo}>
          <span className={css.glyph}>↩</span>
        </button>
        <button type="button" className={css.btn} title="Redo" disabled={!canRedo} onClick={onRedo}>
          <span className={css.glyph}>↪</span>
        </button>
      </div>

      <div className={css.layers} data-testid="ambient-layer-chips">
        {layerChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={css.chip}
            title={`${chip.label} · ${Math.round(layerOpacity[chip.key] * 100)}%`}
            onClick={() => {
              const cur = layerOpacity[chip.key];
              const next = cur < 0.35 ? 1 : cur < 0.7 ? 0.3 : 0.55;
              onOpacity(chip.key, next);
            }}
          >
            <span className={css.chipName}>{chip.label}</span>
            <span className={css.chipCount}>{chip.count}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
