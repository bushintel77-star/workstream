"use client";

import { useMemo } from "react";
import { inferRectangleCompletion } from "@workstream/domain";
import { polygonAreaM2, ptsAttr, type PctPoint } from "../../geometry";
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
  const completion = useMemo(() => {
    if (!drawPoly || locked) return null;
    return inferRectangleCompletion(drawPoly, drawCursor);
  }, [drawCursor, drawPoly, locked]);

  if (!active) return null;

  const poly = drawPoly ?? [];
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
        let p = toPct(e.currentTarget, e.clientX, e.clientY);
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
              ["building", "Building"],
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
