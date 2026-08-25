/**
 * Gold Standard 2026 — Studio keyboard map (single source of truth).
 *
 * Viewport 1–4 already matched the ViewportTransitionHUD presets; canvas
 * modes use Shift+digit so they never steal those keys. Letter tools are
 * the everyday rail actions. Resolve is pure — the listener only applies.
 */

import type { CanvasMode } from "../../../lib/canvas-mode";

export type ViewportPreset = "plan" | "orbit" | "garden" | "elevation";
export type ToolAction =
  | "assets"
  | "measure"
  | "sketch-ink"
  | "underground"
  | "dims"
  | "help";

export type StudioShortcut =
  | { kind: "viewport"; preset: ViewportPreset }
  | { kind: "mode"; mode: CanvasMode }
  | { kind: "tool"; tool: ToolAction };

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
  "2": "orbit",
  "3": "garden",
  "4": "elevation",
};

export const TOOL_BY_KEY: Record<string, ToolAction> = {
  a: "assets",
  m: "measure",
  s: "sketch-ink",
  u: "underground",
  d: "dims",
  "?": "help",
};

export const SHORTCUT_ROWS: Array<{
  group: "View" | "Mode" | "Tool" | "Edit";
  keys: string;
  action: string;
}> = [
  { group: "View", keys: "1", action: "Plan (orthographic)" },
  { group: "View", keys: "2", action: "Orbit (perspective)" },
  { group: "View", keys: "3", action: "Garden eye-level" },
  { group: "View", keys: "4", action: "Elevation pitch" },
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
  { group: "Tool", keys: "S", action: "Sketch ink" },
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
  if (!e.shiftKey && TOOL_BY_KEY[letter]) {
    return { kind: "tool", tool: TOOL_BY_KEY[letter]! };
  }

  return null;
}
