"use client";

import type { CatalogPlacement, CatalogSymbol } from "../../lib/api";
import { DesignAssetGlyph } from "./DesignAssetGlyph";
import s from "../designStudio.module.css";

type Props = {
  placement: CatalogPlacement;
  symbol: CatalogSymbol;
  selected: boolean;
  isTpz: boolean;
  indicativeMetres: number | null;
  onSelect: () => void;
  onMoveStart: (e: React.PointerEvent) => void;
  onRotateStart: (e: React.PointerEvent) => void;
  onScaleStart: (e: React.PointerEvent) => void;
  onDelete: () => void;
};

export function DesignCanvasPlacement({
  placement,
  symbol,
  selected,
  isTpz,
  indicativeMetres,
  onSelect,
  onMoveStart,
  onRotateStart,
  onScaleStart,
  onDelete,
}: Props) {
  return (
    <div
      className={`${s.placed} ${selected ? s.placedSelected : ""} ${isTpz ? s.placedTpz : ""}`}
      style={{
        left: `${placement.x_pct}%`,
        top: `${placement.y_pct}%`,
        transform: `translate(-50%, -50%) rotate(${placement.rotation_deg}deg) scale(${placement.scale})`,
      }}
      data-testid="canvas-placement"
      data-placement-id={placement.id}
      role="button"
      tabIndex={0}
      aria-label={`${symbol.label}, placed on plan`}
      aria-pressed={selected}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
        onMoveStart(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <DesignAssetGlyph symbol={symbol} size="pin" />
      {selected ? (
        <div className={s.selectionRing} aria-hidden>
          <button
            type="button"
            className={`${s.selectionHandle} ${s.handleRotate}`}
            aria-label={`Rotate ${symbol.label}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              onRotateStart(e);
            }}
          />
          <button
            type="button"
            className={`${s.selectionHandle} ${s.handleScale}`}
            aria-label={`Scale ${symbol.label}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              onScaleStart(e);
            }}
          />
          <button
            type="button"
            className={s.selectionDelete}
            aria-label={`Remove ${symbol.label}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            ×
          </button>
          {isTpz && indicativeMetres != null ? (
            <span className={s.tpzReadout}>
              ~{indicativeMetres} m indicative only
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
