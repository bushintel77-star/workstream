export type CanvasMode = "survey" | "sketch" | "cad" | "quote" | "share";

export const CANVAS_MODES: Array<{ id: CanvasMode; label: string }> = [
  { id: "survey", label: "Survey" },
  { id: "sketch", label: "Sketch" },
  { id: "cad", label: "CAD" },
  { id: "quote", label: "Quote" },
  { id: "share", label: "Share" },
];

export function parseCanvasMode(raw: string | null | undefined): CanvasMode {
  const v = (raw ?? "").toLowerCase();
  if (v === "survey" || v === "sketch" || v === "cad" || v === "quote" || v === "share") {
    return v;
  }
  return "cad";
}

/** Map legacy pipeline routes ? canvas mode query. */
export function modeForLegacyPath(pathname: string): CanvasMode {
  if (/\/survey\/?$/.test(pathname)) return "survey";
  if (/\/design\/(studio|develop)\/?$/.test(pathname)) return "sketch";
  if (/\/design\/cad\/?$/.test(pathname)) return "cad";
  if (/\/design\/?$/.test(pathname)) return "sketch";
  if (/\/(costing|design\/develop)\/?$/.test(pathname)) return "quote";
  if (/\/(outputs|audit)\/?$/.test(pathname)) return "share";
  if (/\/overview\/?$/.test(pathname)) return "cad";
  return "cad";
}
