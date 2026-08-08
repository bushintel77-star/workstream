"use client";

import { useEffect, useMemo, useState } from "react";
import { edgeLengthM, type PctPoint } from "../../geometry";
import type { BoardCamera } from "../../geometry/cameraPointer";
import { CameraChrome } from "../../CameraChrome";
import css from "./measure.module.css";

type Props = {
  active: boolean;
  scaleM?: number;
  /**
   * Live board camera — matches `.zoomWorld`. The metres label portals
   * out through this camera so it stays a constant screen size instead
   * of stretching with the world.
   */
  cam?: BoardCamera;
  /** Exit measure → default pan (Esc / double-click / right-click). */
  onCancel: () => void;
};

/**
 * Indicative measure tape — drag between two points for live metres.
 *
 * Cancel (CAD practice — KiCad / Fusion): Esc, double-click empty, or right-click
 * returns to the default pan tool. Esc clears an in-progress tape first.
 */
export function MeasureOverlay({
  active,
  scaleM = 110,
  cam,
  onCancel,
}: Props) {
  const [a, setA] = useState<PctPoint | null>(null);
  const [b, setB] = useState<PctPoint | null>(null);
  const [hover, setHover] = useState<PctPoint | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!active) {
      setA(null);
      setB(null);
      setHover(null);
      setDragging(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (a || b) {
        setA(null);
        setB(null);
        setHover(null);
        setDragging(false);
        return;
      }
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, a, b, onCancel]);

  const len = useMemo(() => {
    if (!a || !b) return null;
    return edgeLengthM(a, b, scaleM);
  }, [a, b, scaleM]);

  const mid = a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
  const tip = a && !b && hover ? hover : null;

  if (!active) return null;

  const toPct = (el: HTMLElement, clientX: number, clientY: number): PctPoint => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    };
  };

  return (
    <div
      className={css.root}
      data-testid="measure-overlay"
      onPointerMove={(e) => {
        const p = toPct(e.currentTarget, e.clientX, e.clientY);
        setHover(p);
        if (dragging && a) setB(p);
      }}
      onPointerLeave={() => setHover(null)}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button === 2) {
          e.preventDefault();
          onCancel();
          return;
        }
        if (e.button !== 0) return;
        // Double-click empty / anywhere exits (CAD cancel), before placing a point.
        if (e.detail >= 2) {
          e.preventDefault();
          onCancel();
          return;
        }
        const p = toPct(e.currentTarget, e.clientX, e.clientY);
        setA(p);
        setB(p);
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={(e) => {
        if (!dragging) return;
        e.stopPropagation();
        const p = toPct(e.currentTarget, e.clientX, e.clientY);
        setB(p);
        setDragging(false);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }}
    >
      <svg className={css.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
        {a && (b || tip) ? (
          <line
            x1={a.x}
            y1={a.y}
            x2={(b ?? tip)!.x}
            y2={(b ?? tip)!.y}
            className={css.line}
          />
        ) : null}
        {a ? <circle cx={a.x} cy={a.y} r={0.8} className={css.dot} /> : null}
        {b ? <circle cx={b.x} cy={b.y} r={0.8} className={css.dot} /> : null}
      </svg>
      {mid && len != null ? (
        cam ? (
          <CameraChrome
            place={{
              kind: "project",
              pct: mid,
              cam,
              transform: "translate(-50%, -140%)",
            }}
          >
            <div
              className={`${css.label}${dragging ? ` ${css.labelLive}` : ""}`}
            >
              {len.toFixed(2)} m
            </div>
          </CameraChrome>
        ) : (
          <div
            className={`${css.label}${dragging ? ` ${css.labelLive}` : ""}`}
            style={{
              position: "absolute",
              left: `${mid.x}%`,
              top: `${mid.y}%`,
              transform: "translate(-50%, -140%)",
            }}
          >
            {len.toFixed(2)} m
          </div>
        )
      ) : (
        <CameraChrome>
          <div className={css.hint}>
            Drag to measure · Esc / right-click exits
          </div>
        </CameraChrome>
      )}
    </div>
  );
}
