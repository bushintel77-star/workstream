"use client";

import { useRef } from "react";
import type { CatalogPlacement, CatalogSymbol } from "@workstream/contracts";
import { DesignAssetGlyph } from "./DesignAssetGlyph";
import s from "./placement.module.css";

const DRAG_THRESHOLD_PX = 4;

type Props = {
  placement: CatalogPlacement;
  symbol: CatalogSymbol;
  selected: boolean;
  isTpz: boolean;
  indicativeMetres: number | null;
  onSelect: (e?: React.MouseEvent) => void;
  /** Alt+click eyedropper — sample into brush recipe without selecting. */
  onAltSample?: () => void;
  onMovePointerDown: (e: React.PointerEvent) => void;
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
  onAltSample,
  onMovePointerDown,
  onRotateStart,
  onScaleStart,
  onDelete,
}: Props) {
  const downRef = useRef<{ x: number; y: number } | null>(null);

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
      role="group"
      tabIndex={0}
      aria-label={`${symbol.label}, placed on plan`}
      aria-selected={selected}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.altKey && onAltSample) {
          e.preventDefault();
          onAltSample();
          return;
        }
        onSelect(e);
        downRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!downRef.current) return;
        const moved = Math.hypot(
          e.clientX - downRef.current.x,
          e.clientY - downRef.current.y,
        );
        if (moved >= DRAG_THRESHOLD_PX) {
          downRef.current = null;
          onMovePointerDown(e);
        }
      }}
      onPointerUp={() => {
        downRef.current = null;
      }}
      onPointerCancel={() => {
        downRef.current = null;
      }}
      onKeyDown={(e) => {
        // Delete/Backspace handled by parent canvas keydown listener.
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(undefined);
        }
      }}
    >
      <DesignAssetGlyph symbol={symbol} size="pin" />
      {selected ? (
        <>
          <span className={s.selectionRingDecor} aria-hidden />
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
            onPointerDown={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            ✕
          </button>
          {isTpz && indicativeMetres != null ? (
            <span className={s.tpzReadout} aria-live="polite">
              ~{indicativeMetres} m indicative only
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
