"use client";

import { CameraChrome } from "../../CameraChrome";
import css from "./dialHint.module.css";

type Props = {
  onDismiss: () => void;
  /** Hint copy — defaults to the rotate-dial discoverability line. */
  label?: string;
  testId?: string;
};

/** One-time discoverability — dock CameraChrome, never under zoom-world. */
export function DialHintPill({
  onDismiss,
  label = "Drag the arc to rotate",
  testId = "dial-hint",
}: Props) {
  return (
    <CameraChrome place={{ kind: "dock" }} testId={testId}>
      <div className={css.pill} role="status">
        <span>{label}</span>
        <button type="button" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </CameraChrome>
  );
}
