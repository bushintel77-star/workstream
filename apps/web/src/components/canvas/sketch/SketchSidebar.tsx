"use client";

/**
 * Sketch Pad — left-border icon sidebar.
 *
 * A narrow frosted-glass rail pinned to the left edge, full viewport height.
 * Contains only the absolute essentials per the canvas-first mandate:
 * Calibrate Grid, Draw Boundary, Drop Node, Undo, Redo. No toolbars, no
 * labels beyond icon tooltips — maximum screen real estate for the photo.
 */

import type { CSSProperties } from "react";
import type { SketchTool, SketchView } from "./sketchHelpers";

export interface SketchSidebarProps {
  activeTool: SketchTool;
  onTool: (t: SketchTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  gridOn: boolean;
  onToggleGrid: () => void;
  /** Current view plane — plan (aerial) or elevation (profile). */
  view: SketchView;
  onView: (v: SketchView) => void;
}

const railStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  bottom: 0,
  width: 56,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "12px 0",
  zIndex: 10,
  background: "color-mix(in srgb, var(--gs-glass) 70%, transparent)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderRight: "1px solid color-mix(in srgb, var(--gs-line) 50%, transparent)",
};

function iconButtonStyle(active: boolean): CSSProperties {
  return {
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    background: active ? "var(--gs-primary)" : "transparent",
    color: active ? "var(--gs-canvas)" : "var(--gs-ink-secondary)",
    transition: "background 0.15s, color 0.15s",
  };
}

const dividerStyle: CSSProperties = {
  width: 28,
  height: 1,
  background: "color-mix(in srgb, var(--gs-line) 60%, transparent)",
  margin: "4px 0",
};

const disabledStyle: CSSProperties = { opacity: 0.3, cursor: "default" };

export function SketchSidebar({
  activeTool,
  onTool,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  gridOn,
  onToggleGrid,
  view,
  onView,
}: SketchSidebarProps) {
  return (
    <nav style={railStyle} aria-label="Sketch tools">
      {/* Plan / Elevation toggle — the single mode switch. No second screen;
          the grid + chip math pivot in place. */}
      <button
        style={iconButtonStyle(view === "plan")}
        onClick={() => onView("plan")}
        aria-label="Plan view (aerial)"
        aria-pressed={view === "plan"}
        title="Plan (Aerial)"
      >
        <PlanIcon />
      </button>
      <button
        style={iconButtonStyle(view === "elevation")}
        onClick={() => onView("elevation")}
        aria-label="Elevation view (profile)"
        aria-pressed={view === "elevation"}
        title="Elevation (Profile)"
      >
        <ElevationIcon />
      </button>

      <div style={dividerStyle} />

      {/* Calibrate Grid */}
      <button
        style={iconButtonStyle(gridOn)}
        onClick={onToggleGrid}
        aria-label="Calibrate grid"
        aria-pressed={gridOn}
        title="Calibrate Grid"
      >
        <GridIcon />
      </button>

      <div style={dividerStyle} />

      {/* Draw Boundary (default tool) */}
      <button
        style={iconButtonStyle(activeTool === "draw")}
        onClick={() => onTool("draw")}
        aria-label="Draw boundary"
        aria-pressed={activeTool === "draw"}
        title="Draw Boundary"
      >
        <PenIcon />
      </button>

      {/* Drop Node */}
      <button
        style={iconButtonStyle(activeTool === "node")}
        onClick={() => onTool("node")}
        aria-label="Drop node"
        aria-pressed={activeTool === "node"}
        title="Drop Node"
      >
        <PinIcon />
      </button>

      <div style={{ ...dividerStyle, marginTop: "auto" }} />

      {/* Undo */}
      <button
        style={{ ...iconButtonStyle(false), ...(canUndo ? {} : disabledStyle) }}
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Cmd+Z)"
      >
        <UndoIcon />
      </button>

      {/* Redo */}
      <button
        style={{ ...iconButtonStyle(false), ...(canRedo ? {} : disabledStyle) }}
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Cmd+Shift+Z)"
      >
        <RedoIcon />
      </button>
    </nav>
  );
}

/* ---- Inline SVG icons (no icon-font dependency) ---- */

/** Plan (aerial/top-down) icon — a square seen from above. */
function PlanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

/** Elevation (profile/side) icon — a house silhouette seen from the side. */
function ElevationIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 20h18" />
      <path d="M4 20V11l8-6 8 6v9" />
      <path d="M9 20v-5h6v5" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 7v6h-6" />
      <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
    </svg>
  );
}
