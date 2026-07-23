"use client";

import { CameraChrome } from "../../CameraChrome";
import css from "./dialHint.module.css";

type Props = {
  onDismiss: () => void;
};

/** One-time discoverability — dock CameraChrome, never under zoom-world. */
export function DialHintPill({ onDismiss }: Props) {
  return (
    <CameraChrome place={{ kind: "dock" }} testId="dial-hint">
      <div className={css.pill} role="status">
        <span>Drag the arc to rotate</span>
        <button type="button" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </CameraChrome>
  );
}
