"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inferRectangleCompletion } from "@workstream/domain";
import { polygonAreaM2, ptsAttr, snapTracePointer, type PctPoint } from "../../geometry";
import type { BoardCamera } from "../../geometry/cameraPointer";
import {
  formatSegmentTip,
  pointFromSegmentInput,
} from "../../geometry/drafting";
import type { TraceTarget } from "../../state/studioTypes";
import { CameraChrome } from "../../CameraChrome";
import css from "./trace.module.css";

type Props = {
  active: boolean;
  locked: boolean;
  target: TraceTarget;
  drawPoly: PctPoint[] | null;
  drawCursor: PctPoint | null;
  scaleM?: number;
  /** Existing vertices to snap to while tracing (boundary/building). */
  anchors?: PctPoint[];
  /**
   * Live board camera — matches `.zoomWorld`. Dynamic-input pill and the
   * autocomplete badge portal through this camera so they stay a constant
   * screen size while the polyline itself rides the world transform.
   */
  cam?: BoardCamera;
  onTarget: (t: TraceTarget) => void;
  onCursor: (p: PctPoint | null) => void;
  onPush: (p: PctPoint) => void;
  onFinish: (pts: PctPoint[]) => void;
  onCancel: () => void;
  onPop: () => void;
};

/** Close-ring snap radius in CSS px (handoff ≈ 14, SDS §3). */
const CLOSE_PX = 14;
/** Vertex / cadastral snap radius in CSS px (SDS §3 = 12). */
const VERTEX_PX = 12;

function centroid(pts: PctPoint[]) {
  const n = pts.length || 1;
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / n,
    y: pts.reduce((a, p) => a + p.y, 0) / n,
  };
}

/**
 * Trace tool — click-to-place polygon + gold rectangle autocomplete (Tab).
 */
export function TraceOverlay({
  active,
  locked,
  target,
  drawPoly,
  drawCursor,
  scaleM = 110,
  anchors = [],
  cam,
  onTarget,
  onCursor,
  onPush,
  onFinish,
  onCancel,
  onPop,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lengthInputRef = useRef<HTMLInputElement>(null);
  const angleInputRef = useRef<HTMLInputElement>(null);
  const [activeField, setActiveField] = useState<"length" | "angle">("length");
  const [typedLength, setTypedLength] = useState<string | null>(null);
  const [typedAngle, setTypedAngle] = useState<string | null>(null);
  const completion = useMemo(() => {
    if (!drawPoly || locked) return null;
    return inferRectangleCompletion(drawPoly, drawCursor);
  }, [drawCursor, drawPoly, locked]);

  const poly = drawPoly ?? [];
  const last = poly[poly.length - 1] ?? null;
  const boardAspect =
    (rootRef.current?.clientWidth ?? 1) /
    Math.max(1, rootRef.current?.clientHeight ?? 1);
  const segment = useMemo(() => {
    if (!last || !drawCursor) return null;
    return formatSegmentTip(last, drawCursor, scaleM, boardAspect);
  }, [boardAspect, drawCursor, last, scaleM]);
  const hasTypedInput = typedLength != null || typedAngle != null;

  const clearTypedInput = () => {
    setTypedLength(null);
    setTypedAngle(null);
  };

  const typedPoint = useCallback(() => {
    if (!last || !drawCursor || !hasTypedInput) return null;
    const length = typedLength == null ? null : Number.parseFloat(typedLength);
    const angle = typedAngle == null ? null : Number.parseFloat(typedAngle);
    return pointFromSegmentInput(
      last,
      drawCursor,
      scaleM,
      boardAspect,
      Number.isFinite(length) ? length : null,
      Number.isFinite(angle) ? angle : null,
    );
  }, [last, drawCursor, hasTypedInput, typedLength, typedAngle, scaleM, boardAspect]);

  useEffect(() => {
    if (!active || locked || !segment) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const inDynamicInput =
        target === lengthInputRef.current || target === angleInputRef.current;
      if (/^[0-9.-]$/.test(event.key) && !inDynamicInput) {
        event.preventDefault();
        event.stopPropagation();
        const setValue =
          activeField === "length" ? setTypedLength : setTypedAngle;
        setValue((value) => `${value ?? ""}${event.key}`);
        queueMicrotask(() =>
          (activeField === "length"
            ? lengthInputRef.current
            : angleInputRef.current
          )?.focus(),
        );
        return;
      }
      if (event.key === "Tab" && hasTypedInput) {
        event.preventDefault();
        event.stopPropagation();
        const next = activeField === "length" ? "angle" : "length";
        setActiveField(next);
        queueMicrotask(() =>
          (next === "length"
            ? lengthInputRef.current
            : angleInputRef.current
          )?.focus(),
        );
        return;
      }
      if (event.key === "Enter" && hasTypedInput) {
        const point = typedPoint();
        if (!point) return;
        event.preventDefault();
        event.stopPropagation();
        onPush(point);
        clearTypedInput();
        return;
      }
      if (event.key === "Escape" && hasTypedInput) {
        event.preventDefault();
        event.stopPropagation();
        clearTypedInput();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    active,
    activeField,
    hasTypedInput,
    locked,
    onPush,
    segment,
    typedAngle,
    typedLength,
    typedPoint,
  ]);

  if (!active) return null;

  const linePts =
    poly.length === 0
      ? ""
      : ptsAttr(drawCursor ? [...poly, drawCursor] : poly);
  const area =
    poly.length >= 3 ? polygonAreaM2(poly, scaleM) : poly.length === 2 && completion
      ? polygonAreaM2(completion, scaleM)
      : 0;
  const c = completion ? centroid(completion) : null;

  const toPct = (el: HTMLElement, clientX: number, clientY: number): PctPoint => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    };
  };

  return (
    <div
      ref={rootRef}
      className={css.root}
      data-testid="trace-overlay"
      onPointerMove={(e) => {
        if (locked) return;
        const raw = toPct(e.currentTarget, e.clientX, e.clientY);
        const snapped = snapTracePointer(raw, poly, anchors, {
          boardW: e.currentTarget.clientWidth,
          boardH: e.currentTarget.clientHeight,
          closePx: CLOSE_PX,
          vertexPx: VERTEX_PX,
        });
        // Snap the live cursor so the preview line retracts onto the first
        // vertex (close affordance) and segments ride 45°/90°+vertex snaps.
        onCursor({ x: snapped.x, y: snapped.y });
      }}
      onPointerLeave={() => onCursor(null)}
      onPointerDown={(e) => {
        if (locked) return;
        e.stopPropagation();
        const typed = typedPoint();
        const raw = typed ?? toPct(e.currentTarget, e.clientX, e.clientY);
        const snapped = snapTracePointer(raw, poly, anchors, {
          boardW: e.currentTarget.clientWidth,
          boardH: e.currentTarget.clientHeight,
          closePx: CLOSE_PX,
          vertexPx: VERTEX_PX,
          shift: e.shiftKey,
        });
        // Close takes priority over angle/vertex magnetism: clicking near the
        // first vertex (within closePx CSS px) finishes a valid closed ring.
        if (snapped.kind === "close") {
          onFinish(poly);
          return;
        }
        // Exact typed input wins over angle/vertex magnetism; raw clicks use
        // the snapped point (close → vertex → 45°/90° angle).
        onPush(
          typed
            ? { x: typed.x, y: typed.y }
            : { x: snapped.x, y: snapped.y },
        );
        if (hasTypedInput) clearTypedInput();
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        if (poly.length >= 3) onFinish(poly);
      }}
    >
      <svg className={css.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
        {completion ? (
          <polygon
            points={ptsAttr(completion)}
            className={css.ghostRect}
          />
        ) : null}
        {linePts ? (
          <polyline points={linePts} className={css.drawLine} />
        ) : null}
        {poly.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={0.7} className={css.dot} />
        ))}
      </svg>

      {drawCursor && segment ? (
        cam ? (
          <CameraChrome
            place={{
              kind: "project",
              pct: drawCursor,
              cam,
              transform: "none",
            }}
          >
            <div
              className={css.dynamicInput}
              data-testid="trace-dynamic-input"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <label data-active={activeField === "length" ? "true" : "false"}>
                <span>L</span>
                <input
                  ref={lengthInputRef}
                  inputMode="decimal"
                  aria-label="Segment length in metres"
                  value={typedLength ?? segment.lengthM.toFixed(2)}
                  onFocus={(event) => {
                    setActiveField("length");
                    if (typedLength == null) setTypedLength("");
                    event.currentTarget.select();
                  }}
                  onChange={(event) => setTypedLength(event.target.value)}
                />
                <span>m</span>
              </label>
              <label data-active={activeField === "angle" ? "true" : "false"}>
                <span>A</span>
                <input
                  ref={angleInputRef}
                  inputMode="decimal"
                  aria-label="Segment angle in degrees"
                  value={typedAngle ?? segment.angleDeg.toFixed(0)}
                  onFocus={(event) => {
                    setActiveField("angle");
                    if (typedAngle == null) setTypedAngle("");
                    event.currentTarget.select();
                  }}
                  onChange={(event) => setTypedAngle(event.target.value)}
                />
                <span>°</span>
              </label>
            </div>
          </CameraChrome>
        ) : (
          <div
            className={css.dynamicInput}
            data-testid="trace-dynamic-input"
            style={{ left: `${drawCursor.x}%`, top: `${drawCursor.y}%` }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <label data-active={activeField === "length" ? "true" : "false"}>
              <span>L</span>
              <input
                ref={lengthInputRef}
                inputMode="decimal"
                aria-label="Segment length in metres"
                value={typedLength ?? segment.lengthM.toFixed(2)}
                onFocus={(event) => {
                  setActiveField("length");
                  if (typedLength == null) setTypedLength("");
                  event.currentTarget.select();
                }}
                onChange={(event) => setTypedLength(event.target.value)}
              />
              <span>m</span>
            </label>
            <label data-active={activeField === "angle" ? "true" : "false"}>
              <span>A</span>
              <input
                ref={angleInputRef}
                inputMode="decimal"
                aria-label="Segment angle in degrees"
                value={typedAngle ?? segment.angleDeg.toFixed(0)}
                onFocus={(event) => {
                  setActiveField("angle");
                  if (typedAngle == null) setTypedAngle("");
                  event.currentTarget.select();
                }}
                onChange={(event) => setTypedAngle(event.target.value)}
              />
              <span>°</span>
            </label>
          </div>
        )
      ) : null}

      {completion && c ? (
        cam ? (
          <CameraChrome
            place={{ kind: "project", pct: c, cam, transform: "none" }}
          >
            <button
              type="button"
              className={css.autoBadge}
              data-testid="trace-autocomplete"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onFinish(completion)}
            >
              Autocomplete rectangle
            </button>
          </CameraChrome>
        ) : (
          <button
            type="button"
            className={css.autoBadge}
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
            data-testid="trace-autocomplete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onFinish(completion)}
          >
            Autocomplete rectangle
          </button>
        )
      ) : null}

      <CameraChrome>
        <div className={css.bar} data-testid="trace-status">
          <div className={css.targets}>
            {(
              [
                ["boundary", "Boundary"],
                ["building", "Existing dwelling"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={css.targetBtn}
                data-active={target === id ? "true" : "false"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onTarget(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className={css.status}>
            Tracing {target} · {poly.length} pts
            {area > 0 ? ` · ${area.toFixed(1)} m²` : ""}
          </span>
          {completion ? (
            <span className={css.tabHint}>Tab autocompletes rectangle</span>
          ) : null}
          <button
            type="button"
            className={css.finish}
            disabled={poly.length < 3}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onFinish(poly)}
          >
            Finish
          </button>
          <button
            type="button"
            className={css.cancel}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={css.cancel}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onPop}
            title="Remove last point"
          >
            Back
          </button>
        </div>
      </CameraChrome>
    </div>
  );
}

/** Exported for keyboard handler in the shell. */
export function currentTraceCompletion(
  drawPoly: PctPoint[] | null,
  drawCursor: PctPoint | null,
  locked: boolean,
): PctPoint[] | null {
  if (!drawPoly || locked) return null;
  return inferRectangleCompletion(drawPoly, drawCursor);
}
