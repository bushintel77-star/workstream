import type { StudioMode, StudioTool } from "../studioCatalog";

/**
 * Canvas-first progressive disclosure for HandoffDesignStudio.
 * Binding: docs/STUDIO-STYLING-AND-UX.md + docs/CAD-AI-2026-UX.md + docs/CANVAS-FIRST-UX.md.
 *
 * Disappearing UI: edge-to-edge drawing; frost chrome on summon;
 * right data lane (one panel); left = tool tray only.
 * Inventory popup only while Add / Paint armed — never a fixed slab.
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
   * Right data lane available (Layers / Measures / Sites / Checklist).
   * True when the layers control is available (not Fit / focus / client).
   * Actual panel mounts exclusively via `rightDataPanel` (lane law).
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
  /** Ambient instruments — superseded by fixed ToolDock; flag still gates dock visibility. */
  ambientRibbon: boolean;
  /** Selection orbit (delete / lock / Ask AI) — outside the glyph */
  selectionRing: boolean;
  /**
   * Inventory frost popup — fold-out asset library (search + Draft kit +
   * catalog categories). True only while Add or Paint is armed — never a
   * fixed slab.
   */
  inventoryPopup: boolean;
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
  /**
   * Canvas-first: the measures / quantity data lane is summoned, not parked.
   * The AI/command core (Cmd+K, Ask AI, accepted proposals) raises it; idle
   * CAD stays a bare drawing. Default false = quiet canvas.
   */
  dataSummoned?: boolean;
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
    dataSummoned = false,
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
      inventoryPopup: false,
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
      inventoryPopup: false,
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
  /**
   * Data lane is available in CAD-like modes, but only mounts once summoned.
   * Canvas-first: the drawing owns idle; measures/quantities appear on ask.
   */
  const utility = cadLike && !draftCrowded && dataSummoned;

  return {
    utilityDrawer: utility,
    /** Right lane for AI dialogue + analytics — summoned, or the Quote surface. */
    aiSidecar: utility || mode === "quote",
    /** Right data lane affordance — Layers etc. available, collapsed until opened. */
    structureRail: plan,
    liveBom: cadLike || mode === "quote",
    // Monograph canvas — no floating consumer widgets on the drawing plane
    horizon: false,
    volumeIsolith: false,
    tradeMargin: false,
    sunGrowth: sunScrubber,
    aiCoach: false,
    ambientRibbon: plan,
    /** Orbit actions outside the glyph */
    selectionRing:
      mode === "cad" || mode === "sketch" || mode === "survey",
    /**
     * Frost inventory popup — Add only. Paint fills live in the persistent
     * SwatchTray furniture, so the popup no longer doubles for Paint.
     */
    inventoryPopup: plan && mode !== "sketch" && tool === "add",
    drawTools: plan,
    collapseUtility: drawingHot || draftCrowded,
    floraRing: false,
    // Ghost review only when pending — HITL intern, not ambient toast
    draftSurface: plan && mode !== "survey" && draftCrowded,
  };
}
