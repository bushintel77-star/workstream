import type { CanvasMode } from "./canvas-mode";

export const MODE_LOCK_COPY = {
  surveyGate: "Complete survey and title boundary first.",
  quoteGate: "Accept CAD geometry before quoting.",
  presentGate: "Accept CAD geometry before presenting.",
  shareGate: "Cost something on the drawing before sharing.",
  fallback: "Complete the previous stage first.",
} as const;

export type ModeLockAction = {
  reason: string;
  destination: CanvasMode;
  actionLabel: string;
};

export function modeLockAction(
  mode: CanvasMode,
  openModes: ReadonlySet<CanvasMode>,
): ModeLockAction | null {
  if (openModes.has(mode)) return null;
  if (mode === "sketch" || mode === "cad" || mode === "elevation" || mode === "garden") {
    return { reason: MODE_LOCK_COPY.surveyGate, destination: "survey", actionLabel: "Open Survey" };
  }
  if (mode === "quote") {
    return { reason: MODE_LOCK_COPY.quoteGate, destination: "cad", actionLabel: "Open CAD" };
  }
  if (mode === "present") {
    return { reason: MODE_LOCK_COPY.presentGate, destination: "cad", actionLabel: "Open CAD" };
  }
  if (mode === "share") {
    return { reason: MODE_LOCK_COPY.shareGate, destination: "quote", actionLabel: "Open Quote" };
  }
  return { reason: MODE_LOCK_COPY.fallback, destination: "survey", actionLabel: "Open Survey" };
}

export function lockReasonForMode(
  mode: CanvasMode,
  openModes: ReadonlySet<CanvasMode>,
): string | null {
  return modeLockAction(mode, openModes)?.reason ?? null;
}
