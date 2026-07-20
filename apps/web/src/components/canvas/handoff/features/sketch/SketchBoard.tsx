"use client";

import { useRef, useState } from "react";
import type { SketchStroke } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import css from "./sketch.module.css";

type Props = {
  strokes: SketchStroke[];
  darkOn: boolean;
  /** Commit a finished stroke (once per pointer-up — not per move). */
  onCommit: (stroke: SketchStroke) => void;
  /** Convert freehand ink → site-anchored CAD ghosts. */
  onConvertToCad?: () => void;
};

/**
 * Freehand sketch — ink over parchment. CadPlanBoard is pointer-events:none
 * while this mounts so symbols don't steal the stroke.
 */
export function SketchBoard({
  strokes,
  darkOn,
  onCommit,
  onConvertToCad,
}: Props) {
  const drawing = useRef<PctPoint[] | null>(null);
  const idn = useRef(0);
  const [live, setLive] = useState<PctPoint[] | null>(null);

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
  const canConvert = strokes.length > 0 && Boolean(onConvertToCad);

  return (
    <div
      className={css.root}
      data-testid="sketch-board"
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
        onCommit({ id: `sk${Date.now()}_${idn.current}`, points: pts });
      }}
    >
      <svg className={css.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
        {all.map((s) => (
          <polyline
            key={s.id}
            points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={darkOn ? "#C9C2BA" : "#1C1917"}
            strokeWidth={s.id === "__live" ? 0.45 : 0.55}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={s.id === "__live" ? 0.7 : 0.9}
            style={{ pointerEvents: "none" }}
          />
        ))}
      </svg>
      <div className={css.bar} data-testid="sketch-convert-bar">
        <p className={css.hint}>
          {canConvert
            ? `${strokes.length} stroke${strokes.length === 1 ? "" : "s"} · convert to CAD on the site plan`
            : "Sketch freehand · decks, hedges, canopies, beds"}
        </p>
        {canConvert ? (
          <button
            type="button"
            className={css.convert}
            data-testid="sketch-convert-cad"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onConvertToCad?.();
            }}
          >
            Convert to CAD
          </button>
        ) : null}
      </div>
    </div>
  );
}
