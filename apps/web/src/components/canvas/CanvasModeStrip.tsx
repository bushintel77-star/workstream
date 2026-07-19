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
  survey: "Start here — load Vicmap title",
  sketch: "Run Survey for aerial, then paint the garden",
  cad: "Open the title Fit sheet to draft lines",
  elevation: "Load aerial to view side profile",
  quote: "Accept CAD on the Fit sheet to unlock Quote",
  share: "Promote a client quote to unlock Share",
};

const LOCK_LABEL: Partial<Record<CanvasMode, string>> = {
  sketch: "Survey first",
  cad: "Open title",
  elevation: "Survey first",
  quote: "Accept CAD",
  share: "Save quote",
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
            className={`${css.modeBtn} ${mode === m.id ? css.modeBtnActive : ""} ${!open ? css.modeBtnLocked : ""} ${
              open &&
              m.id === "quote" &&
              progress.hasCad &&
              mode === "cad"
                ? css.modeBtnReady
                : ""
            }`}
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
            {!open ? (
              <span className={css.modeLock}>
                {LOCK_LABEL[m.id] ?? "Locked"}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
