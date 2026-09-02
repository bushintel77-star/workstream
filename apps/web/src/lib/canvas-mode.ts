export type CanvasMode =
  | "survey"
  | "sketch"
  | "cad"
  | "elevation"
  | "quote"
  | "present"
  | "share"
  | "garden";

export const CANVAS_MODES: Array<{ id: CanvasMode; label: string }> = [
  { id: "survey", label: "Survey" },
  { id: "sketch", label: "Sketch" },
  { id: "cad", label: "CAD" },
  { id: "elevation", label: "Elevation" },
  { id: "garden", label: "Garden" },
  { id: "quote", label: "Quote" },
  { id: "present", label: "Present" },
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
 * Sketch is always open — "drawing must never wait on setup" (turn 15).
 * CAD opens after aerial/title (the Fit sheet line-draw surface needs a
 * scaled board). Quote needs accepted CAD; Present opens with CAD too;
 * Share needs a live costed BOM.
 */
export function unlockedModes(progress: CanvasProgress): Set<CanvasMode> {
  const open = new Set<CanvasMode>(["survey", "sketch"]);
  if (progress.hasAerial) {
    open.add("cad");
    open.add("elevation");
    open.add("garden");
  }
  if (progress.hasCad) {
    open.add("quote");
    open.add("present");
  }
  if (progress.hasQuote) {
    open.add("share");
  }
  return open;
}

/** Suggested next mode for empty `?mode=` or after completing a step.
 *  Sketch is the default landing mode — a blank project lands in Sketch,
 *  not Survey, so the operator can draw immediately (turn 15). */
export function suggestedMode(progress: CanvasProgress): CanvasMode {
  if (!progress.hasSketch) return "sketch";
  if (!progress.hasAerial) return "survey";
  if (!progress.hasCad) return "cad";
  if (!progress.hasQuote) return "quote";
  return "share";
}

export function parseCanvasMode(raw: string | null | undefined): CanvasMode | null {
  const v = (raw ?? "").toLowerCase();
  if (v === "survey" || v === "sketch" || v === "cad" || v === "elevation" || v === "quote" || v === "present" || v === "share" || v === "garden") {
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
  if (/\/(overview|processing|tasks|recordings|carbon)\/?$/.test(pathname)) {
    return "sketch";
  }
  return "sketch";
}

/**
 * Every canvas mode mounts natively in the WebGL studio (tool rail, glass
 * cards, or a mounted shared feature module per ARCHITECTURE §5). The
 * legacy SVG studio was retired 2026-08-19 — the WebGL surface is the only
 * mount and mode routing never leaves it.
 */
const WEBGL_STUDIO_MODES: ReadonlySet<CanvasMode> = new Set([
  "survey",
  "sketch",
  "cad",
  "elevation",
  "garden",
  "quote",
  "present",
  "share",
]);

export function webglStudioSupportsMode(mode: CanvasMode): boolean {
  return WEBGL_STUDIO_MODES.has(mode);
}
