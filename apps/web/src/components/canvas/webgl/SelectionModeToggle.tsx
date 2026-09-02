"use client";

/**
 * Phase H — Selection Mode toggle button.
 *
 * A small floating button that sits beside the Draw/View toggle. When
 * active, it enables red-mask isolation and the boolean ops toolbar.
 * View-state only — never enters docSnapshot.
 */

import { useStudioStore } from "./studioStore";
import styles from "./SelectionModeToggle.module.css";

export function SelectionModeToggle() {
  const selectionModeActive = useStudioStore((s) => s.selectionModeActive);
  const toggleSelectionMode = useStudioStore((s) => s.toggleSelectionMode);

  return (
    <button
      className={`${styles.toggle} ${selectionModeActive ? styles.toggleActive : ""}`}
      onClick={toggleSelectionMode}
      title={
        selectionModeActive
          ? "Selection mode active. Click to exit."
          : "Selection mode — isolate and boolean-edit selections."
      }
      data-testid="selection-mode-toggle"
      data-active={selectionModeActive ? "true" : "false"}
    >
      SEL
    </button>
  );
}
