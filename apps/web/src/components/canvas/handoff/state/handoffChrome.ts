import type { StudioMode, StudioTool } from "../studioCatalog";

/**
 * Canvas-first progressive disclosure for HandoffDesignStudio.
 * Binding: docs/CAD-AI-2026-UX.md + docs/CANVAS-FIRST-UX.md.
 *
 * Disappearing UI: edge-to-edge drawing; tools at the prime pixel;
 * AI sidecar (right) + structure rail (left, collapsed); instruments on summon.
 * AI = intelligent intern — ghosts never silent-write (constraint-first).
 */
export type HandoffChrome = {
  /** Right utility hub — BOM / compliance (feeds the AI sidecar pattern) */
  utilityDrawer: boolean;
  /**
   * AI sidecar lane (right) — dialogue, variations, environmental analytics.
   * Today: utility hub + collapsed Live measures; not a canvas float.
   */
  aiSidecar: boolean;
  /**
   * Left structure rail — layers / constraints; collapsed until opened.
   * True when the layers control is available (not Fit / focus / client).
   */
  structureRail: boolean;
  /** Compact live cost total (same estimate engine; collapsed chrome) */
  liveBom: boolean;
  /** Preemptive horizon cards + canvas pins */
  horizon: boolean;
  /** Dynamic volumetric Isolith (stockpile contours on sheet margin) */
  volumeIsolith: boolean;
  /** Ambient budget margin + selection SKU trade tags */
  tradeMargin: boolean;
  /** Sun / growth scrubber (canvas float — prefer sidecar analytics) */
  sunGrowth: boolean;
  /** AI coach dock (canvas float — prefer Ask AI on selection / sidecar) */
  aiCoach: boolean;
  /** Ambient instruments (layers peel) — summon only */
  ambientRibbon: boolean;
  /** Selection radial ring + material fan at prime pixel */
  selectionRing: boolean;
  /** Left drawing tools implied by mode */
  drawTools: boolean;
  /** Collapse open utility sheets while Trace/Edit/Add/Measure */
  collapseUtility: boolean;
  /** Flora Ring / botanical suggestion HUD */
  floraRing: boolean;
  /**
   * Draft AI surface on the board (ghost review).
   * Off during Stage 1 / Fit sheet / focus — header Ask AI + Cmd+K + selection Ask.
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
  /** Operator opted into sun/shade mesh — surface the time scrubber. */
  shadeOn?: boolean;
};

const DRAWING_TOOLS: StudioTool[] = [
  "trace",
  "edit",
  "add",
  "paint",
  "zone",
  "measure",
];

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
    shadeOn = false,
  } = input;
  const drawingHot = DRAWING_TOOLS.includes(tool);
  const draftCrowded = pendingGhosts > 0;

  if (foundationCleanse) {
    const instruments = !frameOn && !clientView && !focusOn;
    return {
      utilityDrawer: false,
      aiSidecar: false,
      structureRail: instruments,
      liveBom: false,
      horizon: false,
      volumeIsolith: false,
      tradeMargin: false,
      sunGrowth: false,
      aiCoach: false,
      ambientRibbon: instruments,
      selectionRing: false,
      drawTools: instruments && mode !== "quote" && mode !== "share",
      collapseUtility: true,
      floraRing: false,
      draftSurface: false,
    };
  }

  // Fit sheet / focus / client — paper-first composition, no floating HUDs
  if (focusOn || clientView || frameOn) {
    return {
      utilityDrawer: false,
      aiSidecar: false,
      structureRail: false,
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
  /** Sun scrubber only when shade mesh is on — otherwise stays off the plane. */
  const sunScrubber = shadeOn && plan && !draftCrowded;
  const utility = cadLike && !draftCrowded;

  return {
    utilityDrawer: utility,
    /** Right lane for AI dialogue + analytics (utility + live measures). */
    aiSidecar: utility || mode === "quote",
    /** Left layers / constraints — available, collapsed until opened. */
    structureRail: plan,
    liveBom: cadLike || mode === "quote",
    // Monograph canvas — no floating consumer widgets on the drawing plane
    horizon: false,
    volumeIsolith: false,
    tradeMargin: false,
    sunGrowth: sunScrubber,
    aiCoach: false,
    ambientRibbon: plan,
    /** Near-object niche carousel + compact selection hub */
    selectionRing:
      mode === "cad" || mode === "sketch" || mode === "survey",
    drawTools: plan,
    collapseUtility: drawingHot || draftCrowded,
    floraRing: false,
    // Ghost review only when pending — HITL intern, not ambient toast
    draftSurface: plan && mode !== "survey" && draftCrowded,
  };
}
