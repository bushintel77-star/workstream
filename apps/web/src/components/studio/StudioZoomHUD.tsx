"use client";

import { useStudioChromeOptional } from "./StudioChromeContext";
import zh from "./studioZoomHud.module.css";

export function StudioZoomHUD() {
  const chrome = useStudioChromeOptional();
  if (!chrome) return null;

  return (
    <div className={zh.hud} aria-label="Zoom controls" data-testid="studio-zoom-hud">
      <div className={zh.row}>
        <button type="button" className={zh.btn} title="Zoom out" onClick={chrome.onZoomOut}>
          −
        </button>
        <span className={zh.pct}>{chrome.zoomPercent}%</span>
        <button type="button" className={zh.btn} title="Zoom in" onClick={chrome.onZoomIn}>
          +
        </button>
      </div>
      <button type="button" className={zh.fit} onClick={chrome.onResetView}>
        fit
      </button>
    </div>
  );
}
