"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  buildIndicativeShadeGrid,
  countNearbyCanopy,
  evaluateStudioCompliance,
  FLORA_HEIGHT_BY_FORM,
  isFloraStudioForm,
  rankCurtisFloraCandidates,
  sunHoursAtPct,
  tidySketchStrokes,
  type FloraCandidate,
  type StudioComplianceItem,
  type StudioHorizonCard,
} from "@workstream/domain";
import type {
  CatalogPlacement,
  CanvasStroke,
  DesignSiteFrame,
  IrrigationZone,
  IrrigationZoneKind,
} from "@workstream/contracts";
import { saveDesignCanvasAction } from "../../../../app/actions";
import { useStudioEstimate } from "../../../../lib/use-studio-estimate";
import type { StudioEstimateArgs } from "../../../../lib/studio-estimate-worker-types";
import { playMaterialFoley } from "../features/ambient/materialFoley";
import {
  sunDateFromPreset,
  type SunDatePreset,
} from "../features/sunGrowth/sunDatePreset";
import { buildWorkableSiteSchedule } from "../geometry/workableCanvas";
import {
  BY_TYPE,
  STUDIO_SITES,
  WRIGHTS_SEED,
  type SketchStroke,
  type StudioItem,
  type StudioItemType,
  type StudioMode,
  type StudioTool,
} from "../studioCatalog";
import type { PaperSize, PctPoint } from "../geometry";
import { classifySurveyCorridor } from "../geometry/surveyCorridor";
import { pointInPolygon } from "../geometry/polygon";
import {
  constrainAssetCentre,
  outdoorFocusView,
  sanitizeItemsToOutdoor,
} from "../geometry/outdoorClamp";
import {
  GRID_STEP_PCT,
  snapClockRotationDeg,
  snapToGridPct,
} from "../geometry/snap";
import { markStaleGhostsNearEdit } from "./staleGhosts";
import {
  canvasToStrokes,
  itemsToPlacements,
  placementsToItems,
  resolveHydratedBuilding,
  siteFrameToSnapshot,
  snapshotToSiteFrame,
  strokesToCanvas,
  withContractIds,
} from "./canvasBridge";
import {
  acceptAllProposals,
  acceptProposal,
  buildHandoffCoaching,
  draftStatus,
  maybeAutoProposeAfterCommit,
  mergeAiProposals,
  proposeFromAssistQuery,
  proposeFromCadSuggestions,
  proposeFromCanopyImage,
  proposeFromStrokes,
  proposeLayoutFromSnapshot,
  proposalsFromApiSuggestions,
  rejectProposal,
} from "./studioAiEngine";
import {
  DEFAULT_LAYER_OPACITY,
  DESIGN_LAYER_PRESET,
  SURVEY_LAYER_PRESET,
  type GrowthStage,
  type LayerKey,
  type LayerOpacity,
  type StudioSnapshot,
  type TraceTarget,
} from "./studioTypes";
import { canvasMetresRingToPct } from "../geometry/geoToPct";
import { reprojectDocToBoundary } from "../geometry/reprojectToBoundary";
import {
  clampVegetationElevationScale,
  clearBoundaryLikeSketches,
  isSpatialCorrectionQuery,
  isStage1FoundationQuery,
  sieveVegetationItems,
} from "./spatialCorrection";
import { isDraftingPlate } from "./studioPlane";
import { boardScaleM } from "../features/ground/groundMetrics";
import {
  SHEET_SCALE_STEPS,
  type SheetScaleDenom,
} from "../geometry/sheetContentView";
import {
  classifyHistoryProvenance,
  type HistoryProvenance,
} from "./historyProvenance";
import {
  buildSessionRejectionPrompt,
  filterProposalsBySessionRejections,
  type RejectionReason,
  type SessionRejectionHint,
} from "./sessionRejectionHints";

function toComplianceItems(items: StudioItem[]): StudioComplianceItem[] {
  return items.map((i) => {
    const d = BY_TYPE[i.t];
    return {
      id: i.id,
      t: i.t,
      x: i.x,
      y: i.y,
      scale: i.scale,
      ghost: i.ghost,
      dbhM: i.dbhM ?? d.dbhM,
      canopyM: d.canopyM,
      wPx: d.w,
      hPx: d.h,
      areaKind: d.area ?? "none",
    };
  });
}

const MAX_HIST = 40;

type Doc = StudioSnapshot & {
  idn: number;
  hist: StudioSnapshot[];
  redo: StudioSnapshot[];
  histProvenance: HistoryProvenance[];
  redoProvenance: HistoryProvenance[];
};

type Ui = {
  mode: StudioMode;
  tool: StudioTool;
  locked: boolean;
  frameOn: boolean;
  paper: PaperSize;
  sheetElevOn: boolean;
  darkOn: boolean;
  focusOn: boolean;
  clientView: boolean;
  layersOpen: boolean;
  layerOpacity: LayerOpacity;
  isolatedLayer: LayerKey | null;
  /** Services layer authoring on the CAD canvas (Servc / Level / Calibrate). */
  servicesEdit: boolean;
  setbackOn: boolean;
  /** Indicative sun-hours mesh on the % board. */
  shadeOn: boolean;
  growth: GrowthStage;
  sunMin: number;
  sunDatePreset: SunDatePreset;
  elevAxis: "x" | "y";
  selectedId: string | null;
  groupIds: string[];
  hoverId: string | null;
  ghostIdx: number;
  factorsOpen: boolean;
  ghostReviewOpen: boolean;
  /** First reject opens optional session-only steering reasons. */
  rejectReasonId: string | null;
  cmdOpen: boolean;
  cmdQuery: string;
  sitesOpen: boolean;
  addOpen: boolean;
  armed: StudioItemType | null;
  mitigated: Record<string, boolean>;
  coachStep: number;
  drawPoly: PctPoint[] | null;
  drawCursor: PctPoint | null;
  traceTarget: TraceTarget;
  zoneKind: IrrigationZoneKind;
  /** Drafting grid grain for snap + visible mesh. */
  gridGrain: "fine" | "medium" | "coarse";
  /** Magnetic grid snap while dragging / nudging. */
  gridSnap: boolean;
  /** Visual mesh formation (ortho / dots / diamond / veil). */
  gridFormation: "ortho" | "dots" | "diamond" | "veil";
  /** Mesh ink — eye comfort + optional signal accent. */
  gridInk: "charcoal" | "slate" | "paper" | "mist" | "signal";
  /** Active Paint swatch (Mac Paint–style fill). */
  paintSwatch: StudioItemType;
  siteIdx: number;
  canopyScanning: boolean;
  sunPlay: boolean;
  zoom: number;
  /** Zoom origin on the board (%) — outdoor remnant centre after Fit. */
  focusX: number;
  focusY: number;
  /**
   * Drag-to-pan offset in px, applied as `translate()` alongside the zoom
   * `scale()` — independent of focusX/focusY (which anchor zoom, not pan).
   * Always 0 while `frameOn` (Fit sheet owns its own fixed layout).
   */
  panX: number;
  panY: number;
  /**
   * CAD camera rotation (deg clockwise from north-up). Geometry coords never
   * change — only the viewport transform. Increment steps only (15/45/90).
   */
  viewRotationDeg: number;
  /** Active CAD view-rotation step size. */
  viewRotationStepDeg: 15 | 45 | 90;
  /**
   * View-only tilt lens (deg). 0 = flat / identical to pre-feature camera.
   * Ctrl/Cmd+drag continuous 0→60; Cmd+K / client view settle at 55.
   */
  tiltDeg: number;
  savedTick: number;
  /** Monotonic canvas revision after each successful autosave. */
  saveRevision: number;
  aerialUri: string | null;
  aiBusy: "idle" | "scanning" | "assisting";
  coachOpen: boolean;
  /** Last natural-language assist reply shown in the coach rail. */
  assistReply: string | null;
  /** Right-hand utility drawer sheet: compliance | bom | closed. */
  utilityPanel: "compliance" | "bom" | null;
  /**
   * Canvas-first: measures / quantity lane summoned via the AI command core.
   * Idle CAD stays a bare drawing; false = quiet canvas.
   */
  dataSummoned: boolean;
  /** Brief setback / TPZ / easement tip after a preemptive snap. */
  councilTip: string | null;
  /** Authored DBH (m) for next existing-tree placement — drives AS 4970 TPZ. */
  existDbhM: number;
  /**
   * Fit-sheet architectural scale denominator (1:N).
   * Snaps along SHEET_SCALE_STEPS — canvas is the print sheet.
   */
  sheetScaleDenom: SheetScaleDenom;
  /**
   * Optional board-width metres from survey Calib (two known points).
   * When set, overrides sheetScaleDenom-derived scale for dims / fall %.
   */
  boardWidthM: number | null;
  /**
   * Parchment underlay strength when aerial is present (0 = survey-sharp,
   * 1 = soft drafting table). Canvas-first: peel, don't void.
   */
  parchmentPeel: number;
  /** Durable DesignCanvas autosave status. */
  saveStatus: "idle" | "saving" | "retrying" | "saved" | "error";
  /** Inline Flora Ring session (planting Add click). */
  floraSession: {
    x: number;
    y: number;
    candidates: FloraCandidate[];
    activeIdx: number;
    maxHeightM: number;
  } | null;
  /**
   * Stage 1 CAD title overlay — Vicmap snap + charcoal boundary.
   * AI intelligence layer stays underneath (not purged).
   */
  foundationCleanse: boolean;
  /**
   * Title CAD nodes locked (no drag). Unlock to snap/drag vertices;
   * Lock commits Vicmap/manual geometry with edge metadata.
   */
  titleBoundaryLocked: boolean;
  /** Provenance of the active title polygon. */
  boundarySource: "vicmap" | "manual" | "seed";
  /**
   * After Stage 1 / aerial purge — block re-injection of project aerial
   * until the operator explicitly drops imagery again.
   */
  aerialSuppressed: boolean;
};

/** Prahran / Stonnington demo centroid for indicative shade grid. */
const FLORA_SHADE_LAT = -37.849;
const FLORA_SHADE_LNG = 144.993;

type State = {
  doc: Doc;
  ui: Ui;
  /** Per-site snapshots so switching restores full drawing state. */
  siteSnaps: StudioSnapshot[];
};

type Action =
  | { type: "mutate"; fn: (snap: StudioSnapshot, idn: number) => { snap: StudioSnapshot; idn?: number } }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "setUi"; patch: Partial<Ui> }
  | { type: "setMode"; mode: StudioMode }
  | { type: "setLayerOpacity"; key: LayerKey; value: number }
  | { type: "switchSite"; idx: number }
  | { type: "resetSite" }
  | {
      type: "silentIds";
      items: StudioItem[];
      strokes: SketchStroke[];
    };

function cloneSnap(s: StudioSnapshot): StudioSnapshot {
  return JSON.parse(JSON.stringify(s)) as StudioSnapshot;
}

function snapOf(doc: Doc): StudioSnapshot {
  return {
    boundary: doc.boundary,
    building: doc.building,
    items: doc.items,
    easements: doc.easements,
    strokes: doc.strokes,
    levels: doc.levels,
    services: doc.services,
    irrigationZones: doc.irrigationZones ?? [],
  };
}

function seedToSnap(seed: (typeof STUDIO_SITES)[number]["seed"]): StudioSnapshot {
  return {
    boundary: seed.boundary.map((p) => ({ ...p })),
    building: seed.building.map((p) => ({ ...p })),
    items: seed.items.map((i) => ({ ...i })),
    easements: [],
    strokes: [],
    levels: [],
    services: [],
    irrigationZones: [],
  };
}

function initialState(opts: {
  mode: StudioMode;
  placements?: CatalogPlacement[];
  strokes?: CanvasStroke[];
  siteFrame?: DesignSiteFrame | null;
  irrigationZones?: IrrigationZone[];
}): State {
  const seed = WRIGHTS_SEED;
  const siteSnaps = STUDIO_SITES.map((s) => seedToSnap(s.seed));
  const base = seedToSnap(seed);
  const frameOverlay = siteFrameToSnapshot(opts.siteFrame);
  const hasCanvas =
    (opts.placements?.length ?? 0) > 0 ||
    (opts.strokes?.length ?? 0) > 0 ||
    (opts.irrigationZones?.length ?? 0) > 0 ||
    Boolean(frameOverlay.boundary);
  const snap: StudioSnapshot = hasCanvas
    ? {
        ...base,
        ...frameOverlay,
        building: resolveHydratedBuilding(
          opts.siteFrame,
          frameOverlay.building,
          base.building,
        ),
        items: placementsToItems(opts.placements ?? []),
        strokes: canvasToStrokes(opts.strokes ?? []),
        easements: frameOverlay.easements ?? base.easements,
        services: frameOverlay.services ?? base.services,
        levels: frameOverlay.levels ?? base.levels,
        irrigationZones: opts.irrigationZones ?? [],
      }
    : base;
  const outdoorSafe: StudioSnapshot = {
    ...snap,
    items: sanitizeItemsToOutdoor(snap.items, snap.boundary, snap.building),
  };
  return {
    doc: {
      ...outdoorSafe,
      idn: 20,
      hist: [],
      redo: [],
      histProvenance: [],
      redoProvenance: [],
    },
    siteSnaps,
    ui: {
      mode: opts.mode,
      tool: "pan",
      locked: false,
      frameOn: false,
      paper: "a3",
      sheetElevOn: false,
      darkOn: false,
      focusOn: false,
      clientView: false,
      layersOpen: false,
      layerOpacity: { ...DEFAULT_LAYER_OPACITY },
      isolatedLayer: null,
      setbackOn: false,
      shadeOn: false,
      growth: "mature",
      sunMin: 12 * 60 + 26,
      sunDatePreset: "today",
      elevAxis: "x",
      selectedId: null,
      groupIds: [],
      hoverId: null,
      ghostIdx: 0,
      factorsOpen: false,
      ghostReviewOpen: false,
      rejectReasonId: null,
      cmdOpen: false,
      cmdQuery: "",
      sitesOpen: false,
      addOpen: false,
      armed: null,
      mitigated: {},
      coachStep: -1,
      drawPoly: null,
      drawCursor: null,
      traceTarget: "boundary",
      zoneKind: "drip",
      gridGrain: "medium",
      gridSnap: true,
      gridFormation: "ortho",
      gridInk: "charcoal",
      paintSwatch: "lawn",
      siteIdx: 0,
      canopyScanning: false,
      sunPlay: false,
      zoom: 1,
      focusX: 50,
      focusY: 50,
      panX: 0,
      panY: 0,
      viewRotationDeg: 0,
      viewRotationStepDeg: 15,
      tiltDeg: 0,
      savedTick: 0,
      saveRevision: hasCanvas ? 1 : 0,
      aerialUri: null,
      aiBusy: "idle",
      coachOpen: false,
      assistReply: null,
      utilityPanel: null,
      dataSummoned: false,
      councilTip: null,
      existDbhM: BY_TYPE.exist.dbhM ?? 0.45,
      servicesEdit: false,
      sheetScaleDenom: 100,
      boardWidthM: null,
      parchmentPeel: 0.42,
      saveStatus: hasCanvas ? "saved" : "idle",
      floraSession: null,
      foundationCleanse: false,
      titleBoundaryLocked: false,
      boundarySource: "seed",
      // Never auto-inject Mapbox/survey static aerial — optional upload only
      // (matches curtis-co prototype: parchment drafting plate by default).
      aerialSuppressed: true,
    },
  };
}

export type UseStudioStateOpts = {
  initialMode?: StudioMode;
  projectId: string;
  address: string;
  aerialUri?: string | null;
  outdoorM2?: number;
  initialPlacements?: CatalogPlacement[];
  initialStrokes?: CanvasStroke[];
  /** Durable title/survey frame from DesignCanvas.site_frame. */
  initialSiteFrame?: DesignSiteFrame | null;
  /** Authored drip / lighting zones from DesignCanvas.irrigation_zones. */
  initialIrrigationZones?: IrrigationZone[];
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "mutate": {
      const before = snapOf(state.doc);
      const result = action.fn(cloneSnap(before), state.doc.idn);
      const provenance = classifyHistoryProvenance(
        before.items,
        result.snap.items,
      );
      let nextItems = markStaleGhostsNearEdit(before.items, result.snap.items);
      const hist = [...state.doc.hist, before].slice(-MAX_HIST);
      return {
        ...state,
        doc: {
          ...result.snap,
          items: nextItems,
          idn: result.idn ?? state.doc.idn,
          hist,
          redo: [],
          histProvenance: [...state.doc.histProvenance, provenance].slice(
            -MAX_HIST,
          ),
          redoProvenance: [],
        },
      };
    }
    case "undo": {
      if (state.doc.hist.length === 0) return state;
      const hist = [...state.doc.hist];
      const prev = hist.pop()!;
      const histProvenance = [...state.doc.histProvenance];
      const provenance = histProvenance.pop() ?? "manual";
      const current = snapOf(state.doc);
      return {
        ...state,
        doc: {
          ...state.doc,
          ...prev,
          hist,
          redo: [...state.doc.redo, current].slice(-MAX_HIST),
          histProvenance,
          redoProvenance: [
            ...state.doc.redoProvenance,
            provenance,
          ].slice(-MAX_HIST),
        },
      };
    }
    case "redo": {
      if (state.doc.redo.length === 0) return state;
      const redo = [...state.doc.redo];
      const next = redo.pop()!;
      const redoProvenance = [...state.doc.redoProvenance];
      const provenance = redoProvenance.pop() ?? "manual";
      const current = snapOf(state.doc);
      return {
        ...state,
        doc: {
          ...state.doc,
          ...next,
          hist: [...state.doc.hist, current].slice(-MAX_HIST),
          redo,
          histProvenance: [
            ...state.doc.histProvenance,
            provenance,
          ].slice(-MAX_HIST),
          redoProvenance,
        },
      };
    }
    case "setUi":
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case "setMode": {
      // Stage 1 keeps CAD title overlay across tabs — AI layer stays available.
      const enteringSurvey = action.mode === "survey";
      const leavingSurvey = state.ui.mode === "survey" && action.mode !== "survey";
      let layerOpacity = state.ui.layerOpacity;
      if (enteringSurvey && !state.ui.foundationCleanse) {
        layerOpacity = { ...SURVEY_LAYER_PRESET };
      }
      if (leavingSurvey && !state.ui.foundationCleanse) {
        layerOpacity = { ...DESIGN_LAYER_PRESET };
      }
      // CAD / sketch are parchment drafting plates — no aerial underlay.
      // Survey may keep an optional user-uploaded screenshot only.
      const drafting = isDraftingPlate(action.mode);
      return {
        ...state,
        ui: {
          ...state.ui,
          mode: action.mode,
          layerOpacity,
          isolatedLayer: null,
          drawPoly: null,
          drawCursor: null,
          ...(drafting
            ? { aerialUri: null, aerialSuppressed: true }
            : action.mode === "survey"
              ? { aerialSuppressed: true }
              : {}),
          tool:
            action.mode === "survey"
              ? state.ui.foundationCleanse
                ? state.ui.titleBoundaryLocked
                  ? "pan"
                  : "edit"
                : "edit"
              : action.mode === "sketch"
                ? "sketch"
                : "pan",
        },
      };
    }
    case "setLayerOpacity":
      return {
        ...state,
        ui: {
          ...state.ui,
          layerOpacity: {
            ...state.ui.layerOpacity,
            [action.key]: action.value,
          },
        },
      };
    case "switchSite": {
      const idx = action.idx;
      if (idx < 0 || idx >= state.siteSnaps.length || idx === state.ui.siteIdx) {
        return { ...state, ui: { ...state.ui, sitesOpen: false } };
      }
      const siteSnaps = [...state.siteSnaps];
      siteSnaps[state.ui.siteIdx] = cloneSnap(snapOf(state.doc));
      const next = cloneSnap(siteSnaps[idx]!);
      const safeItems = sanitizeItemsToOutdoor(
        next.items,
        next.boundary,
        next.building,
      );
      const focus = outdoorFocusView(next.boundary, next.building, 110);
      return {
        ...state,
        siteSnaps,
        doc: {
          ...next,
          items: safeItems,
          idn: state.doc.idn,
          hist: [],
          redo: [],
          histProvenance: [],
          redoProvenance: [],
        },
        ui: {
          ...state.ui,
          siteIdx: idx,
          sitesOpen: false,
          selectedId: null,
          drawPoly: null,
          drawCursor: null,
          ghostIdx: 0,
          focusX: focus.focusX,
          focusY: focus.focusY,
          zoom: focus.zoom,
        },
      };
    }
    case "resetSite": {
      const seed = STUDIO_SITES[state.ui.siteIdx]?.seed ?? WRIGHTS_SEED;
      const next = seedToSnap(seed);
      const before = snapOf(state.doc);
      return {
        ...state,
        doc: {
          ...next,
          idn: state.doc.idn,
          hist: [...state.doc.hist, before].slice(-MAX_HIST),
          redo: [],
          histProvenance: [
            ...state.doc.histProvenance,
            "manual" as HistoryProvenance,
          ].slice(-MAX_HIST),
          redoProvenance: [],
        },
        ui: {
          ...state.ui,
          selectedId: null,
          drawPoly: null,
          drawCursor: null,
          mitigated: {},
          ghostIdx: 0,
        },
      };
    }
    case "silentIds":
      return {
        ...state,
        doc: {
          ...state.doc,
          items: action.items,
          strokes: action.strokes,
        },
      };
    default:
      return state;
  }
}

export function useStudioState(opts: UseStudioStateOpts) {
  const {
    initialMode = "cad",
    projectId,
    address,
    aerialUri: aerialProp = null,
    outdoorM2 = 230.82,
    initialPlacements = [],
    initialStrokes = [],
    initialSiteFrame = null,
    initialIrrigationZones = [],
  } = opts;
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState({
      mode: initialMode,
      placements: initialPlacements,
      strokes: initialStrokes,
      siteFrame: initialSiteFrame,
      irrigationZones: initialIrrigationZones,
    }),
  );
  const bootstrapped = useRef(false);
  const skipPersist = useRef(true);
  const [saveRetryNonce, setSaveRetryNonce] = useState(0);
  const [sessionRejectionHints, setSessionRejectionHints] = useState<
    SessionRejectionHint[]
  >([]);
  const addressRef = useRef(address);
  addressRef.current = address;
  const outdoorRef = useRef(outdoorM2);
  outdoorRef.current = outdoorM2;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const saveRevisionRef = useRef(state.ui.saveRevision);

  useEffect(() => {
    if (state.ui.foundationCleanse || state.ui.aerialSuppressed) return;
    if (aerialProp && !state.ui.aerialUri) {
      dispatch({ type: "setUi", patch: { aerialUri: aerialProp } });
    }
  }, [
    aerialProp,
    state.ui.aerialUri,
    state.ui.aerialSuppressed,
    state.ui.foundationCleanse,
  ]);

  const mutate = useCallback(
    (fn: (snap: StudioSnapshot, idn: number) => { snap: StudioSnapshot; idn?: number }) => {
      dispatch({ type: "mutate", fn });
    },
    [],
  );

  const setUi = useCallback((patch: Partial<Ui>) => {
    dispatch({ type: "setUi", patch });
  }, []);

  /** Soften freehand ink in place — stays hand-drawn, never CAD symbols. */
  const tidySketches = useCallback(() => {
    mutate((snap) => {
      if (snap.strokes.length === 0) return { snap };
      return {
        snap: {
          ...snap,
          strokes: tidySketchStrokes(snap.strokes),
        },
      };
    });
    setUi({
      assistReply:
        "Sketch tidied — still hand-drawn. Formalize to CAD when you want symbols on the plan.",
      coachOpen: false,
    });
  }, [mutate, setUi]);

  const interpretSketches = useCallback(() => {
    const strokeCount = state.doc.strokes.length;
    if (strokeCount === 0) {
      setUi({
        assistReply: "Sketch on the plan first — then formalize to CAD when ready.",
        coachOpen: false,
      });
      return 0;
    }
    let count = 0;
    mutate((snap, idn) => {
      const proposed = proposeFromStrokes(snap, idn);
      count = proposed.count;
      if (proposed.count === 0) {
        return { snap, idn };
      }
      return {
        snap: {
          ...snap,
          items: mergeAiProposals(snap, proposed.items, ["sketch"]),
        },
        idn: proposed.idn,
      };
    });
    setUi({
      mode: "cad",
      tool: "pan",
      ghostIdx: 0,
      ghostReviewOpen: count > 0,
      coachOpen: false,
      assistReply:
        count > 0
          ? `Formalized ${count} sketch${count === 1 ? "" : "es"} into suggested CAD assets. Each stroke stays visible as a reference — adjust, accept, or reject before it becomes plan geometry.`
          : "No convertible strokes — draw a path, bed, or canopy mark first.",
    });
    return count;
  }, [mutate, setUi, state.doc.strokes.length]);

  /**
   * Apply AI CAD suggestions (from the server vision pipeline) as reviewable
   * ghosts. Mirrors interpretSketches but the interpretation was done by Claude.
   */
  const applyCadSuggestions = useCallback(
    (
      suggestions: Array<{
        id: string;
        symbol_id: string;
        x_pct: number;
        y_pct: number;
        confidence: number;
        reason: string;
        scale_hint?: number;
        rot_deg?: number;
      }>,
      opts?: { source?: "vision" | "heuristic" },
    ) => {
      let count = 0;
      mutate((snap, idn) => {
        const proposed = proposeFromCadSuggestions(snap, idn, suggestions);
        count = proposed.count;
        if (proposed.count === 0) return { snap, idn };
        return {
          snap: {
            ...snap,
            items: mergeAiProposals(snap, proposed.items, ["sketch"]),
          },
          idn: proposed.idn,
        };
      });
      const engine = opts?.source === "vision" ? "AI" : "quick";
      setUi({
        mode: "cad",
        tool: "pan",
        ghostIdx: 0,
        ghostReviewOpen: count > 0,
        coachOpen: false,
        assistReply:
          count > 0
            ? `Translated ${count} sketch element${count === 1 ? "" : "s"} into CAD (${engine}) — review sun, setback, and envelope, then accept.`
            : "No convertible strokes — draw a path, bed, or canopy mark first.",
      });
      return count;
    },
    [mutate, setUi],
  );

  const setMode = useCallback(
    (mode: StudioMode) => {
      // Sketch → CAD AI translation is owned by runFormalizeToCad in the
      // studio shell (vision pipeline). Do not auto-run the local heuristic here.
      dispatch({ type: "setMode", mode });
    },
    [],
  );

  const setLayerOpacity = useCallback((key: LayerKey, value: number) => {
    dispatch({ type: "setLayerOpacity", key, value });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const ghosts = state.doc.items.filter((i) => i.ghost);
  const ghostCount = ghosts.length;
  const curGhost =
    ghostCount === 0
      ? null
      : ghosts[
          (((state.ui.ghostIdx % ghostCount) + ghostCount) % ghostCount)
        ]!;

  const acceptGhost = useCallback(
    (id: string) => {
      const ghost = state.doc.items.find((i) => i.id === id);
      mutate((snap) => ({ snap: acceptProposal(snap, id) }));
      if (state.ui.rejectReasonId === id) setUi({ rejectReasonId: null });
      if (ghost) playMaterialFoley(ghost.t);
    },
    [mutate, setUi, state.doc.items, state.ui.rejectReasonId],
  );

  const rejectGhost = useCallback(
    (id: string) => {
      if (state.ui.rejectReasonId !== id) {
        setUi({ rejectReasonId: id, ghostReviewOpen: true });
        return;
      }
      mutate((snap) => ({ snap: rejectProposal(snap, id) }));
      setUi({ rejectReasonId: null });
    },
    [mutate, setUi, state.ui.rejectReasonId],
  );

  const rejectGhostWithReason = useCallback(
    (id: string, reason: RejectionReason) => {
      const ghost = state.doc.items.find((item) => item.id === id && item.ghost);
      if (ghost) {
        setSessionRejectionHints((hints) => [
          ...hints,
          {
            reason,
            type: ghost.t,
            x: ghost.x,
            y: ghost.y,
            note: ghost.why,
          },
        ]);
      }
      mutate((snap) => ({ snap: rejectProposal(snap, id) }));
      setUi({ rejectReasonId: null });
    },
    [mutate, setUi, state.doc.items],
  );

  const acceptAllGhosts = useCallback(() => {
    mutate((snap) => ({ snap: acceptAllProposals(snap) }));
  }, [mutate]);

  const dismissFlora = useCallback(() => {
    setUi({ floraSession: null });
  }, [setUi]);

  const setFloraActiveIdx = useCallback(
    (activeIdx: number) => {
      const session = state.ui.floraSession;
      if (!session) return;
      setUi({
        floraSession: {
          ...session,
          activeIdx: Math.max(
            0,
            Math.min(session.candidates.length - 1, activeIdx),
          ),
        },
      });
    },
    [setUi, state.ui.floraSession],
  );

  const acceptFlora = useCallback(
    (candidate: FloraCandidate) => {
      const session = state.ui.floraSession;
      if (!session) return;
      const form = candidate.studioForm;
      let tip: string | null = null;
      let px = session.x;
      let py = session.y;
      mutate((snap, idn) => {
        const placed = constrainAssetCentre(
          px,
          py,
          form,
          snap.boundary,
          snap.building,
        );
        px = placed.x;
        py = placed.y;
        if (placed.snapped) tip = placed.reason;
        const inEasement = (snap.easements ?? []).some(
          (ring) => ring.length >= 3 && pointInPolygon({ x: px, y: py }, ring),
        );
        if (inEasement) {
          tip =
            "Inside easement hatch — confirm title / council before excavation";
        }
        const scale = Math.max(
          0.45,
          Math.min(1.25, candidate.canopySpreadM / 5),
        );
        const id = crypto.randomUUID();
        const item: StudioItem = {
          id,
          t: form,
          x: px,
          y: py,
          rot: 0,
          scale,
          ghost: false,
          why: candidate.why,
          conf: candidate.score,
        };
        let next: StudioSnapshot = {
          ...snap,
          items: [...snap.items, item],
        };
        let nextIdn = idn + 1;
        const follow = maybeAutoProposeAfterCommit(
          next,
          addressRef.current,
          nextIdn,
        );
        if (follow) {
          next = {
            ...next,
            items: mergeAiProposals(next, follow.items, ["layout"]),
          };
          nextIdn = follow.idn;
        }
        return { snap: next, idn: nextIdn };
      });
      playMaterialFoley(form);
      setUi({
        floraSession: null,
        armed: null,
        addOpen: false,
        tool: "pan",
        ghostReviewOpen: true,
        coachOpen: false,
        setbackOn: tip ? true : state.ui.setbackOn,
        councilTip: tip,
      });
    },
    [mutate, setUi, state.ui.floraSession, state.ui.setbackOn],
  );

  const placeArmed = useCallback(
    (x: number, y: number) => {
      const painting = state.ui.tool === "paint";
      const armed = painting ? state.ui.paintSwatch : state.ui.armed;
      if (!armed) return;

      // Planting Add → Flora Ring (AI intelligence layer — available in Stage 1)
      if (!painting && isFloraStudioForm(armed)) {
        const cells = buildIndicativeShadeGrid(
          FLORA_SHADE_LAT,
          FLORA_SHADE_LNG,
          sunDateFromPreset(state.ui.sunDatePreset, state.ui.sunMin),
        );
        const sunHours = sunHoursAtPct(x, y, cells);
        const nearby = countNearbyCanopy(x, y, state.doc.items);
        const maxHeightM = FLORA_HEIGHT_BY_FORM[armed];
        const candidates = rankCurtisFloraCandidates({
          address: addressRef.current,
          sunHours,
          nearbyCanopyCount: nearby,
          maxHeightM,
          preferredForm: armed,
        });
        setUi({
          floraSession: {
            x,
            y,
            candidates,
            activeIdx: 0,
            maxHeightM,
          },
          addOpen: false,
        });
        return;
      }

      let tip: string | null = null;
      mutate((snap, idn) => {
        const placed = constrainAssetCentre(
          x,
          y,
          armed,
          snap.boundary,
          snap.building,
        );
        let px = placed.x;
        let py = placed.y;
        if (placed.snapped) tip = placed.reason;
        const inEasement = (snap.easements ?? []).some(
          (ring) => ring.length >= 3 && pointInPolygon({ x: px, y: py }, ring),
        );
        if (inEasement) {
          tip =
            "Inside easement hatch — confirm title / council before excavation";
        }
        let dbhM: number | undefined;
        if (armed === "exist") {
          const n = state.ui.existDbhM;
          if (Number.isFinite(n) && n > 0) dbhM = n;
        }
        const id = crypto.randomUUID();
        const item: StudioItem = {
          id,
          t: armed,
          x: px,
          y: py,
          rot: 0,
          scale: painting ? 1 : 0.7,
          ghost: false,
          ...(dbhM != null ? { dbhM } : {}),
        };
        let next: StudioSnapshot = {
          ...snap,
          items: [...snap.items, item],
        };
        let nextIdn = idn + 1;
        if (!painting && !state.ui.foundationCleanse) {
          const follow = maybeAutoProposeAfterCommit(
            next,
            addressRef.current,
            nextIdn,
          );
          if (follow) {
            next = {
              ...next,
              items: mergeAiProposals(next, follow.items, ["layout"]),
            };
            nextIdn = follow.idn;
          }
        }
        return { snap: next, idn: nextIdn };
      });
      playMaterialFoley(armed);
      // Paint stays armed (Mac Paint bucket); Add disarms after place.
      setUi({
        armed: painting ? state.ui.armed : null,
        addOpen: false,
        tool: painting ? "paint" : "pan",
        ghostReviewOpen: painting ? state.ui.ghostReviewOpen : !state.ui.foundationCleanse,
        coachOpen: false,
        setbackOn: tip ? true : state.ui.setbackOn,
        councilTip: tip,
      });
    },
    [
      mutate,
      setUi,
      state.doc.items,
      state.ui.armed,
      state.ui.existDbhM,
      state.ui.foundationCleanse,
      state.ui.ghostReviewOpen,
      state.ui.paintSwatch,
      state.ui.setbackOn,
      state.ui.sunMin,
      state.ui.sunDatePreset,
      state.ui.tool,
    ],
  );

  /**
   * Four-tier Spatial Correction NLP pipeline:
   * aerial suppress → vegetation sieve → elev scale clamp → Vicmap boundary snap.
   */
  const runSpatialCorrection = useCallback(async () => {
    const notes: string[] = [];
    setUi({
      aerialUri: null,
      parchmentPeel: 1,
      aiBusy: "assisting",
      cmdOpen: false,
      coachOpen: false,
      assistReply: "Running spatial correction…",
    });
    notes.push("Aerial off · parchment #F7F4EF");

    const sieved = sieveVegetationItems(state.doc.items);
    const clamped = clampVegetationElevationScale(sieved.items);
    if (sieved.removed > 0) {
      notes.push(`Sieved ${sieved.removed} overlapping vegetation`);
    }
    if (clamped.clamped > 0) {
      notes.push(`Clamped ${clamped.clamped} oversized elevation scales`);
    }
    mutate((snap) => ({
      snap: { ...snap, items: clamped.items },
    }));

    let boundarySnapped = false;
    if (projectId) {
      try {
        const { autoTraceBoundaryAction } = await import(
          "../../../../app/actions"
        );
        const res = await autoTraceBoundaryAction(projectId);
        const verts = [...res.boundary.vertices]
          .sort((a, b) => a.sequence_index - b.sequence_index)
          .map((v) => v.canvas_coords);
        const pct = canvasMetresRingToPct(verts);
        if (pct.length >= 3) {
          mutate((snap) => ({
            snap: {
              ...snap,
              ...reprojectDocToBoundary(snap, pct),
            },
          }));
          boundarySnapped = true;
          setUi({
            boundarySource:
              res.boundary.source_kind === "vicmap" ? "vicmap" : "manual",
            aerialSuppressed: true,
          });
          notes.push(
            `Boundary snapped to ${res.boundary.source_kind === "vicmap" ? "Vicmap parcel" : "title polygon"}`,
          );
        }
      } catch {
        notes.push("Vicmap parcel unavailable — kept drawn boundary");
      }
    } else {
      notes.push("No project id — cadastral snap skipped");
    }

    setUi({
      aiBusy: "idle",
      locked: false,
      aerialUri: null,
      aerialSuppressed: true,
      assistReply: `Spatial correction complete. ${notes.join(" · ")}${
        boundarySnapped ? "" : ""
      }`,
    });
  }, [mutate, projectId, setUi, state.doc.items]);

  /**
   * Stage 1 CAD title overlay:
   * Vicmap snap → charcoal CAD boundary with snap/drag/lock + edge metadata.
   * AI intelligence layer is preserved underneath (ghosts, flora, coach).
   */
  const runStage1FoundationCleanse = useCallback(async () => {
    const notes: string[] = [];
    setUi({
      aerialUri: null,
      parchmentPeel: 1,
      foundationCleanse: true,
      aerialSuppressed: true,
      titleBoundaryLocked: false,
      aiBusy: "assisting",
      cmdOpen: false,
      coachOpen: false,
      frameOn: false,
      locked: false,
      sheetScaleDenom: 100,
      zoom: 1,
      panX: 0,
      panY: 0,
      mode: "survey",
      tool: "edit",
      layerOpacity: {
        survey: 0.35,
        boundary: 1,
        council: 0.25,
        vegetation: 0.4,
        services: 0.6,
      },
      assistReply: "Snapping Vicmap title…",
    });
    notes.push("Title boundary live");

    // Clear only title-trace sketches — keep design strokes / AI items
    const sketches = clearBoundaryLikeSketches(
      state.doc.strokes,
      state.doc.boundary,
      { clearAll: false },
    );
    if (sketches.cleared > 0) {
      notes.push(`Cleared ${sketches.cleared} title-trace sketches`);
      mutate((snap) => ({
        snap: { ...snap, strokes: sketches.strokes },
      }));
    }

    let snapped = false;
    if (projectId) {
      try {
        const { autoTraceBoundaryAction } = await import(
          "../../../../app/actions"
        );
        const res = await autoTraceBoundaryAction(projectId);
        const verts = [...res.boundary.vertices]
          .sort((a, b) => a.sequence_index - b.sequence_index)
          .map((v) => v.canvas_coords);
        const pct = canvasMetresRingToPct(verts);
        if (pct.length >= 3) {
          mutate((snap) => ({
            snap: {
              ...snap,
              ...reprojectDocToBoundary(snap, pct),
            },
          }));
          snapped = true;
          setUi({
            boundarySource:
              res.boundary.source_kind === "vicmap" ? "vicmap" : "manual",
          });
          notes.push(
            res.boundary.source_kind === "vicmap"
              ? "Vicmap parcel snapped"
              : "Title polygon snapped",
          );
        }
      } catch {
        notes.push("Vicmap unavailable — drag title nodes");
      }
    } else {
      notes.push("Drag title nodes to refine");
    }

    setUi({
      aiBusy: "idle",
      locked: false,
      tool: "edit",
      foundationCleanse: true,
      titleBoundaryLocked: snapped,
      // Open Fit sheet working drawing — schedule + outside CAD dims
      frameOn: true,
      aerialSuppressed: true,
      aerialUri: null,
      assistReply: notes.join(" · "),
    });
  }, [mutate, projectId, setUi, state.doc.boundary, state.doc.strokes]);

  const setTitleBoundaryLocked = useCallback(
    (titleBoundaryLocked: boolean) => {
      setUi({
        titleBoundaryLocked,
        tool: titleBoundaryLocked ? "pan" : "edit",
        locked: false,
        assistReply: titleBoundaryLocked
          ? "Title locked"
          : "Title unlocked — drag nodes to refine",
      });
    },
    [setUi],
  );

  const exitStage1Foundation = useCallback(() => {
    setUi({
      foundationCleanse: false,
      titleBoundaryLocked: false,
      locked: false,
      tool: "pan",
      aerialSuppressed: true,
      aerialUri: null,
      layerOpacity: { ...DESIGN_LAYER_PRESET },
      assistReply: null,
    });
  }, [setUi]);

  const askAi = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      if (isStage1FoundationQuery(q)) {
        await runStage1FoundationCleanse();
        return;
      }
      if (isSpatialCorrectionQuery(q)) {
        await runSpatialCorrection();
        return;
      }
      setUi({
        aiBusy: "assisting",
        cmdOpen: false,
        cmdQuery: "",
        coachOpen: false,
        assistReply: null,
      });
      try {
        if (projectId) {
          const { designAssistAction } = await import("../../../../app/actions");
          const promptedQuery =
            buildSessionRejectionPrompt(sessionRejectionHints) + q;
          const res = await designAssistAction(projectId, promptedQuery);
          if (res?.suggestions?.length) {
            mutate((snap, idn) => {
              const mapped = proposalsFromApiSuggestions(
                res.suggestions,
                idn,
                "assist",
              );
              return {
                snap: {
                  ...snap,
                  items: mergeAiProposals(snap, mapped.items, ["assist"]),
                },
                idn: mapped.idn,
              };
            });
            setUi({
              aiBusy: "idle",
              ghostIdx: 0,
              ghostReviewOpen: true,
              assistReply: res.reply?.trim() || null,
            });
            return;
          }
          if (res?.reply?.trim()) {
            setUi({ assistReply: res.reply.trim() });
          }
        }
      } catch {
        /* fall through to geometry assist */
      }
      mutate((snap, idn) => {
        const local = proposeFromAssistQuery(snap, q, idn);
        return {
          snap: {
            ...snap,
            items: mergeAiProposals(snap, local.items, ["assist"]),
          },
          idn: local.idn,
        };
      });
      setUi({
        aiBusy: "idle",
        ghostIdx: 0,
        ghostReviewOpen: true,
        assistReply: `Local assist for “${q}” — accept ghosts to commit.`,
      });
    },
    [
      mutate,
      projectId,
      runSpatialCorrection,
      runStage1FoundationCleanse,
      sessionRejectionHints,
      setUi,
    ],
  );

  const scanGhosts = useCallback(async () => {
    setUi({ aiBusy: "scanning", canopyScanning: true, coachOpen: false });
    try {
      if (projectId) {
        const { scanDesignGhostsAction } = await import(
          "../../../../app/actions"
        );
        const res = await scanDesignGhostsAction(projectId);
        if (res?.suggestions?.length) {
          mutate((snap, idn) => {
            const mapped = proposalsFromApiSuggestions(
              res.suggestions,
              idn,
              "scan",
            );
            const layout = proposeLayoutFromSnapshot(
              snap,
              addressRef.current,
              mapped.idn,
            );
            const filtered = filterProposalsBySessionRejections(
              [...mapped.items, ...layout.items],
              sessionRejectionHints,
            );
            const merged = mergeAiProposals(
              snap,
              filtered,
              ["scan", "layout"],
            );
            return { snap: { ...snap, items: merged }, idn: layout.idn };
          });
          setUi({
            aiBusy: "idle",
            canopyScanning: false,
            ghostIdx: 0,
            ghostReviewOpen: true,
          });
          return;
        }
      }
    } catch {
      /* layout fallback */
    }
    mutate((snap, idn) => {
      const layout = proposeLayoutFromSnapshot(snap, addressRef.current, idn);
      const filtered = filterProposalsBySessionRejections(
        layout.items,
        sessionRejectionHints,
      );
      return {
        snap: {
          ...snap,
          items: mergeAiProposals(snap, filtered, ["layout", "scan"]),
        },
        idn: layout.idn,
      };
    });
    setUi({
      aiBusy: "idle",
      canopyScanning: false,
      ghostIdx: 0,
      ghostReviewOpen: true,
    });
  }, [mutate, projectId, sessionRejectionHints, setUi]);

  /**
   * Quiet Vicmap title hydrate — snaps parcel once without opening AI chrome.
   */
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { autoTraceBoundaryAction } = await import(
          "../../../../app/actions"
        );
        const res = await autoTraceBoundaryAction(projectId);
        if (cancelled) return;
        const verts = [...res.boundary.vertices]
          .sort((a, b) => a.sequence_index - b.sequence_index)
          .map((v) => v.canvas_coords);
        const pct = canvasMetresRingToPct(verts);
        if (pct.length < 3) return;
        let focus = { focusX: 50, focusY: 50, zoom: 1 };
        mutate((snap) => {
          const next = {
            ...snap,
            ...reprojectDocToBoundary(snap, pct),
          };
          focus = outdoorFocusView(next.boundary, next.building, 110);
          return { snap: next };
        });
        setUi({
          boundarySource:
            res.boundary.source_kind === "vicmap" ? "vicmap" : "manual",
          focusX: focus.focusX,
          focusY: focus.focusY,
          zoom: focus.zoom,
          panX: 0,
          panY: 0,
        });
      } catch {
        /* keep seed boundary */
      }
    })();
    return () => {
      cancelled = true;
    };
  // once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBoundary = useCallback(
    (boundary: PctPoint[]) => {
      // Stage 1: title nodes editable when unlocked; ignore global lock.
      if (state.ui.foundationCleanse) {
        if (state.ui.titleBoundaryLocked) return;
      } else if (state.ui.locked) {
        return;
      }
      mutate((snap) => ({ snap: { ...snap, boundary } }));
      setUi({ boundarySource: "manual" });
    },
    [
      mutate,
      setUi,
      state.ui.foundationCleanse,
      state.ui.locked,
      state.ui.titleBoundaryLocked,
    ],
  );

  const updateBuilding = useCallback(
    (building: PctPoint[]) => {
      if (state.ui.locked) return;
      mutate((snap) => ({ snap: { ...snap, building } }));
    },
    [mutate, state.ui.locked],
  );

  const moveItem = useCallback(
    (id: string, x: number, y: number) => {
      if (state.ui.locked) return;
      let tip: string | null = null;
      mutate((snap) => {
        const target = snap.items.find((i) => i.id === id);
        let px = x;
        let py = y;
        if (target && !target.ghost) {
          const placed = constrainAssetCentre(
            px,
            py,
            target.t,
            snap.boundary,
            snap.building,
          );
          px = placed.x;
          py = placed.y;
          if (placed.snapped) tip = placed.reason;
        }
        return {
          snap: {
            ...snap,
            items: snap.items.map((i) =>
              i.id === id && !i.ghost ? { ...i, x: px, y: py } : i,
            ),
          },
        };
      });
      if (tip) setUi({ councilTip: tip, setbackOn: true });
    },
    [mutate, setUi, state.ui.locked],
  );

  const transformItem = useCallback(
    (id: string, patch: Partial<Pick<StudioItem, "rot" | "scale" | "x" | "y">>) => {
      if (state.ui.locked) return;
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) => {
            if (i.id !== id || i.ghost) return i;
            const next = { ...i, ...patch };
            if (next.scale != null) {
              next.scale = Math.max(0.35, Math.min(2.5, next.scale));
            }
            if (next.rot != null) {
              let r = next.rot % 360;
              if (r < 0) r += 360;
              next.rot = r;
            }
            return next;
          }),
        },
      }));
    },
    [mutate, state.ui.locked],
  );

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      const ids =
        state.ui.groupIds.length > 0
          ? state.ui.groupIds
          : state.ui.selectedId
            ? [state.ui.selectedId]
            : [];
      if (ids.length === 0 || state.ui.locked) return;
      const set = new Set(ids);
      const step = state.ui.gridSnap
        ? GRID_STEP_PCT[state.ui.gridGrain]
        : null;
      const stepDx = step != null ? Math.sign(dx || 1) * (dx === 0 ? 0 : step) : dx;
      const stepDy = step != null ? Math.sign(dy || 1) * (dy === 0 ? 0 : step) : dy;
      // When grid snap is on, ignore fine nudge size — move one cell per key.
      const ndx = step != null ? (dx === 0 ? 0 : stepDx) : dx;
      const ndy = step != null ? (dy === 0 ? 0 : stepDy) : dy;
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) => {
            if (!set.has(i.id) || i.ghost) return i;
            let next = {
              x: Math.max(0, Math.min(100, i.x + ndx)),
              y: Math.max(0, Math.min(100, i.y + ndy)),
            };
            if (step != null) {
              next = snapToGridPct(next, step);
            }
            const placed = constrainAssetCentre(
              next.x,
              next.y,
              i.t,
              snap.boundary,
              snap.building,
            );
            return { ...i, x: placed.x, y: placed.y };
          }),
        },
      }));
    },
    [
      mutate,
      state.ui.gridGrain,
      state.ui.gridSnap,
      state.ui.groupIds,
      state.ui.locked,
      state.ui.selectedId,
    ],
  );

  const moveGroup = useCallback(
    (ids: string[], dx: number, dy: number) => {
      if (state.ui.locked || ids.length === 0) return;
      const set = new Set(ids);
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) => {
            if (!set.has(i.id) || i.ghost) return i;
            const placed = constrainAssetCentre(
              Math.max(0, Math.min(100, i.x + dx)),
              Math.max(0, Math.min(100, i.y + dy)),
              i.t,
              snap.boundary,
              snap.building,
            );
            return { ...i, x: placed.x, y: placed.y };
          }),
        },
      }));
    },
    [mutate, state.ui.locked],
  );

  const setSelection = useCallback(
    (selectedId: string | null, groupIds: string[] = []) => {
      setUi({ selectedId, groupIds });
    },
    [setUi],
  );

  const deleteSelected = useCallback(() => {
    if (state.ui.locked) return;
    const ids =
      state.ui.groupIds.length > 0
        ? state.ui.groupIds
        : state.ui.selectedId
          ? [state.ui.selectedId]
          : [];
    if (ids.length === 0) return;
    const set = new Set(ids);
    const removable = state.doc.items.filter(
      (i) => set.has(i.id) && !i.ghost,
    );
    if (removable.length === 0) return;
    const drop = new Set(removable.map((i) => i.id));
    mutate((snap) => ({
      snap: { ...snap, items: snap.items.filter((i) => !drop.has(i.id)) },
    }));
    setUi({ selectedId: null, groupIds: [] });
  }, [
    mutate,
    setUi,
    state.doc.items,
    state.ui.groupIds,
    state.ui.locked,
    state.ui.selectedId,
  ]);

  const changeSelectedType = useCallback(
    (t: StudioItemType) => {
      const id = state.ui.selectedId;
      if (!id || state.ui.locked) return;
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) =>
            i.id === id && !i.ghost ? { ...i, t } : i,
          ),
        },
      }));
      playMaterialFoley(t);
    },
    [mutate, state.ui.locked, state.ui.selectedId],
  );

  /** Paint bucket — retag a symbol with the active swatch. */
  const paintItem = useCallback(
    (id: string) => {
      if (state.ui.locked) return;
      const t = state.ui.paintSwatch;
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) =>
            i.id === id && !i.ghost ? { ...i, t } : i,
          ),
        },
      }));
      playMaterialFoley(t);
    },
    [mutate, state.ui.locked, state.ui.paintSwatch],
  );

  /** Clock-face rotate (±1 hour = 30°) for the selection. */
  const rotateSelectedClock = useCallback(
    (hours: number) => {
      const ids =
        state.ui.groupIds.length > 0
          ? state.ui.groupIds
          : state.ui.selectedId
            ? [state.ui.selectedId]
            : [];
      if (ids.length === 0 || state.ui.locked) return;
      const set = new Set(ids);
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) => {
            if (!set.has(i.id) || i.ghost) return i;
            return {
              ...i,
              rot: snapClockRotationDeg(i.rot + hours * 30),
            };
          }),
        },
      }));
    },
    [
      mutate,
      state.ui.groupIds,
      state.ui.locked,
      state.ui.selectedId,
    ],
  );

  const patchSelectedDbh = useCallback(
    (dbhM: number) => {
      const id = state.ui.selectedId;
      if (!id || state.ui.locked) return;
      if (!Number.isFinite(dbhM) || dbhM <= 0) return;
      const next = Math.min(2, Math.max(0.05, dbhM));
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) =>
            i.id === id && !i.ghost && i.t === "exist"
              ? { ...i, dbhM: next }
              : i,
          ),
        },
      }));
      setUi({ existDbhM: next });
    },
    [mutate, setUi, state.ui.locked, state.ui.selectedId],
  );

  const snapSheetScale = useCallback(
    (dir: 1 | -1) => {
      const cur = state.ui.sheetScaleDenom;
      const idx = SHEET_SCALE_STEPS.indexOf(cur);
      const next =
        SHEET_SCALE_STEPS[
          Math.max(0, Math.min(SHEET_SCALE_STEPS.length - 1, idx + dir))
        ]!;
      setUi({ sheetScaleDenom: next });
    },
    [setUi, state.ui.sheetScaleDenom],
  );

  const setSheetScale = useCallback(
    (sheetScaleDenom: SheetScaleDenom) => {
      setUi({ sheetScaleDenom });
    },
    [setUi],
  );

  const cycleGhost = useCallback(
    (dir: 1 | -1 = 1) => {
      if (ghostCount === 0) return;
      setUi({
        ghostIdx: state.ui.ghostIdx + dir,
        ghostReviewOpen: true,
        coachOpen: false,
      });
    },
    [ghostCount, setUi, state.ui.ghostIdx],
  );

  const ingestCanopyGhosts = useCallback(
    (ghosts: StudioItem[]) => {
      // Prefer raw image path via engine; this accepts pre-mapped items from AerialSlot.
      mutate((snap, idn) => {
        const add = ghosts.map((g) => ({
          ...g,
          id: crypto.randomUUID(),
          ghost: true as const,
        }));
        return {
          snap: {
            ...snap,
            items: mergeAiProposals(snap, add, ["canopy"]),
          },
          idn: idn + add.length,
        };
      });
      setUi({
        ghostIdx: 0,
        ghostReviewOpen: true,
        coachOpen: false,
        canopyScanning: false,
      });
    },
    [mutate, setUi],
  );

  const ingestCanopyImage = useCallback(
    (image: {
      width: number;
      height: number;
      data: ArrayLike<number>;
    }) => {
      if (state.ui.foundationCleanse || state.ui.aerialSuppressed) return;
      setUi({ canopyScanning: true, aiBusy: "scanning" });
      mutate((snap, idn) => {
        const proposed = proposeFromCanopyImage(image, idn);
        return {
          snap: {
            ...snap,
            items: mergeAiProposals(snap, proposed.items, ["canopy"]),
          },
          idn: proposed.idn,
        };
      });
      // Quiet merge — do not force Coach + Review open (screenshot chrome collision)
      setUi({
        canopyScanning: false,
        aiBusy: "idle",
        ghostIdx: 0,
      });
    },
    [
      mutate,
      setUi,
      state.ui.aerialSuppressed,
      state.ui.foundationCleanse,
    ],
  );

  const setStrokes = useCallback(
    (strokes: SketchStroke[]) => {
      mutate((snap) => ({ snap: { ...snap, strokes } }));
    },
    [mutate],
  );

  const addSpotLevel = useCallback(
    (x: number, y: number, z: number) => {
      mutate((snap) => ({
        snap: {
          ...snap,
          levels: [...(snap.levels ?? []), { x, y, z }],
        },
      }));
    },
    [mutate],
  );

  const commitService = useCallback(
    (ring: PctPoint[]) => {
      const classified = classifySurveyCorridor(ring);
      if (!classified) return;
      mutate((snap) => {
        if (classified.kind === "easement") {
          return {
            snap: {
              ...snap,
              easements: [...(snap.easements ?? []), classified.ring],
            },
          };
        }
        return {
          snap: {
            ...snap,
            services: [...(snap.services ?? []), classified.ring],
          },
        };
      });
    },
    [mutate],
  );

  const commitZone = useCallback(
    (points: PctPoint[], kind: IrrigationZoneKind) => {
      if (points.length < 2) return;
      const n = (state.doc.irrigationZones ?? []).length + 1;
      const zone: IrrigationZone = {
        id: crypto.randomUUID(),
        name: kind === "lighting" ? `Light ${n}` : `Zone ${n}`,
        kind,
        points: points.map((p) => ({ x_pct: p.x, y_pct: p.y })),
        emitter_spacing_cm: 30,
        emitter_flow_lph: 2,
        ...(kind === "lighting" ? { fixture_spacing_m: 2.5 } : {}),
      };
      mutate((snap) => ({
        snap: {
          ...snap,
          irrigationZones: [...(snap.irrigationZones ?? []), zone],
        },
      }));
      setUi({ tool: "pan" });
    },
    [mutate, setUi, state.doc.irrigationZones],
  );

  const switchSite = useCallback((idx: number) => {
    dispatch({ type: "switchSite", idx });
  }, []);

  const resetSite = useCallback(() => {
    dispatch({ type: "resetSite" });
  }, []);

  const bumpSaved = useCallback(() => {
    saveRevisionRef.current += 1;
    setUi({
      savedTick: Date.now(),
      saveStatus: "saved",
      saveRevision: saveRevisionRef.current,
    });
  }, [setUi]);

  const saveNow = useCallback(async (): Promise<void> => {
    const fixed = withContractIds({
      items: state.doc.items,
      strokes: state.doc.strokes,
    });
    if (fixed.remapped) {
      dispatch({
        type: "silentIds",
        items: fixed.items,
        strokes: fixed.strokes,
      });
    }
    const placements = itemsToPlacements(fixed.items);
    const canvasStrokes = strokesToCanvas(fixed.strokes);
    const siteFrame = snapshotToSiteFrame({
      boundary: state.doc.boundary,
      building: state.doc.building,
      easements: state.doc.easements ?? [],
      services: state.doc.services ?? [],
      levels: state.doc.levels ?? [],
    });
    setUi({ saveStatus: "saving" });
    try {
      await saveDesignCanvasAction(
        projectIdRef.current,
        placements,
        canvasStrokes,
        state.doc.irrigationZones ?? [],
        undefined,
        siteFrame,
      );
      saveRevisionRef.current += 1;
      setUi({
        saveStatus: "saved",
        savedTick: Date.now(),
        saveRevision: saveRevisionRef.current,
      });
    } catch {
      setUi({ saveStatus: "error" });
      throw new Error("Design canvas save failed");
    }
  }, [
    setUi,
    state.doc.boundary,
    state.doc.building,
    state.doc.easements,
    state.doc.irrigationZones,
    state.doc.items,
    state.doc.levels,
    state.doc.services,
    state.doc.strokes,
  ]);

  /** Durable DesignCanvas autosave — ghosts excluded; debounced after mutate. */
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const persist = async (attempt: number): Promise<void> => {
        try {
          await saveNow();
        } catch {
          if (attempt < 3) {
            setUi({ saveStatus: "retrying" });
            await new Promise((r) => window.setTimeout(r, 700 * attempt));
            return persist(attempt + 1);
          }
          setUi({ saveStatus: "error" });
        }
      };
      void persist(1);
    }, 1100);
    return () => window.clearTimeout(handle);
    // Persist accepted geometry + site frame — ghosts must not rewrite canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.doc.items.filter((i) => !i.ghost).length,
    state.doc.items
      .filter((i) => !i.ghost)
      .map(
        (i) =>
          `${i.id}:${i.x}:${i.y}:${i.scale}:${i.rot}:${i.t}:${i.dbhM ?? ""}`,
      )
      .join("|"),
    state.doc.strokes
      .map(
        (s) =>
          `${s.id}:${s.widthPx ?? ""}:${s.color ?? ""}:${s.points.map((p) => `${p.x},${p.y}`).join(";")}`,
      )
      .join("|"),
    state.doc.strokes.length,
    state.doc.boundary.map((p) => `${p.x},${p.y}`).join("|"),
    state.doc.building.map((p) => `${p.x},${p.y}`).join("|"),
    (state.doc.easements ?? [])
      .map((r) => r.map((p) => `${p.x},${p.y}`).join(";"))
      .join("/"),
    (state.doc.services ?? [])
      .map((r) => r.map((p) => `${p.x},${p.y}`).join(";"))
      .join("/"),
    (state.doc.levels ?? [])
      .map((lv) => `${lv.x},${lv.y},${lv.z}`)
      .join("|"),
    (state.doc.irrigationZones ?? [])
      .map(
        (z) =>
          `${z.id}:${z.kind ?? "drip"}:${z.points.map((p) => `${p.x_pct},${p.y_pct}`).join(";")}`,
      )
      .join("/"),
    saveRetryNonce,
  ]);

  const finishTrace = useCallback(
    (pts: PctPoint[]) => {
      if (pts.length < 3 || state.ui.locked) {
        setUi({ drawPoly: null, drawCursor: null });
        return;
      }
      const target = state.ui.traceTarget;
      mutate((snap, idn) => {
        let next: StudioSnapshot = {
          ...snap,
          [target]: pts.map((p) => ({ ...p })),
        };
        let nextIdn = idn;
        if (!state.ui.foundationCleanse) {
          const follow = maybeAutoProposeAfterCommit(
            next,
            addressRef.current,
            nextIdn,
          );
          if (follow) {
            next = {
              ...next,
              items: mergeAiProposals(next, follow.items, ["layout"]),
            };
            nextIdn = follow.idn;
          }
        }
        return { snap: next, idn: nextIdn };
      });
      setUi({
        drawPoly: null,
        drawCursor: null,
        tool: "edit",
        ...(target === "boundary" ? { boundarySource: "manual" as const } : {}),
      });
    },
    [
      mutate,
      setUi,
      state.ui.foundationCleanse,
      state.ui.locked,
      state.ui.traceTarget,
    ],
  );

  const cancelTrace = useCallback(() => {
    setUi({ drawPoly: null, drawCursor: null });
  }, [setUi]);

  const pushTracePoint = useCallback(
    (p: PctPoint) => {
      if (state.ui.locked) return;
      const cur = state.ui.drawPoly ?? [];
      setUi({ drawPoly: [...cur, p], drawCursor: null });
    },
    [setUi, state.ui.drawPoly, state.ui.locked],
  );

  const popTracePoint = useCallback(() => {
    const cur = state.ui.drawPoly;
    if (!cur) return;
    if (cur.length <= 1) setUi({ drawPoly: null, drawCursor: null });
    else setUi({ drawPoly: cur.slice(0, -1) });
  }, [setUi, state.ui.drawPoly]);

  const siteAddress =
    STUDIO_SITES[state.ui.siteIdx]?.addr ?? (address || STUDIO_SITES[0]!.addr);

  const coaching = useMemo(
    () => buildHandoffCoaching(snapOf(state.doc), siteAddress, ghostCount),
    [ghostCount, siteAddress, state.doc],
  );

  /**
   * Phase 1 workable canvas — Turf boolean lot − building − easements /
   * closed services / existing hardscape, in local metres (origin 0,0).
   */
  const siteSchedule = useMemo(() => {
    const scaleM = state.ui.boardWidthM ?? 110;
    if (state.doc.boundary.length < 3) {
      return null;
    }
    return buildWorkableSiteSchedule({
      boundary: state.doc.boundary,
      building: state.doc.building,
      easements: state.doc.easements ?? [],
      services: state.doc.services ?? [],
      items: state.doc.items,
      scaleM,
    });
  }, [
    state.doc.boundary,
    state.doc.building,
    state.doc.easements,
    state.doc.services,
    state.doc.items,
    state.ui.boardWidthM,
  ]);

  const workableOutdoorM2 =
    siteSchedule != null && siteSchedule.outdoorAreaM2 > 0
      ? siteSchedule.outdoorAreaM2
      : outdoorRef.current;

  /** Continuous council inspector — recomputes on every geometry commit. */
  const compliance = useMemo(
    () =>
      evaluateStudioCompliance({
        outdoorM2: workableOutdoorM2,
        boundary: state.doc.boundary,
        items: toComplianceItems(state.doc.items),
      }),
    [state.doc.boundary, state.doc.items, workableOutdoorM2],
  );

  const estimateArgs = useMemo((): StudioEstimateArgs => {
    const scaleM =
      state.ui.boardWidthM ?? boardScaleM(state.ui.sheetScaleDenom);
    return {
      outdoorM2: workableOutdoorM2,
      boundary: state.doc.boundary,
      items: toComplianceItems(state.doc.items),
      accessConstrained: workableOutdoorM2 > 400,
      scaleM,
      irrigationZones: state.doc.irrigationZones ?? [],
      metaByType: Object.fromEntries(
        (Object.keys(BY_TYPE) as StudioItemType[]).map((t) => {
          const d = BY_TYPE[t];
          return [
            t,
            {
              rate: d.rate,
              wPx: d.w,
              hPx: d.h,
              areaKind: d.area ?? "none",
              heightM: d.heightM,
              lin: d.lin,
              existing: d.existing,
              dbhM: d.dbhM,
              canopyM: d.canopyM,
            },
          ];
        }),
      ),
    };
  }, [
    state.doc.boundary,
    state.doc.items,
    state.doc.irrigationZones,
    state.ui.boardWidthM,
    state.ui.sheetScaleDenom,
    workableOutdoorM2,
  ]);

  /**
   * Phase 3 parametric BOM — sync seed + Web Worker settle so drag stays fluid.
   */
  const { estimate, settling: estimateSettling } =
    useStudioEstimate(estimateArgs);

  const acceptHorizonCard = useCallback(
    (card: StudioHorizonCard) => {
      if (!card.suggestType || card.x == null || card.y == null) {
        setUi({ mitigated: { ...state.ui.mitigated, [card.id]: true } });
        return;
      }
      mutate((snap, idn) => {
        const placed = constrainAssetCentre(
          card.x!,
          card.y!,
          card.suggestType!,
          snap.boundary,
          snap.building,
        );
        const id = crypto.randomUUID();
        const item: StudioItem = {
          id,
          t: card.suggestType!,
          x: placed.x,
          y: placed.y,
          rot: 0,
          scale: 0.75,
          ghost: true,
          why: card.detail,
          conf: 0.88,
        };
        return {
          snap: {
            ...snap,
            items: mergeAiProposals(snap, [item], ["layout"]),
          },
          idn: idn + 1,
        };
      });
      setUi({
        mitigated: { ...state.ui.mitigated, [card.id]: true },
        ghostReviewOpen: true,
        coachOpen: false,
        utilityPanel: "bom",
      });
    },
    [mutate, setUi, state.ui.mitigated],
  );

  /** Fit zoom + origin to the outdoor garden remnant (lot − house). */
  const fitOutdoorView = useCallback(() => {
    const scaleM = state.ui.boardWidthM ?? 110;
    const focus = outdoorFocusView(
      state.doc.boundary,
      state.doc.building,
      scaleM,
    );
    setUi({
      focusX: focus.focusX,
      focusY: focus.focusY,
      zoom: focus.zoom,
      panX: 0,
      panY: 0,
    });
  }, [
    setUi,
    state.doc.boundary,
    state.doc.building,
    state.ui.boardWidthM,
  ]);

  /** Zoom camera to the current selection (or outdoor remnant if empty). */
  const fitSelectionView = useCallback(() => {
    const ids =
      state.ui.groupIds.length > 0
        ? state.ui.groupIds
        : state.ui.selectedId
          ? [state.ui.selectedId]
          : [];
    const pts = state.doc.items
      .filter((i) => ids.includes(i.id) && !i.ghost)
      .map((i) => ({ x: i.x, y: i.y }));
    if (pts.length === 0) {
      fitOutdoorView();
      return;
    }
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY, 4);
    const FIT_ZOOM_MAX = 16;
    const zoom = Math.max(
      1,
      Math.min(FIT_ZOOM_MAX, Number((90 / span).toFixed(2))),
    );
    setUi({
      focusX: Number(midX.toFixed(2)),
      focusY: Number(midY.toFixed(2)),
      zoom,
      panX: 0,
      panY: 0,
    });
  }, [
    fitOutdoorView,
    setUi,
    state.doc.items,
    state.ui.groupIds,
    state.ui.selectedId,
  ]);

  useEffect(() => {
    if (!state.ui.councilTip) return;
    const t = window.setTimeout(
      () => setUi({ councilTip: null }),
      4200,
    );
    return () => window.clearTimeout(t);
  }, [setUi, state.ui.councilTip]);

  const status = draftStatus(ghostCount, state.ui.aiBusy);

  const ai = useMemo(
    () => ({
      status,
      coaching,
      pending: ghosts,
      pendingCount: ghostCount,
      current: curGhost,
      busy: state.ui.aiBusy,
      scan: scanGhosts,
      assist: askAi,
      accept: acceptGhost,
      reject: rejectGhost,
      rejectWithReason: rejectGhostWithReason,
      rejectReasonId: state.ui.rejectReasonId,
      acceptAll: acceptAllGhosts,
      cycle: cycleGhost,
      ingestCanopy: ingestCanopyGhosts,
      ingestCanopyImage,
      interpretSketches,
      tidySketches,
      openReview: () => setUi({ ghostReviewOpen: true }),
      openCoach: () => setUi({ ghostReviewOpen: true }),
    }),
    [
      acceptAllGhosts,
      acceptGhost,
      askAi,
      coaching,
      curGhost,
      cycleGhost,
      ghostCount,
      ghosts,
      ingestCanopyGhosts,
      ingestCanopyImage,
      interpretSketches,
      tidySketches,
      rejectGhost,
      rejectGhostWithReason,
      scanGhosts,
      setUi,
      state.ui.aiBusy,
      state.ui.rejectReasonId,
      status,
    ],
  );

  return {
    boundary: state.doc.boundary,
    building: state.doc.building,
    items: state.doc.items,
    easements: state.doc.easements,
    strokes: state.doc.strokes,
    levels: state.doc.levels ?? [],
    services: state.doc.services ?? [],
    irrigationZones: state.doc.irrigationZones ?? [],
    canUndo: state.doc.hist.length > 0,
    canRedo: state.doc.redo.length > 0,
    undoDepth: state.doc.hist.length,
    redoDepth: state.doc.redo.length,
    undoProvenance: state.doc.histProvenance,
    ui: state.ui,
    siteAddress,
    siteMeta: STUDIO_SITES[state.ui.siteIdx]?.meta ?? STUDIO_SITES[0]!.meta,
    ghosts,
    ghostCount,
    curGhost,
    compliance,
    estimate,
    estimateSettling,
    workableOutdoorM2,
    siteSchedule,
    acceptHorizonCard,
    fitOutdoorView,
    fitSelectionView,
    ai,
    mutate,
    setUi,
    setMode,
    interpretSketches,
    applyCadSuggestions,
    tidySketches,
    setLayerOpacity,
    undo,
    redo,
    acceptGhost,
    rejectGhost,
    acceptAllGhosts,
    placeArmed,
    acceptFlora,
    dismissFlora,
    setFloraActiveIdx,
    askAi,
    runSpatialCorrection,
    runStage1FoundationCleanse,
    exitStage1Foundation,
    setTitleBoundaryLocked,
    scanGhosts,
    cycleGhost,
    ingestCanopyGhosts,
    ingestCanopyImage,
    setStrokes,
    addSpotLevel,
    commitService,
    commitZone,
    switchSite,
    resetSite,
    retrySave: () => setSaveRetryNonce((n) => n + 1),
    bumpSaved,
    saveNow,
    moveItem,
    transformItem,
    nudgeSelected,
    moveGroup,
    setSelection,
    deleteSelected,
    changeSelectedType,
    paintItem,
    rotateSelectedClock,
    patchSelectedDbh,
    snapSheetScale,
    setSheetScale,
    updateBoundary,
    updateBuilding,
    finishTrace,
    cancelTrace,
    pushTracePoint,
    popTracePoint,
    setTraceTarget: (traceTarget: TraceTarget) =>
      setUi({ traceTarget, drawPoly: null, drawCursor: null }),
    setTool: (tool: StudioTool) => {
      if (tool === "reset") {
        resetSite();
        setUi({
          tool: "pan",
          addOpen: false,
          drawPoly: null,
          drawCursor: null,
          tiltDeg: 0,
        });
        return;
      }
      if (tool === "lock") {
        const nextLocked = !state.ui.locked;
        setUi({
          tool: nextLocked ? "lock" : "pan",
          locked: nextLocked,
          addOpen: false,
          drawPoly: null,
          drawCursor: null,
          tiltDeg: 0,
        });
        return;
      }
      setUi({
        tool,
        locked: false,
        addOpen: tool === "add",
        armed: tool === "add" ? state.ui.armed : null,
        paintSwatch:
          tool === "paint" ? state.ui.paintSwatch || "lawn" : state.ui.paintSwatch,
        drawPoly: tool === "trace" ? state.ui.drawPoly : null,
        drawCursor: tool === "trace" ? state.ui.drawCursor : null,
        // Tilt exit is animated by HandoffDesignStudio (temp CSS class).
      });
    },
    setPaper: (paper: PaperSize) => setUi({ paper }),
  };
}

export type StudioController = ReturnType<typeof useStudioState>;
