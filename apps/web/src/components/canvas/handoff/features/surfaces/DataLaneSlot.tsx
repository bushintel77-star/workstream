"use client";

import type { ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import css from "./rightDataLane.module.css";

/**
 * Shared right-lane shell for Layers / Measures / Demo Lots / Checklist.
 * One occupant; CameraChrome dock so gate C stays clean.
 */
export function RightDataLane({
  children,
  testId = "right-data-lane",
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={52} testId={`${testId}-chrome`}>
      <div
        className={css.slot}
        data-testid={testId}
        data-camera-chrome-card="1"
      >
        {children}
      </div>
    </CameraChrome>
  );
}
