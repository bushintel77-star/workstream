/**
 * Gold Standard 2026 — Studio keyboard map (single source of truth).
 *
 * Viewport 1–4 already matched the ViewportTransitionHUD presets; canvas
 * modes use Shift+digit so they never steal those keys. Letter tools are
 * the everyday rail actions. Resolve is pure — the listener only applies.
 */

import type { CanvasMode } from "../../../lib/canvas-mode";
import type { ToolId } from "./studioStore";

export type ViewportPreset = "plan" | "axo" | "sec" | "3d";
export type ToolAction =
  | "assets"
  | "measure"
  | "underground"
  | "dims"
  | "help";

export type StudioShortcut =
  | { kind: "viewport"; preset: ViewportPreset }
  | { kind: "mode"; mode: CanvasMode }
  | { kind: "tool"; tool: ToolAction }
  | { kind: "ribbon-tool"; tool: ToolId }
  | { kind: "brush"; action: BrushAction };

/** Tier-1 brush widget keys (Photoshop muscle memory — §2.3). */
export type BrushAction =
  | "eraser"
  | "size-down"
  | "size-up"
  | "swap-colour";

export const MODE_BY_SHIFT_DIGIT: Record<string, CanvasMode> = {
  "1": "survey",
  "2": "sketch",
  "3": "cad",
  "4": "elevation",
  "5": "garden",
  "6": "quote",
  "7": "present",
  "8": "share",
};

export const VIEWPORT_BY_DIGIT: Record<string, ViewportPreset> = {
  "1": "plan",
  "2": "axo",
  "3": "sec",
  "4": "3d",
};

export const TOOL_BY_KEY: Record<string, ToolAction> = {
  a: "assets",
  m: "measure",
  u: "underground",
  d: "dims",
  "?": "help",
};

/**
 * Landscape Canvas v2 — ribbon tool hotkeys (handoff §5.1).
 * These resolve to the ribbon's unified ToolId and dispatch through
 * setActiveTool (the legacy tool-flag bridge), so the keyboard and the
 * ribbon always agree on which tool is active.
 */
export const RIBBON_TOOL_BY_KEY: Record<string, ToolId> = {
  p: "pen",
  b: "pen", // Photoshop muscle memory (P stays primary; see SHORTCUT_ROWS)
  l: "line",
  s: "spline",
  r: "straightedge",
  c: "contour",
  g: "slope",
};

/** Tier-1 brush keys — eraser toggle, brush size down/up, colour swap. */
export const BRUSH_BY_KEY: Record<string, BrushAction> = {
  e: "eraser",
  "[": "size-down",
  "]": "size-up",
  x: "swap-colour",
};

export const SHORTCUT_ROWS: Array<{
  group: "View" | "Mode" | "Tool" | "Edit";
  keys: string;
  action: string;
}> = [
    { group: "View", keys: "1", action: "PLAN (orthographic top-down)" },
    { group: "View", keys: "2", action: "AXO (22° axonometric)" },
    { group: "View", keys: "3", action: "SEC (elevation / cross-section)" },
    { group: "View", keys: "4", action: "3D (perspective drone orbit)" },
    { group: "View", keys: "H (hold)", action: "Peek — fade chrome to read the drawing" },
    { group: "Mode", keys: "Shift+1", action: "Survey" },
    { group: "Mode", keys: "Shift+2", action: "Sketch" },
    { group: "Mode", keys: "Shift+3", action: "CAD" },
    { group: "Mode", keys: "Shift+4", action: "Elevation" },
    { group: "Mode", keys: "Shift+5", action: "Garden" },
    { group: "Mode", keys: "Shift+6", action: "Quote" },
    { group: "Mode", keys: "Shift+7", action: "Present" },
    { group: "Mode", keys: "Shift+8", action: "Share" },
    { group: "Tool", keys: "A", action: "Asset dock" },
    { group: "Tool", keys: "P / B", action: "Pen sketch" },
    { group: "Tool", keys: "L", action: "Line" },
    { group: "Tool", keys: "S", action: "Spline" },
    { group: "Tool", keys: "R", action: "Straightedge — place a ruler, draw along it" },
    { group: "Tool", keys: "C", action: "Contour" },
    { group: "Tool", keys: "G", action: "Slope" },
    { group: "Tool", keys: "E", action: "Eraser on/off" },
    { group: "Tool", keys: "[ / ]", action: "Brush size down / up" },
    { group: "Tool", keys: "X", action: "Swap current / previous colour" },
    { group: "Tool", keys: "M", action: "Measure tape" },
    { group: "Tool", keys: "U", action: "Underground" },
    { group: "Tool", keys: "D", action: "Working-drawing dims" },
    { group: "Tool", keys: "?", action: "This shortcut list" },
    { group: "Edit", keys: "Ctrl+K", action: "Command palette" },
    { group: "Edit", keys: "Ctrl+Z", action: "Undo" },
    { group: "Edit", keys: "Ctrl+Shift+Z", action: "Redo" },
    { group: "Edit", keys: "Esc", action: "Clear / cancel" },
    { group: "Edit", keys: "Delete", action: "Remove selection" },
  ];

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable === true
  );
}

export function resolveStudioShortcut(e: KeyboardEvent): StudioShortcut | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (isTypingTarget(e.target)) return null;

  if (e.key === "?" || (e.shiftKey && e.key === "/")) {
    return { kind: "tool", tool: "help" };
  }

  if (e.shiftKey && MODE_BY_SHIFT_DIGIT[e.key]) {
    return { kind: "mode", mode: MODE_BY_SHIFT_DIGIT[e.key]! };
  }

  if (!e.shiftKey && VIEWPORT_BY_DIGIT[e.key]) {
    return { kind: "viewport", preset: VIEWPORT_BY_DIGIT[e.key]! };
  }

  const letter = e.key.toLowerCase();
  // Ribbon tools first — the letter keys P/L/S/C/G own the ribbon's unified
  // tool state. Their legacy flag equivalents (e.g. S = sketch-ink) were
  // removed so the keyboard can never disagree with the ribbon.
  if (!e.shiftKey && RIBBON_TOOL_BY_KEY[letter]) {
    return { kind: "ribbon-tool", tool: RIBBON_TOOL_BY_KEY[letter]! };
  }
  // Tier-1 brush keys — [ ] are not letters and carry no other meaning;
  // E and X resolve here only when the ribbon tools did not take them.
  if (!e.shiftKey && BRUSH_BY_KEY[e.key]) {
    return { kind: "brush", action: BRUSH_BY_KEY[e.key]! };
  }
  if (!e.shiftKey && TOOL_BY_KEY[letter]) {
    return { kind: "tool", tool: TOOL_BY_KEY[letter]! };
  }

  return null;
}
