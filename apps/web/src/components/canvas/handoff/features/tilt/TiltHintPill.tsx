"use client";

import { CameraChrome } from "../../CameraChrome";
import css from "./tilt.module.css";

type Props = {
  kind: "discover" | "paused";
  onDismiss: () => void;
  /** When paused without a dwelling, explain missing walls. */
  hasDwelling?: boolean;
  /** Armed cardinal look label, e.g. "Looking north". */
  lookLabel?: string | null;
  /** Arm Trace → Existing dwelling from the empty-3D affordance. */
  onTraceDwelling?: () => void;
};

/**
 * Dock-only CameraChrome pills — never under zoom-world (gate C).
 */
export function TiltHintPill({
  kind,
  onDismiss,
  hasDwelling = true,
  lookLabel = null,
  onTraceDwelling,
}: Props) {
  const label =
    kind === "discover"
      ? "Ctrl+drag to tilt — or use the Tilt button (top bar)"
      : !hasDwelling
        ? "Tilt on — lot ground only · Trace dwelling for walls"
        : lookLabel
          ? `${lookLabel} — Esc to flatten`
          : "Looking north — Esc to flatten";
  return (
    <CameraChrome place={{ kind: "dock" }} testId={`tilt-hint-${kind}`}>
      <div
        className={kind === "discover" ? css.hintPill : css.pausePill}
        role="status"
        data-has-dwelling={hasDwelling ? "true" : "false"}
      >
        <span>{label}</span>
        {kind === "paused" && !hasDwelling && onTraceDwelling ? (
          <button
            type="button"
            className={css.pillAction}
            data-testid="tilt-trace-dwelling"
            onClick={onTraceDwelling}
          >
            Trace dwelling
          </button>
        ) : null}
        <button type="button" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </CameraChrome>
  );
}
