"use client";

import { useStudioChromeOptional } from "./StudioChromeContext";
import sb from "./studioStatusBar.module.css";

export function StudioStatusBar() {
  const chrome = useStudioChromeOptional();
  const x = chrome?.cursorPct?.x;
  const y = chrome?.cursorPct?.y;
  const coord =
    x != null && y != null
      ? `x: ${x.toFixed(1)}%  y: ${y.toFixed(1)}%`
      : "x: — %  y: — %";
  const sel = chrome?.selectionCount ?? 0;
  const selectionLabel =
    sel === 0 ? "no selection" : `selection: ${sel} symbol${sel === 1 ? "" : "s"}`;
  const zoom = chrome?.zoomPercent ?? 100;
  const symbols = chrome?.symbolCount ?? 0;
  const zones = chrome?.zoneCount ?? 0;

  return (
    <footer className={sb.statusBar} role="status" aria-live="polite" data-testid="studio-status-bar">
      <span>{coord}</span>
      <span>{selectionLabel}</span>
      <span className={sb.right}>
        <span>zoom: {zoom}%</span>
        <span data-testid="design-studio-counts">
          {symbols} symbols · {zones} zones
        </span>
        <span className={sb.indicative}>indicative scale</span>
      </span>
    </footer>
  );
}
