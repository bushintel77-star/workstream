"use client";

import { CameraChrome } from "../../CameraChrome";
import css from "./tilt.module.css";

type Props = {
  kind: "discover" | "paused";
  onDismiss: () => void;
  /** When paused without a dwelling, explain missing walls. */
  hasDwelling?: boolean;
};

/**
 * Dock-only CameraChrome pills — never under zoom-world (gate C).
 */
export function TiltHintPill({ kind, onDismiss, hasDwelling = true }: Props) {
  const label =
    kind === "discover"
      ? "Ctrl+drag to tilt — or use the Tilt button (top bar)"
      : hasDwelling
        ? "Tilt on — drag to move · Esc to flatten"
        : "Tilt on — drag to move · Trace Bldg for walls";
  return (
    <CameraChrome place={{ kind: "dock" }} testId={`tilt-hint-${kind}`}>
      <div
        className={kind === "discover" ? css.hintPill : css.pausePill}
        role="status"
        data-has-dwelling={hasDwelling ? "true" : "false"}
      >
        <span>{label}</span>
        <button type="button" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </CameraChrome>
  );
}
