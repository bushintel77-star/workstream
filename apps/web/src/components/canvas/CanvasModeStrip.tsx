"use client";

import { CANVAS_MODES, type CanvasMode } from "../../lib/canvas-mode";
import css from "./siteCanvas.module.css";

type Props = {
  mode: CanvasMode;
  onMode: (mode: CanvasMode) => void;
};

export function CanvasModeStrip({ mode, onMode }: Props) {
  return (
    <nav className={css.modeStrip} aria-label="Canvas modes" data-testid="canvas-mode-strip">
      {CANVAS_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`${css.modeBtn} ${mode === m.id ? css.modeBtnActive : ""}`}
          aria-pressed={mode === m.id}
          data-testid={`canvas-mode-${m.id}`}
          onClick={() => onMode(m.id)}
        >
          {m.label}
        </button>
      ))}
    </nav>
  );
}
