import type { CanvasMode } from "./canvas-mode";

/** Canvas-first progressive disclosure — which chrome may render. */
export type CanvasChrome = {
  surveyDock: boolean;
  sketchDock: boolean;
  cadDock: boolean;
  quoteDock: boolean;
  shareDock: boolean;
  /** Live BOM / QS financial HUD */
  liveBom: boolean;
  /** Clay walk overlay allowed (CAD / Quote / Share) */
  walk: boolean;
  /** Boundary lock/edit chrome */
  boundary: boolean;
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
      quoteDock: false,
      shareDock: false,
      liveBom: false,
      walk: false,
      boundary: false,
    };
  }

  return {
    surveyDock: mode === "survey",
    sketchDock: mode === "sketch" && hasSketchBundle,
    cadDock: mode === "cad",
    quoteDock: mode === "quote",
    shareDock: mode === "share",
    liveBom: mode === "cad" || mode === "quote",
    walk: mode === "cad" || mode === "quote" || mode === "share",
    boundary: mode === "survey" || (mode === "cad" && !cadDrawArmed),
  };
}
