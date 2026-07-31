"use client";

import type { ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import css from "./canvasHeaderRail.module.css";

type Props = {
  children: ReactNode;
  compact?: boolean;
  clientView?: boolean;
  "aria-label"?: string;
};

/**
 * Brand block, mode strip, cadastral meta and paper/elevation segment, seated
 * in the gallery frame's top-left band. Engraved into the frame rather than
 * parked on the drawing.
 */
export function CanvasHeaderRail({
  children,
  compact = false,
  clientView = false,
  "aria-label": ariaLabel = "Canvas header",
}: Props) {
  return (
    <CameraChrome
      place={{ kind: "frame" }}
      zIndex={22}
      testId="canvas-header-rail-chrome"
    >
      <div
        className={`${css.rail}${compact ? ` ${css.railCompact}` : ""}`}
        data-frame-rail="top-left"
        data-client-view={clientView ? "true" : "false"}
        data-compact={compact ? "true" : "false"}
        data-testid="canvas-header-rail"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </CameraChrome>
  );
}
