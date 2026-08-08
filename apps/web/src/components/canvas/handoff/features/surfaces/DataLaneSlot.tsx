"use client";

import { useRef, type ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import { useFocusTrap } from "@/lib/use-focus-trap";
import css from "./rightDataLane.module.css";

/**
 * Shared right-lane shell for Layers / Measures / Demo Lots / Checklist.
 * One occupant; CameraChrome dock so gate C stays clean.
 *
 * Owns keyboard behavior for every occupant: Esc closes, Tab/Shift+Tab trap
 * focus inside the lane while it's open, and focus returns to whatever
 * opened it on close — one implementation instead of each panel re-solving
 * this (or, previously, none of them solving it at all).
 */
export function RightDataLane({
  children,
  testId = "right-data-lane",
  onClose,
}: {
  children: ReactNode;
  testId?: string;
  onClose?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, rootRef, onClose);

  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={52} testId={`${testId}-chrome`}>
      <div
        ref={rootRef}
        className={css.slot}
        data-testid={testId}
        data-camera-chrome-card="1"
        tabIndex={-1}
      >
        {children}
      </div>
    </CameraChrome>
  );
}
