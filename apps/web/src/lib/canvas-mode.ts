export type CanvasMode =
  | "survey"
  | "sketch"
  | "cad"
  | "elevation"
  | "quote"
  | "share";

export const CANVAS_MODES: Array<{ id: CanvasMode; label: string }> = [
  { id: "survey", label: "Survey" },
  { id: "sketch", label: "Sketch" },
  { id: "cad", label: "CAD" },
  { id: "elevation", label: "Elevation" },
  { id: "quote", label: "Quote" },
  { id: "share", label: "Share" },
];

export type CanvasProgress = {
  hasAerial: boolean;
  hasSketch: boolean;
  hasCad: boolean;
  hasQuote: boolean;
};

/**
 * Progressive unlock:
 * Sketch + CAD both open after aerial/title (CAD is the Fit sheet line-draw surface).
 * Quote needs accepted CAD; Share needs a live costed BOM (or persisted quote).
 */
export function unlockedModes(progress: CanvasProgress): Set<CanvasMode> {
  const open = new Set<CanvasMode>(["survey"]);
  if (progress.hasAerial) {
    open.add("sketch");
    open.add("cad");
    open.add("elevation");
  }
  if (progress.hasCad) open.add("quote");
  if (progress.hasQuote) open.add("share");
  return open;
}

/** Suggested next mode for empty `?mode=` or after completing a step. */
export function suggestedMode(progress: CanvasProgress): CanvasMode {
  if (!progress.hasAerial) return "survey";
  if (!progress.hasCad) return "cad";
  if (!progress.hasQuote) return "quote";
  return "share";
}

export function parseCanvasMode(raw: string | null | undefined): CanvasMode | null {
  const v = (raw ?? "").toLowerCase();
  if (v === "survey" || v === "sketch" || v === "cad" || v === "elevation" || v === "quote" || v === "share") {
    return v;
  }
  return null;
}

export function resolveCanvasMode(
  raw: string | null | undefined,
  progress: CanvasProgress,
): CanvasMode {
  const requested = parseCanvasMode(raw);
  const unlocked = unlockedModes(progress);
  if (requested && unlocked.has(requested)) return requested;
  if (requested && !unlocked.has(requested)) return suggestedMode(progress);
  return suggestedMode(progress);
}

/** Map legacy pipeline routes to canvas mode query. */
export function modeForLegacyPath(pathname: string): CanvasMode {
  if (/\/survey\/?$/.test(pathname)) return "survey";
  if (/\/design\/develop\/?$/.test(pathname)) return "quote";
  if (/\/design\/studio\/?$/.test(pathname)) return "sketch";
  if (/\/design\/cad\/?$/.test(pathname)) return "cad";
  if (/\/design\/?$/.test(pathname)) return "sketch";
  if (/\/costing\/?$/.test(pathname)) return "quote";
  if (/\/(outputs|audit|filing)\/?$/.test(pathname)) return "share";
  if (/\/(overview|processing|tasks|recordings|measurements|carbon)\/?$/.test(pathname)) {
    return "sketch";
  }
  return "sketch";
}
