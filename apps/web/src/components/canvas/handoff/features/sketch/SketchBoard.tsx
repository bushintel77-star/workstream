"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { strokePointsToPathD } from "@workstream/domain";
import type { SketchStroke } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import css from "./sketch.module.css";

type Props = {
  strokes: SketchStroke[];
  darkOn: boolean;
  /** Commit a finished stroke (once per pointer-up — not per move). */
  onCommit: (stroke: SketchStroke) => void;
  /** Soften ink in place — stays hand-drawn, not CAD symbols. */
  onTidy?: () => void;
  /** Optional formalize: freehand → CAD ghosts on the site plan. */
  onFormalizeToCad?: () => void;
  /** True while the AI sketch→CAD pipeline is in flight. */
  formalizing?: boolean;
};

/**
 * Stripped sketch pad — finger / stylus ink only.
 * CadPlanBoard hides symbols while this mounts; site boundary stays faint.
 * Tidy keeps the artist's hand; Formalize to CAD is a separate step.
 */
export function SketchBoard({
  strokes,
  darkOn,
  onCommit,
  onTidy,
  onFormalizeToCad,
  formalizing = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<PctPoint[] | null>(null);
  const idn = useRef(0);
  const [live, setLive] = useState<PctPoint[] | null>(null);
  const [size, setSize] = useState({ w: 960, h: 640 });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) {
        setSize({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toPct = (el: HTMLElement, clientX: number, clientY: number): PctPoint => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    };
  };

  const all = live
    ? [...strokes, { id: "__live", points: live }]
    : strokes;
  const canAct = strokes.length > 0;
  const ink = darkOn ? "#C9C2BA" : "#1C1917";

  return (
    <div
      ref={rootRef}
      className={css.root}
      data-testid="sketch-board"
      data-sketch-pad="stripped"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = toPct(e.currentTarget, e.clientX, e.clientY);
        drawing.current = [p];
        setLive([p]);
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        const p = toPct(e.currentTarget, e.clientX, e.clientY);
        drawing.current = [...drawing.current, p];
        setLive(drawing.current);
      }}
      onPointerUp={() => {
        const pts = drawing.current;
        drawing.current = null;
        setLive(null);
        if (!pts || pts.length < 2) return;
        idn.current += 1;
        // Raw ink only — the sketch layer performs ZERO smoothing, snapping,
        // resampling, or geometry manipulation. The captured points are stored
        // exactly as drawn. Tidy/Formalize are explicit, opt-in later steps.
        onCommit({ id: `sk${Date.now()}_${idn.current}`, points: pts });
      }}
    >
      <svg
        className={css.svg}
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="none"
      >
        {all.map((s) => {
          const d = strokePointsToPathD(
            s.points.map((p) => ({ x_pct: p.x, y_pct: p.y })),
            size.w,
            size.h,
            s.id === "__live" ? 1.6 : 2.1,
            { raw: true },
          );
          if (!d) return null;
          return (
            <path
              key={s.id}
              d={d}
              fill={ink}
              opacity={s.id === "__live" ? 0.55 : 0.88}
              style={{ pointerEvents: "none" }}
            />
          );
        })}
      </svg>
      <div className={css.bar} data-testid="sketch-convert-bar">
        <p className={css.hint}>
          {formalizing
            ? "Translating sketch to CAD with AI…"
            : canAct
              ? `${strokes.length} stroke${strokes.length === 1 ? "" : "s"} · tidy stays hand-drawn · formalize when ready`
              : "Sketch first · finger or stylus · format later"}
        </p>
        {canAct && onTidy ? (
          <button
            type="button"
            className={css.tidy}
            data-testid="sketch-tidy"
            disabled={formalizing}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onTidy();
            }}
          >
            Tidy sketch
          </button>
        ) : null}
        {canAct && onFormalizeToCad ? (
          <button
            type="button"
            className={css.convert}
            data-testid="sketch-convert-cad"
            disabled={formalizing}
            aria-busy={formalizing}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onFormalizeToCad();
            }}
          >
            {formalizing ? "Translating…" : "Formalize to CAD"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
