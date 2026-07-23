"use client";

import { CameraChrome } from "../../CameraChrome";
import css from "./tilt.module.css";

type Props = {
  kind: "discover" | "paused";
  onDismiss: () => void;
};

/**
 * Dock-only CameraChrome pills — never under zoom-world (gate C).
 */
export function TiltHintPill({ kind, onDismiss }: Props) {
  const label =
    kind === "discover"
      ? "Ctrl+drag to tilt"
      : "Tilt view — editing paused";
  return (
    <CameraChrome place={{ kind: "dock" }} testId={`tilt-hint-${kind}`}>
      <div
        className={kind === "discover" ? css.hintPill : css.pausePill}
        role="status"
      >
        <span>{label}</span>
        <button type="button" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </CameraChrome>
  );
}
