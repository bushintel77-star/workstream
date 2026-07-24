import type { StudioMode, StudioTool } from "../studioCatalog";

/**
 * Canvas-first progressive disclosure for HandoffDesignStudio.
 * Binding: docs/STUDIO-STYLING-AND-UX.md + docs/CAD-AI-2026-UX.md + docs/CANVAS-FIRST-UX.md.
 *
 * Disappearing UI: edge-to-edge drawing; frost chrome on summon;
 * right data lane (one panel); left = tool tray + unified AssetPanel.
 * Asset library is never a separate frost popup (`inventoryPopup` always false).
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
   * @deprecated Unified AssetPanel owns the library. Always false — kept so
   * chrome callers/tests don't break during the collapse.
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
  /**
   * Inline Flora Ring session active (planting Add click).
   * Summons botanical HUD — never idle wallpaper.
   */
  floraSessionActive?: boolean;
  /**
   * Count of actionable foresight cards (drainage / TPZ / engineer).
   * Horizon docks only when > 0 (max 2 shown in UI).
   */
  horizonCardCount?: number;
};

/* Select is the ground state, not a drawing tool — it never collapses chrome. */
const DRAWING_TOOLS: StudioTool[] = [
  "trace",
  "add",
  "paint",
  "path",
  "zone",
  "measure",
];

function planModesAllowFlora(mode: StudioMode): boolean {
  return mode === "cad" || mode === "sketch" || mode === "survey";
}

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
    floraSessionActive = false,
    horizonCardCount = 0,
  } = input;
  const drawingHot = DRAWING_TOOLS.includes(tool);
  const draftCrowded = pendingGhosts > 0;
  /** Flora only when a session exists — never idle wallpaper. */
  const floraOn =
    floraSessionActive &&
    planModesAllowFlora(mode) &&
    !focusOn &&
    !frameOn &&
    !clientView &&
    !foundationCleanse;
  /** Horizon summoned by foresight cards only (UI caps at 2). */
  const horizonOn =
    horizonCardCount > 0 &&
    (mode === "cad" || mode === "sketch") &&
    !focusOn &&
    !frameOn &&
    !clientView &&
    !foundationCleanse &&
    !draftCrowded;

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

  const plan =
    mode !== "elevation" && mode !== "quote" && mode !== "share";

  // Fit sheet / focus — paper-first composition, no floating HUDs.
  // Client presentation keeps the sun scrubber when shade is armed (theatre).
  if (focusOn || frameOn) {
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

  if (clientView) {
    return {
      utilityDrawer: false,
      aiSidecar: false,
      structureRail: false,
      liveBom: false,
      horizon: false,
      volumeIsolith: false,
      tradeMargin: false,
      sunGrowth: shadeOn && plan,
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
    horizon: horizonOn,
    volumeIsolith: false,
    tradeMargin: false,
    sunGrowth: sunScrubber,
    aiCoach: false,
    ambientRibbon: plan,
    /** Orbit actions outside the glyph */
    selectionRing:
      mode === "cad" || mode === "sketch" || mode === "survey",
    /** Library lives in AssetPanel — never a separate frost popup. */
    inventoryPopup: false,
    drawTools: plan,
    collapseUtility: drawingHot || draftCrowded,
    floraRing: floraOn,
    // Ghost review only when pending — HITL intern, not ambient toast
    draftSurface: plan && mode !== "survey" && draftCrowded,
  };
}
