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
  /** Dynamic volumetric Isolith (stockpile contours on sheet margin) */
  volumeIsolith: boolean;
  /** Ambient budget margin + selection SKU trade tags */
  tradeMargin: boolean;
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
  /** Flora Ring / botanical suggestion HUD */
  floraRing: boolean;
};

type Input = {
  mode: StudioMode;
  tool: StudioTool;
  focusOn: boolean;
  frameOn: boolean;
  clientView: boolean;
  /** Stage 1 cadastral foundation — suppress AI/trade/veg chrome */
  foundationCleanse?: boolean;
};

const DRAWING_TOOLS: StudioTool[] = ["trace", "edit", "add", "measure"];

/**
 * Pure chrome matrix — Survey → Sketch → CAD → Elevation → Quote.
 * Sketch never surfaces Quantity Survey / Live BOM.
 */
export function resolveHandoffChrome(input: Input): HandoffChrome {
  const {
    mode,
    tool,
    focusOn,
    frameOn,
    clientView,
    foundationCleanse = false,
  } = input;
  const drawingHot = DRAWING_TOOLS.includes(tool);

  if (foundationCleanse) {
    return {
      utilityDrawer: false,
      liveBom: false,
      horizon: false,
      volumeIsolith: false,
      tradeMargin: false,
      sunGrowth: false,
      // Coach dock off — Stage 1 status lives in the draft chip / banner
      aiCoach: false,
      ambientRibbon: !frameOn && !clientView,
      selectionRing: false,
      drawTools: !frameOn && !clientView && mode !== "quote" && mode !== "share",
      collapseUtility: true,
      floraRing: false,
    };
  }

  if (focusOn || clientView || frameOn) {
    return {
      utilityDrawer: false,
      liveBom: false,
      horizon: false,
      // Fit sheet keeps Isolith / trade margin; cost dock stays frozen
      volumeIsolith: mode === "cad" && frameOn && !clientView && !focusOn,
      tradeMargin: mode === "cad" && frameOn && !clientView && !focusOn,
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
      floraRing: !frameOn && !clientView && !focusOn,
    };
  }

  const plan =
    mode !== "elevation" && mode !== "quote" && mode !== "share";
  const cadLike = mode === "cad" || mode === "elevation";

  return {
    utilityDrawer: cadLike,
    liveBom: cadLike || mode === "quote",
    horizon: mode === "cad" && !drawingHot,
    // Isolith + trade margin stay live while Add/Edit (unlike conversational horizon)
    volumeIsolith: mode === "cad",
    tradeMargin: mode === "cad",
    sunGrowth: plan && mode !== "survey" && mode !== "sketch",
    aiCoach: plan && mode !== "survey",
    ambientRibbon: plan,
    selectionRing: mode === "cad" && !drawingHot,
    drawTools: plan,
    collapseUtility: drawingHot,
    floraRing: plan && mode !== "survey",
  };
}
