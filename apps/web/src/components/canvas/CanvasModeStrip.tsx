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

/** Handoff mode pills — Share stays a header action, not a mode tab. */
const MODE_TABS = CANVAS_MODES.filter((m) => m.id !== "share");

const LOCK_HINT: Record<CanvasMode, string> = {
  survey: "Start here — load Vicmap title",
  sketch: "Run Survey for aerial, then paint the garden",
  cad: "Open the title Fit sheet to draft lines",
  elevation: "Load aerial to view side profile",
  quote: "Accept CAD on the Fit sheet to unlock Quote",
  share: "Promote a client quote to unlock Share",
};

export function CanvasModeStrip({
  mode,
  progress,
  onMode,
  paper = false,
}: Props) {
  const unlocked = unlockedModes(progress);
  const activeMode = mode === "share" ? "quote" : mode;

  return (
    <nav
      className={`${css.modeStrip}${paper ? ` ${css.modeStripPaper}` : ""}`}
      aria-label="Canvas modes"
      data-testid="canvas-mode-strip"
      data-paper={paper ? "1" : undefined}
    >
      {MODE_TABS.map((m) => {
        const open = unlocked.has(m.id);

        return (
          <button
            key={m.id}
            type="button"
            className={`${css.modeBtn} ${activeMode === m.id ? css.modeBtnActive : ""} ${!open ? css.modeBtnLocked : ""}`}
            aria-pressed={activeMode === m.id}
            aria-disabled={!open}
            disabled={!open}
            title={open ? m.label : LOCK_HINT[m.id]}
            data-testid={`canvas-mode-${m.id}`}
            onClick={() => {
              if (open) onMode(m.id);
            }}
          >
            {m.label}
          </button>
        );
      })}
    </nav>
  );
}
