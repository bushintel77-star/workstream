"use client";

/**
 * Phase G — Draw/View mode toggle.
 *
 * A small floating button that sits beside the camera dock. In Sketch mode,
 * it toggles between DRAW (camera locked face-on to the active canvas) and
 * VIEW (free orbit). The toggle is view-state only — it never enters
 * docSnapshot and never triggers autosave.
 */

import { useStudioStore } from "./studioStore";
import styles from "./DrawViewToggle.module.css";

export function DrawViewToggle() {
  const drawViewMode = useStudioStore((s) => s.drawViewMode);
  const toggleDrawViewMode = useStudioStore((s) => s.toggleDrawViewMode);

  const isDraw = drawViewMode === "DRAW";

  return (
    <button
      className={`${styles.toggle} ${isDraw ? styles.toggleDraw : ""}`}
      onClick={toggleDrawViewMode}
      title={
        isDraw
          ? "Draw mode — camera locked to active canvas. Click for free orbit."
          : "View mode — free orbit. Click to lock camera to active canvas."
      }
      data-testid="draw-view-toggle"
      data-mode={drawViewMode}
    >
      {isDraw ? "DRAW" : "VIEW"}
    </button>
  );
}
