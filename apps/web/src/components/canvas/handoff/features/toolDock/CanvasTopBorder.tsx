"use client";

import type { ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import css from "./canvasTopBorder.module.css";

type Props = {
  children: ReactNode;
  clientView?: boolean;
};

/**
 * Top-right controls, seated in the gallery frame's top band. Flat line icons
 * on the dark frame — no chip, no frost, nothing over the drawing.
 */
export function CanvasTopBorder({ children, clientView = false }: Props) {
  return (
    <CameraChrome
      place={{ kind: "frame" }}
      zIndex={22}
      testId="canvas-top-border-chrome"
    >
      <div
        className={css.rail}
        data-frame-rail="top-right"
        data-client-view={clientView ? "true" : "false"}
      >
        {children}
      </div>
    </CameraChrome>
  );
}
