import type { CanvasMode } from "./canvas-mode";

/** Canvas-first progressive disclosure — which chrome may render. */
export type CanvasChrome = {
  surveyDock: boolean;
  sketchDock: boolean;
  cadDock: boolean;
  elevationDock: boolean;
  quoteDock: boolean;
  shareDock: boolean;
  /** Live BOM / QS financial HUD */
  liveBom: boolean;
  /** Compliance stats dock (independent of council layer opacity) */
  complianceDock: boolean;
  /** Sun & growth scrubber */
  sunGrowthDock: boolean;
  /** Clay walk overlay allowed (CAD / Quote / Share) */
  walk: boolean;
  /** Boundary lock/edit chrome */
  boundary: boolean;
  /** Left tool rail */
  toolRail: boolean;
};

type ChromeInput = {
  mode: CanvasMode;
  titleRevealActive: boolean;
  hasSketchBundle: boolean;
  /** CAD line draw armed — hide boundary chrome while drawing. */
  cadDrawArmed: boolean;
};

/**
 * Pure chrome matrix for Survey → Sketch → CAD → Quote → Share.
 * Binding: docs/CANVAS-FIRST-UX.md
 */
export function resolveCanvasChrome(input: ChromeInput): CanvasChrome {
  const { mode, titleRevealActive, hasSketchBundle, cadDrawArmed } = input;
  if (titleRevealActive) {
    return {
      surveyDock: false,
      sketchDock: false,
      cadDock: false,
      elevationDock: false,
      quoteDock: false,
      shareDock: false,
      liveBom: false,
      complianceDock: false,
      sunGrowthDock: false,
      walk: false,
      boundary: false,
      toolRail: false,
    };
  }

  return {
    surveyDock: mode === "survey",
    sketchDock: mode === "sketch" && hasSketchBundle,
    cadDock: mode === "cad",
    elevationDock: mode === "elevation",
    quoteDock: mode === "quote",
    shareDock: mode === "share",
    liveBom: mode === "cad" || mode === "quote" || mode === "elevation",
    complianceDock:
      mode === "survey" ||
      mode === "cad" ||
      mode === "elevation" ||
      mode === "quote",
    sunGrowthDock:
      mode === "survey" ||
      mode === "sketch" ||
      mode === "cad" ||
      mode === "elevation",
    walk: mode === "cad" || mode === "quote" || mode === "share",
    boundary: mode === "survey" || (mode === "cad" && !cadDrawArmed),
    toolRail:
      mode === "survey" ||
      mode === "cad" ||
      mode === "sketch" ||
      mode === "elevation",
  };
}
