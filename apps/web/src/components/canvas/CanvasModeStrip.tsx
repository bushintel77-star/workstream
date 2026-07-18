"use client";

import {
  CANVAS_MODES,
  unlockedModes,
  type CanvasMode,
  type CanvasProgress,
} from "../../lib/canvas-mode";
import css from "./siteCanvas.module.css";

type Props = {
  mode: CanvasMode;
  progress: CanvasProgress;
  onMode: (mode: CanvasMode) => void;
  /** Cream Fit sheet - mode strip matches paper chrome. */
  paper?: boolean;
};

const LOCK_HINT: Record<CanvasMode, string> = {
  survey: "Start here - load Vicmap title",
  sketch: "Needs aerial from survey",
  cad: "Needs title opened - Fit sheet + line draw",
  quote: "Needs accepted CAD (no pending AI suggestions)",
  share: "Needs a persisted client quote",
};

export function CanvasModeStrip({
  mode,
  progress,
  onMode,
  paper = false,
}: Props) {
  const unlocked = unlockedModes(progress);

  return (
    <nav
      className={`${css.modeStrip}${paper ? ` ${css.modeStripPaper}` : ""}`}
      aria-label="Canvas modes"
      data-testid="canvas-mode-strip"
      data-paper={paper ? "1" : undefined}
    >
      {CANVAS_MODES.map((m) => {
        const open = unlocked.has(m.id);
        const nextLocked = CANVAS_MODES.find((x) => !unlocked.has(x.id));
        const show =
          open || (nextLocked != null && nextLocked.id === m.id);
        if (!show) return null;

        return (
          <button
            key={m.id}
            type="button"
            className={`${css.modeBtn} ${mode === m.id ? css.modeBtnActive : ""} ${!open ? css.modeBtnLocked : ""}`}
            aria-pressed={mode === m.id}
            aria-disabled={!open}
            disabled={!open}
            title={open ? m.label : LOCK_HINT[m.id]}
            data-testid={`canvas-mode-${m.id}`}
            onClick={() => {
              if (open) onMode(m.id);
            }}
          >
            {m.label}
            {!open ? <span className={css.modeLock}>Locked</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
