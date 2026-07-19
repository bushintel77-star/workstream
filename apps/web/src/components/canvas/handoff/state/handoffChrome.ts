import type { StudioMode, StudioTool } from "../studioCatalog";

/**
 * Canvas-first progressive disclosure for HandoffDesignStudio.
 * Binding: docs/CANVAS-FIRST-UX.md + handoff README mandate.
 */
export type HandoffChrome = {
  /** Compliance + Live BOM utility hub */
  utilityDrawer: boolean;
  /** Compact live cost total (same estimate engine; collapsed chrome) */
  liveBom: boolean;
  /** Preemptive horizon cards + canvas pins */
  horizon: boolean;
  /** Sun / growth scrubber */
  sunGrowth: boolean;
  /** AI coach dock */
  aiCoach: boolean;
  /** Ambient left ribbon (layers / peel) */
  ambientRibbon: boolean;
  /** Selection radial ring */
  selectionRing: boolean;
  /** Left drawing tools implied by mode */
  drawTools: boolean;
  /** Collapse open utility sheets while Trace/Edit/Add/Measure */
  collapseUtility: boolean;
};

type Input = {
  mode: StudioMode;
  tool: StudioTool;
  focusOn: boolean;
  frameOn: boolean;
  clientView: boolean;
};

const DRAWING_TOOLS: StudioTool[] = ["trace", "edit", "add", "measure"];

/**
 * Pure chrome matrix — Survey → Sketch → CAD → Elevation → Quote.
 * Sketch never surfaces Quantity Survey / Live BOM.
 */
export function resolveHandoffChrome(input: Input): HandoffChrome {
  const { mode, tool, focusOn, frameOn, clientView } = input;
  const drawingHot = DRAWING_TOOLS.includes(tool);

  if (focusOn || clientView || frameOn) {
    return {
      utilityDrawer: false,
      liveBom: false,
      horizon: false,
      sunGrowth: false,
      aiCoach: false,
      ambientRibbon: !frameOn && !clientView,
      selectionRing: false,
      drawTools:
        !frameOn &&
        !clientView &&
        mode !== "quote" &&
        mode !== "share",
      collapseUtility: true,
    };
  }

  const plan =
    mode !== "elevation" && mode !== "quote" && mode !== "share";
  const cadLike = mode === "cad" || mode === "elevation";

  return {
    utilityDrawer: cadLike,
    liveBom: cadLike || mode === "quote",
    horizon: mode === "cad" && !drawingHot,
    sunGrowth: plan && mode !== "survey" && mode !== "sketch",
    aiCoach: plan && mode !== "survey",
    ambientRibbon: plan,
    selectionRing: mode === "cad" && !drawingHot,
    drawTools: plan,
    collapseUtility: drawingHot,
  };
}
