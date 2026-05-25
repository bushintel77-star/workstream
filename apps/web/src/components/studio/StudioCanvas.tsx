"use client";

import type { ReactNode } from "react";
import cv from "./studioCanvas.module.css";

type Props = {
  children: ReactNode;
};

/** Canvas viewport host — aerial and placements render inside `.stage`. */
export function StudioCanvas({ children }: Props) {
  return (
    <div className={cv.canvas} data-testid="studio-canvas-host">
      <div className={cv.dotGrid} aria-hidden />
      <div className={cv.stage}>{children}</div>
    </div>
  );
}
