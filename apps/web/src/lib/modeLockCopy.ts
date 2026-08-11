import type { CanvasMode } from "./canvas-mode";

/** Exact Tier-1 2026 progressive mode lock strings. */
export const MODE_LOCK_COPY = {
  surveyGate: "Complete survey and title boundary first.",
  quoteGate: "Accept CAD geometry before quoting.",
  presentGate: "Accept CAD geometry before presenting.",
  shareGate: "Cost something on the drawing before sharing.",
  fallback: "Complete the previous stage first.",
} as const;

export function lockReasonForMode(
  mode: CanvasMode,
  openModes: ReadonlySet<CanvasMode>,
): string | null {
  if (openModes.has(mode)) return null;
  if (mode === "sketch" || mode === "cad" || mode === "elevation" || mode === "garden") {
    return MODE_LOCK_COPY.surveyGate;
  }
  if (mode === "quote") return MODE_LOCK_COPY.quoteGate;
  if (mode === "present") return MODE_LOCK_COPY.presentGate;
  if (mode === "share") return MODE_LOCK_COPY.shareGate;
  return MODE_LOCK_COPY.fallback;
}
