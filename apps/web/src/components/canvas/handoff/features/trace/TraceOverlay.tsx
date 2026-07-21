"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inferRectangleCompletion } from "@workstream/domain";
import { polygonAreaM2, ptsAttr, type PctPoint } from "../../geometry";
import {
  formatSegmentTip,
  pointFromSegmentInput,
} from "../../geometry/drafting";
import type { TraceTarget } from "../../state/studioTypes";
import css from "./trace.module.css";

type Props = {
  active: boolean;
  locked: boolean;
  target: TraceTarget;
  drawPoly: PctPoint[] | null;
  drawCursor: PctPoint | null;
  scaleM?: number;
  onTarget: (t: TraceTarget) => void;
  onCursor: (p: PctPoint | null) => void;
  onPush: (p: PctPoint) => void;
  onFinish: (pts: PctPoint[]) => void;
  onCancel: () => void;
  onPop: () => void;
};

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

  const typedPoint = () => {
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
  };

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
        onCursor(toPct(e.currentTarget, e.clientX, e.clientY));
      }}
      onPointerLeave={() => onCursor(null)}
      onPointerDown={(e) => {
        if (locked) return;
        e.stopPropagation();
        let p =
          typedPoint() ?? toPct(e.currentTarget, e.clientX, e.clientY);
        if (poly.length >= 3) {
          const first = poly[0]!;
          const d = Math.hypot(p.x - first.x, p.y - first.y);
          if (d < 2.2) {
            onFinish(poly);
            return;
          }
        }
        // Ortho / angle snap — Shift = 90°, else soft 45° snap
        if (poly.length > 0) {
          const lp = poly[poly.length - 1]!;
          const dx = p.x - lp.x;
          const dy = p.y - lp.y;
          const len = Math.hypot(dx, dy);
          if (len > 0.4) {
            const a = Math.atan2(dy, dx);
            const step = e.shiftKey ? Math.PI / 2 : Math.PI / 4;
            const sa = Math.round(a / step) * step;
            if (e.shiftKey || Math.abs(a - sa) < 0.12) {
              p = {
                x: Math.max(0, Math.min(100, lp.x + len * Math.cos(sa))),
                y: Math.max(0, Math.min(100, lp.y + len * Math.sin(sa))),
              };
            }
          }
        }
        onPush(p);
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
      ) : null}

      {completion && c ? (
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
      ) : null}

      <div className={css.bar} data-testid="trace-status">
        <div className={css.targets}>
          {(
            [
              ["boundary", "Boundary"],
              ["building", "Existing house"],
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
