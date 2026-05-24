"use client";

import { useMemo, useState } from "react";
import {
  generateStaggeredPlacements,
  massPlantSummary,
  type CanvasGroundScale,
} from "@workstream/domain";
import type { CanvasPointPct, CatalogPlacement, CatalogSymbol } from "@workstream/contracts";
import s from "./studioPanel.module.css";

type Props = {
  symbols: CatalogSymbol[];
  polygonPoints: CanvasPointPct[];
  polygonClosed: boolean;
  isDrawing: boolean;
  spacingCm: number;
  scale: CanvasGroundScale;
  onSpacingChange: (cm: number) => void;
  onStartDraw: () => void;
  onFinishPolygon: () => void;
  onClear: () => void;
  onFill: (placements: CatalogPlacement[]) => void;
};

export function StudioMassPlantPanel({
  symbols,
  polygonPoints,
  polygonClosed,
  isDrawing,
  spacingCm,
  scale,
  onSpacingChange,
  onStartDraw,
  onFinishPolygon,
  onClear,
  onFill,
}: Props) {
  const plantingSymbols = useMemo(
    () => symbols.filter((sym) => sym.category === "planting"),
    [symbols],
  );

  const [symbolId, setSymbolId] = useState(
    plantingSymbols[0]?.id ?? "lomandra-mass",
  );

  const summary = useMemo(() => {
    if (!polygonClosed || polygonPoints.length < 3) {
      return { areaM2: 0, plantCount: 0 };
    }
    return massPlantSummary(polygonPoints, spacingCm, scale);
  }, [polygonClosed, polygonPoints, spacingCm, scale]);

  function handleFill() {
    if (!polygonClosed || polygonPoints.length < 3) return;
    onFill(generateStaggeredPlacements(polygonPoints, symbolId, spacingCm, scale));
  }

  return (
    <div className={`${s.panel} ${s.panelRail}`} data-testid="studio-massplant-panel">
      <h3 className={s.panelTitle}>Mass plant</h3>
      <div className={s.row}>
        <label className={s.label}>
          Plant
          <select
            className={s.select}
            value={symbolId}
            onChange={(e) => setSymbolId(e.target.value)}
          >
            {plantingSymbols.map((sym) => (
              <option key={sym.id} value={sym.id}>
                {sym.label}
              </option>
            ))}
          </select>
        </label>
        <label className={s.label}>
          Spacing (cm)
          <input
            type="number"
            className={s.input}
            min={10}
            step={5}
            value={spacingCm}
            onChange={(e) => onSpacingChange(Number(e.target.value) || 45)}
          />
        </label>
      </div>
      <div className={s.stats}>
        <div className={s.metricGrid}>
          <div className={s.metricCard}>
            <span className={s.metricCardLabel}>Bed area</span>
            <span className={s.metricCardValue}>{summary.areaM2.toFixed(2)}</span>
            <span className={s.metricCardUnit}>m² indicative</span>
          </div>
          <div className={s.metricCard}>
            <span className={s.metricCardLabel}>Plants needed</span>
            <span className={s.metricCardValue}>{summary.plantCount}</span>
            <span className={s.metricCardUnit}>staggered grid</span>
          </div>
        </div>
        <span className={s.hint}>Confirm spacing on site before ordering</span>
      </div>
      <div className={s.actions}>
        <button
          type="button"
          className={s.btn}
          onClick={isDrawing ? onFinishPolygon : onStartDraw}
        >
          {isDrawing ? "Finish bed" : "Draw bed"}
        </button>
        <button type="button" className={s.btn} disabled={!polygonClosed} onClick={handleFill}>
          Fill area
        </button>
        <button type="button" className={s.btn} onClick={onClear}>
          Clear
        </button>
      </div>
      <p className={s.panelHint}>Tap aerial to outline bed. Finish when done.</p>
    </div>
  );
}
