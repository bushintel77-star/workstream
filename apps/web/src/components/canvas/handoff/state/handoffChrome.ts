import type { StudioMode, StudioTool } from "../studioCatalog";

/**
 * Canvas-first progressive disclosure for HandoffDesignStudio.
 * Binding: docs/CANVAS-FIRST-UX.md + handoff README mandate.
 *
 * Monograph rule: floating consumer docks (AI coach, sun scrubber, trade
 * pills) stay off the vector plane — telemetry lives in the right utility hub.
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
  /** Sun / growth scrubber (canvas float — prefer utility hub) */
  sunGrowth: boolean;
  /** AI coach dock (canvas float — prefer Ask AI / utility) */
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
  /**
   * Draft AI surface on the board (status bar, ghost toast, review panel).
   * Off during Stage 1 / Fit sheet / focus — use header Ask AI + Cmd+K only.
   */
  draftSurface: boolean;
};

type Input = {
  mode: StudioMode;
  tool: StudioTool;
  focusOn: boolean;
  frameOn: boolean;
  clientView: boolean;
  /** Stage 1 cadastral foundation — suppress AI/trade/veg chrome */
  foundationCleanse?: boolean;
  /** Quiet Cad when unverified AI ghosts are pending */
  pendingGhosts?: number;
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
    pendingGhosts = 0,
  } = input;
  const drawingHot = DRAWING_TOOLS.includes(tool);
  const draftCrowded = pendingGhosts > 0;

  if (foundationCleanse) {
    return {
      utilityDrawer: false,
      liveBom: false,
      horizon: false,
      volumeIsolith: false,
      tradeMargin: false,
      sunGrowth: false,
      aiCoach: false,
      ambientRibbon: !frameOn && !clientView && !focusOn,
      selectionRing: false,
      drawTools: !frameOn && !clientView && !focusOn && mode !== "quote" && mode !== "share",
      collapseUtility: true,
      floraRing: false,
      draftSurface: false,
    };
  }

  // Fit sheet / focus / client — paper-first composition, no floating HUDs
  if (focusOn || clientView || frameOn) {
    return {
      utilityDrawer: false,
      liveBom: false,
      horizon: false,
      volumeIsolith: false,
      tradeMargin: false,
      sunGrowth: false,
      aiCoach: false,
      ambientRibbon: false,
      selectionRing: false,
      drawTools: false,
      collapseUtility: true,
      floraRing: false,
      draftSurface: false,
    };
  }

  const plan =
    mode !== "elevation" && mode !== "quote" && mode !== "share";
  const cadLike = mode === "cad" || mode === "elevation";

  return {
    utilityDrawer: cadLike && !draftCrowded,
    liveBom: cadLike || mode === "quote",
    // Monograph canvas — no floating consumer widgets on the drawing plane
    horizon: false,
    volumeIsolith: false,
    tradeMargin: false,
    sunGrowth: false,
    aiCoach: false,
    ambientRibbon: plan,
    selectionRing: false,
    drawTools: plan,
    collapseUtility: drawingHot || draftCrowded,
    floraRing: false,
    // Ghost review only when user opens it — no ambient toast/status bar
    draftSurface: plan && mode !== "survey" && draftCrowded,
  };
}
