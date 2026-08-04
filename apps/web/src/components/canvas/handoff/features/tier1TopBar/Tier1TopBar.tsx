"use client";

import type { ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import css from "./tier1TopBar.module.css";

type Props = {
  /** Left zone — project context: brand, address, survey pill, cadastral meta. */
  left: ReactNode;
  /** Center zone — workflow stage tabs (Survey…Share). */
  center: ReactNode;
  /** Right zone — global actions & status: Ask AI, Cmd+K, save, Share/Export, view menu. */
  right: ReactNode;
  compact?: boolean;
  clientView?: boolean;
  "aria-label"?: string;
};

/**
 * Tier-1 unified top bar — single dark-slate header replacing the split
 * CanvasHeaderRail (top-left) + CanvasTopBorder (top-right) portals.
 *
 * Three zones in one frame band:
 *   Left   — Project Context (brand + address + status tags)
 *   Center — Workflow Stage Tabs (mode nav with high-contrast active backlight)
 *   Right  — Global Actions & Status (Ask AI, Cmd+K, unified save, Share)
 *
 * Portals through CameraChrome to camera-chrome-root (sibling of .zoomWorld),
 * never renders inside zoom-world. z-index:22 — same as the rails it replaces.
 */
export function Tier1TopBar({
  left,
  center,
  right,
  compact = false,
  clientView = false,
  "aria-label": ariaLabel = "Canvas header",
}: Props) {
  return (
    <CameraChrome
      place={{ kind: "frame" }}
      zIndex={22}
      testId="tier1-top-bar-chrome"
    >
      <div
        className={`${css.bar}${compact ? ` ${css.barCompact}` : ""}`}
        data-frame-rail="top"
        data-client-view={clientView ? "true" : "false"}
        data-compact={compact ? "true" : "false"}
        data-testid="tier1-top-bar"
        aria-label={ariaLabel}
      >
        <div className={css.zoneLeft}>{left}</div>
        <div className={css.zoneCenter}>{center}</div>
        <div className={css.zoneRight}>{right}</div>
      </div>
    </CameraChrome>
  );
}
