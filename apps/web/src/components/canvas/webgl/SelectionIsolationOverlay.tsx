"use client";

/**
 * Phase H — Selection Mode isolation overlay + boolean ops toolbar.
 *
 * When selection mode is active, this renders:
 *   1. A red-tinted vignette overlay over the viewport (the "red mask"
 *      isolation that dims non-selected entities visually).
 *   2. A floating toolbar with boolean operations: Subtract, Invert,
 *      Select All, and a Done button to exit selection mode.
 *
 * The overlay is pure DOM chrome — it lives in the WebGL chrome overlay,
 * never inside the R3F <Canvas>. The actual dimming of 3D entities is
 * achieved through the red-tinted overlay (a translucent red layer that
 * visually isolates the selected area), not by modifying scene materials.
 */

import { useStudioStore } from "./studioStore";
import styles from "./SelectionIsolationOverlay.module.css";

export function SelectionIsolationOverlay() {
  const selectionModeActive = useStudioStore((s) => s.selectionModeActive);
  const selection = useStudioStore((s) => s.selection);
  const toggleSelectionMode = useStudioStore((s) => s.toggleSelectionMode);
  const subtractFromSelection = useStudioStore((s) => s.subtractFromSelection);
  const invertSelection = useStudioStore((s) => s.invertSelection);
  const selectAll = useStudioStore((s) => s.selectAll);
  const clearSelection = useStudioStore((s) => s.clearSelection);

  if (!selectionModeActive) return null;

  const count = selection.length;

  return (
    <>
      {/* Red-mask isolation vignette — dims the viewport with a translucent
          red tint, visually isolating the selected entities. */}
      <div
        className={styles.mask}
        data-testid="selection-isolation-mask"
        aria-hidden="true"
      />

      {/* Boolean ops toolbar — floating at the top centre of the viewport. */}
      <div
        className={styles.toolbar}
        data-testid="selection-mode-toolbar"
        role="toolbar"
        aria-label="Selection mode operations"
      >
        <span className={styles.count} data-testid="selection-count">
          {count} selected
        </span>
        <div className={styles.divider} />
        <button
          className={styles.opBtn}
          onClick={() => selectAll()}
          title="Select all entities"
          data-testid="selection-op-select-all"
        >
          ALL
        </button>
        <button
          className={styles.opBtn}
          onClick={() => invertSelection()}
          title="Invert selection (select unselected, deselect selected)"
          data-testid="selection-op-invert"
        >
          INVERT
        </button>
        <button
          className={styles.opBtn}
          onClick={() => subtractFromSelection(selection)}
          title="Subtract current selection (clear it)"
          data-testid="selection-op-subtract"
          disabled={count === 0}
        >
          NONE
        </button>
        <button
          className={styles.opBtn}
          onClick={() => clearSelection()}
          title="Clear selection"
          data-testid="selection-op-clear"
          disabled={count === 0}
        >
          CLEAR
        </button>
        <div className={styles.divider} />
        <button
          className={styles.doneBtn}
          onClick={toggleSelectionMode}
          title="Exit selection mode"
          data-testid="selection-mode-done"
        >
          DONE
        </button>
      </div>
    </>
  );
}
