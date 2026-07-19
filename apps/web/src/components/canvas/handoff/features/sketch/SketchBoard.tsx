"use client";

import { useRef } from "react";
import type { SketchStroke } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import css from "./sketch.module.css";

type Props = {
  strokes: SketchStroke[];
  darkOn: boolean;
  onChange: (strokes: SketchStroke[]) => void;
};

/**
 * Freehand sketch mode — ink strokes in % board space over the aerial.
 */
export function SketchBoard({ strokes, darkOn, onChange }: Props) {
  const drawing = useRef<PctPoint[] | null>(null);
  const idn = useRef(strokes.length + 1);

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
      data-testid="sketch-board"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = [toPct(e.currentTarget, e.clientX, e.clientY)];
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        drawing.current = [
          ...drawing.current,
          toPct(e.currentTarget, e.clientX, e.clientY),
        ];
        // Live preview via forcing re-render through temporary stroke
        const live = drawing.current;
        onChange([
          ...strokes.filter((s) => s.id !== "__live"),
          { id: "__live", points: live },
        ]);
      }}
      onPointerUp={() => {
        const pts = drawing.current;
        drawing.current = null;
        if (!pts || pts.length < 2) {
          onChange(strokes.filter((s) => s.id !== "__live"));
          return;
        }
        idn.current += 1;
        onChange([
          ...strokes.filter((s) => s.id !== "__live"),
          { id: `sk${idn.current}`, points: pts },
        ]);
      }}
    >
      <svg className={css.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
        {strokes.map((s) => (
          <polyline
            key={s.id}
            points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={darkOn ? "#FFD3DE" : "#C2455F"}
            strokeWidth={s.id === "__live" ? 0.45 : 0.55}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={s.id === "__live" ? 0.7 : 0.9}
          />
        ))}
      </svg>
      <p className={css.hint}>Sketch freehand · ink stays on this site</p>
    </div>
  );
}
