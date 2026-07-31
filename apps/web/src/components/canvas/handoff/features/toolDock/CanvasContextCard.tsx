"use client";

import type { ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import css from "./canvasContextCard.module.css";

type Props = {
  children: ReactNode;
  active: boolean;
};

/**
 * Transient bottom-left frosted rail that surfaces the studio context
 * breadcrumb and council tip. Only renders when there is active context to
 * show, so it does not clutter the canvas.
 */
export function CanvasContextCard({ children, active }: Props) {
  if (!active) return null;

  return (
    <CameraChrome
      place={{ kind: "dock" }}
      zIndex={22}
      testId="canvas-context-card-chrome"
    >
      <div
        className={css.card}
        data-testid="header-context-strip"
        aria-label="Canvas context"
      >
        {children}
      </div>
    </CameraChrome>
  );
}
