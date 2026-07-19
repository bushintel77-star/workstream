"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  buildIndicativeShadeGrid,
  buildableEnvelopeFromBoundary,
  countNearbyCanopy,
  estimateStudioDrawing,
  evaluateStudioCompliance,
  FLORA_HEIGHT_BY_FORM,
  isFloraStudioForm,
  rankCurtisFloraCandidates,
  shouldEnforceSetback,
  snapPointToBuildableEnvelope,
  sunHoursAtPct,
  type FloraCandidate,
  type StudioComplianceItem,
  type StudioHorizonCard,
} from "@workstream/domain";
import type { CatalogPlacement, CanvasStroke } from "@workstream/contracts";
import { saveDesignCanvasAction } from "../../../../app/actions";
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
import { markStaleGhostsNearEdit } from "./staleGhosts";
import {
  canvasToStrokes,
  itemsToPlacements,
  placementsToItems,
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
  proposeFromCanopyImage,
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
import {
  clampVegetationElevationScale,
  clearBoundaryLikeSketches,
  isSpatialCorrectionQuery,
  isStage1FoundationQuery,
  sieveVegetationItems,
} from "./spatialCorrection";

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
      dbhM: d.dbhM,
      canopyM: d.canopyM,
      wPx: d.w,
      hPx: d.h,
      areaKind: d.area ?? "none",
    };
  });
}

const MAX_HIST = 40;
const SHEET_SCALES = [50, 100, 200, 250, 500] as const;

type Doc = StudioSnapshot & {
  idn: number;
  hist: StudioSnapshot[];
  redo: StudioSnapshot[];
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
  setbackOn: boolean;
  growth: GrowthStage;
  sunMin: number;
  elevAxis: "x" | "y";
  selectedId: string | null;
  groupIds: string[];
  hoverId: string | null;
  ghostIdx: number;
  factorsOpen: boolean;
  ghostReviewOpen: boolean;
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
  siteIdx: number;
  canopyScanning: boolean;
  sunPlay: boolean;
  zoom: number;
  savedTick: number;
  aerialUri: string | null;
  aiBusy: "idle" | "scanning" | "assisting";
  coachOpen: boolean;
  /** Last natural-language assist reply shown in the coach rail. */
  assistReply: string | null;
  /** Right-hand utility drawer sheet: compliance | bom | closed. */
  utilityPanel: "compliance" | "bom" | null;
  /** Brief setback / TPZ tip after a preemptive snap. */
  councilTip: string | null;
  /**
   * Fit-sheet architectural scale denominator (1:N).
   * Snaps to [50, 100, 200, 250, 500] — canvas is the print sheet.
   */
  sheetScaleDenom: 50 | 100 | 200 | 250 | 500;
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
  saveStatus: "idle" | "saving" | "saved" | "error";
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

function dateFromSunMin(sunMin: number): Date {
  const d = new Date();
  d.setHours(Math.floor(sunMin / 60), sunMin % 60, 0, 0);
  return d;
}

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
  };
}

function initialState(opts: {
  mode: StudioMode;
  placements?: CatalogPlacement[];
  strokes?: CanvasStroke[];
}): State {
  const seed = WRIGHTS_SEED;
  const siteSnaps = STUDIO_SITES.map((s) => seedToSnap(s.seed));
  const base = seedToSnap(seed);
  const hasCanvas =
    (opts.placements?.length ?? 0) > 0 || (opts.strokes?.length ?? 0) > 0;
  const snap: StudioSnapshot = hasCanvas
    ? {
        ...base,
        items: placementsToItems(opts.placements ?? []),
        strokes: canvasToStrokes(opts.strokes ?? []),
      }
    : base;
  return {
    doc: {
      ...snap,
      idn: 20,
      hist: [],
      redo: [],
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
      setbackOn: false,
      growth: "mature",
      sunMin: 12 * 60 + 26,
      elevAxis: "x",
      selectedId: null,
      groupIds: [],
      hoverId: null,
      ghostIdx: 0,
      factorsOpen: false,
      ghostReviewOpen: false,
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
      siteIdx: 0,
      canopyScanning: false,
      sunPlay: false,
      zoom: 1,
      savedTick: 0,
      aerialUri: null,
      aiBusy: "idle",
      coachOpen: true,
      assistReply: null,
      utilityPanel: null,
      councilTip: null,
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
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "mutate": {
      const before = snapOf(state.doc);
      const result = action.fn(cloneSnap(before), state.doc.idn);
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
        },
      };
    }
    case "undo": {
      if (state.doc.hist.length === 0) return state;
      const hist = [...state.doc.hist];
      const prev = hist.pop()!;
      const current = snapOf(state.doc);
      return {
        ...state,
        doc: {
          ...state.doc,
          ...prev,
          hist,
          redo: [...state.doc.redo, current].slice(-MAX_HIST),
        },
      };
    }
    case "redo": {
      if (state.doc.redo.length === 0) return state;
      const redo = [...state.doc.redo];
      const next = redo.pop()!;
      const current = snapOf(state.doc);
      return {
        ...state,
        doc: {
          ...state.doc,
          ...next,
          hist: [...state.doc.hist, current].slice(-MAX_HIST),
          redo,
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
      // CAD / sketch are parchment drafting plates — no auto aerial map.
      // Survey may keep an optional user-uploaded screenshot only.
      const draftingPlate =
        action.mode === "cad" || action.mode === "sketch";
      return {
        ...state,
        ui: {
          ...state.ui,
          mode: action.mode,
          layerOpacity,
          drawPoly: null,
          drawCursor: null,
          ...(draftingPlate
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
      return {
        ...state,
        siteSnaps,
        doc: {
          ...next,
          idn: state.doc.idn,
          hist: [],
          redo: [],
        },
        ui: {
          ...state.ui,
          siteIdx: idx,
          sitesOpen: false,
          selectedId: null,
          drawPoly: null,
          drawCursor: null,
          ghostIdx: 0,
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
  } = opts;
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState({
      mode: initialMode,
      placements: initialPlacements,
      strokes: initialStrokes,
    }),
  );
  const bootstrapped = useRef(false);
  const skipPersist = useRef(true);
  const addressRef = useRef(address);
  addressRef.current = address;
  const outdoorRef = useRef(outdoorM2);
  outdoorRef.current = outdoorM2;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

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

  const setMode = useCallback((mode: StudioMode) => {
    dispatch({ type: "setMode", mode });
  }, []);

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
      mutate((snap) => ({ snap: acceptProposal(snap, id) }));
    },
    [mutate],
  );

  const rejectGhost = useCallback(
    (id: string) => {
      mutate((snap) => ({ snap: rejectProposal(snap, id) }));
    },
    [mutate],
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
        if (shouldEnforceSetback(form)) {
          const env = buildableEnvelopeFromBoundary(snap.boundary);
          const snapped = snapPointToBuildableEnvelope(px, py, env);
          px = snapped.x;
          py = snapped.y;
          if (snapped.snapped) tip = snapped.codeHint;
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
      setUi({
        floraSession: null,
        armed: null,
        addOpen: false,
        tool: "pan",
        ghostReviewOpen: true,
        coachOpen: true,
        setbackOn: tip ? true : state.ui.setbackOn,
        councilTip: tip,
      });
    },
    [mutate, setUi, state.ui.floraSession, state.ui.setbackOn],
  );

  const placeArmed = useCallback(
    (x: number, y: number) => {
      const armed = state.ui.armed;
      if (!armed) return;

      // Planting Add → Flora Ring (AI intelligence layer — available in Stage 1)
      if (isFloraStudioForm(armed)) {
        const cells = buildIndicativeShadeGrid(
          FLORA_SHADE_LAT,
          FLORA_SHADE_LNG,
          dateFromSunMin(state.ui.sunMin),
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
        let px = x;
        let py = y;
        if (shouldEnforceSetback(armed)) {
          const env = buildableEnvelopeFromBoundary(snap.boundary);
          const snapped = snapPointToBuildableEnvelope(px, py, env);
          px = snapped.x;
          py = snapped.y;
          if (snapped.snapped) tip = snapped.codeHint;
        }
        const id = crypto.randomUUID();
        const item: StudioItem = {
          id,
          t: armed,
          x: px,
          y: py,
          rot: 0,
          scale: 0.7,
          ghost: false,
        };
        let next: StudioSnapshot = {
          ...snap,
          items: [...snap.items, item],
        };
        let nextIdn = idn + 1;
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
        armed: null,
        addOpen: false,
        tool: "pan",
        ghostReviewOpen: !state.ui.foundationCleanse,
        coachOpen: true,
        setbackOn: tip ? true : state.ui.setbackOn,
        councilTip: tip,
      });
    },
    [
      mutate,
      setUi,
      state.doc.items,
      state.ui.armed,
      state.ui.foundationCleanse,
      state.ui.setbackOn,
      state.ui.sunMin,
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
      coachOpen: true,
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
          mutate((snap) => ({ snap: { ...snap, boundary: pct } }));
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
      coachOpen: true,
      frameOn: false,
      locked: false,
      sheetScaleDenom: 100,
      zoom: 1,
      mode: "survey",
      tool: "edit",
      layerOpacity: {
        survey: 0.35,
        boundary: 1,
        council: 0.25,
        vegetation: 0.4,
      },
      assistReply: "Stage 1 CAD — snapping Vicmap title (AI layer kept under)…",
    });
    notes.push("CAD title plate · AI intelligence underlay retained");

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
              boundary: pct,
            },
          }));
          snapped = true;
          setUi({
            boundarySource:
              res.boundary.source_kind === "vicmap" ? "vicmap" : "manual",
          });
          notes.push(
            res.boundary.source_kind === "vicmap"
              ? "Vicmap parcel snapped — drag nodes or Lock title"
              : "Title polygon snapped — drag nodes or Lock title",
          );
        }
      } catch {
        notes.push("Vicmap unavailable — drag seed title nodes, then Lock");
      }
    } else {
      notes.push("No project id — drag title nodes, then Lock");
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
      assistReply: `Stage 1 CAD + Fit sheet. ${notes.join(" · ")}`,
    });
  }, [mutate, projectId, setUi, state.doc.boundary, state.doc.strokes]);

  const setTitleBoundaryLocked = useCallback(
    (titleBoundaryLocked: boolean) => {
      setUi({
        titleBoundaryLocked,
        tool: titleBoundaryLocked ? "pan" : "edit",
        locked: false,
        assistReply: titleBoundaryLocked
          ? "Title CAD locked — edge metadata frozen. Unlock to snap/drag nodes."
          : "Title CAD unlocked — drag vertices (ortho/vertex snap). Lock when true.",
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
      assistReply:
        "Stage 1 exited — design chrome restored. Aerial stays off until you drop imagery.",
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
        coachOpen: true,
        assistReply: null,
      });
      try {
        if (projectId) {
          const { designAssistAction } = await import("../../../../app/actions");
          const res = await designAssistAction(projectId, q);
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
      setUi,
    ],
  );

  const scanGhosts = useCallback(async () => {
    setUi({ aiBusy: "scanning", canopyScanning: true, coachOpen: true });
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
            const merged = mergeAiProposals(
              snap,
              [...mapped.items, ...layout.items],
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
      return {
        snap: {
          ...snap,
          items: mergeAiProposals(snap, layout.items, ["layout", "scan"]),
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
  }, [mutate, projectId, setUi]);

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
        mutate((snap) => ({ snap: { ...snap, boundary: pct } }));
        setUi({
          boundarySource:
            res.boundary.source_kind === "vicmap" ? "vicmap" : "manual",
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
        if (target && !target.ghost && shouldEnforceSetback(target.t)) {
          const env = buildableEnvelopeFromBoundary(snap.boundary);
          const snapped = snapPointToBuildableEnvelope(px, py, env);
          px = snapped.x;
          py = snapped.y;
          if (snapped.snapped) tip = snapped.codeHint;
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
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) =>
            set.has(i.id) && !i.ghost
              ? {
                  ...i,
                  x: Math.max(0, Math.min(100, i.x + dx)),
                  y: Math.max(0, Math.min(100, i.y + dy)),
                }
              : i,
          ),
        },
      }));
    },
    [mutate, state.ui.groupIds, state.ui.locked, state.ui.selectedId],
  );

  const moveGroup = useCallback(
    (ids: string[], dx: number, dy: number) => {
      if (state.ui.locked || ids.length === 0) return;
      const set = new Set(ids);
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) =>
            set.has(i.id) && !i.ghost
              ? {
                  ...i,
                  x: Math.max(0, Math.min(100, i.x + dx)),
                  y: Math.max(0, Math.min(100, i.y + dy)),
                }
              : i,
          ),
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
    const id = state.ui.selectedId;
    if (!id || state.ui.locked) return;
    const target = state.doc.items.find((i) => i.id === id);
    if (!target || target.ghost) return;
    mutate((snap) => ({
      snap: { ...snap, items: snap.items.filter((i) => i.id !== id) },
    }));
    setUi({ selectedId: null });
  }, [mutate, setUi, state.doc.items, state.ui.locked, state.ui.selectedId]);

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
    },
    [mutate, state.ui.locked, state.ui.selectedId],
  );

  const snapSheetScale = useCallback(
    (dir: 1 | -1) => {
      const cur = state.ui.sheetScaleDenom;
      const idx = SHEET_SCALES.indexOf(cur);
      const next =
        SHEET_SCALES[
          Math.max(0, Math.min(SHEET_SCALES.length - 1, idx + dir))
        ]!;
      setUi({ sheetScaleDenom: next });
    },
    [setUi, state.ui.sheetScaleDenom],
  );

  const setSheetScale = useCallback(
    (sheetScaleDenom: 50 | 100 | 200 | 250 | 500) => {
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
        coachOpen: true,
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
        coachOpen: true,
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
      if (ring.length < 2) return;
      mutate((snap) => ({
        snap: {
          ...snap,
          services: [...(snap.services ?? []), ring],
        },
      }));
    },
    [mutate],
  );

  const switchSite = useCallback((idx: number) => {
    dispatch({ type: "switchSite", idx });
  }, []);

  const resetSite = useCallback(() => {
    dispatch({ type: "resetSite" });
  }, []);

  const bumpSaved = useCallback(() => {
    setUi({ savedTick: Date.now(), saveStatus: "saved" });
  }, [setUi]);

  /** Durable DesignCanvas autosave — ghosts excluded; debounced after mutate. */
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
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
      setUi({ saveStatus: "saving" });
      const persist = async (attempt: number): Promise<void> => {
        try {
          await saveDesignCanvasAction(
            projectIdRef.current,
            placements,
            canvasStrokes,
            [],
            [],
          );
          setUi({ saveStatus: "saved", savedTick: Date.now() });
        } catch {
          if (attempt < 3) {
            setUi({ saveStatus: "error" });
            await new Promise((r) => window.setTimeout(r, 700 * attempt));
            return persist(attempt + 1);
          }
          setUi({ saveStatus: "error" });
        }
      };
      void persist(1);
    }, 1100);
    return () => window.clearTimeout(handle);
    // Persist accepted geometry only — ghosts change should not rewrite canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.doc.items.filter((i) => !i.ghost).length,
    state.doc.items
      .filter((i) => !i.ghost)
      .map((i) => `${i.id}:${i.x}:${i.y}:${i.scale}:${i.rot}:${i.t}`)
      .join("|"),
    state.doc.strokes.map((s) => s.id).join("|"),
    state.doc.strokes.length,
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

  /** Continuous council inspector — recomputes on every geometry commit. */
  const compliance = useMemo(
    () =>
      evaluateStudioCompliance({
        outdoorM2: outdoorRef.current,
        boundary: state.doc.boundary,
        items: toComplianceItems(state.doc.items),
      }),
    [state.doc.boundary, state.doc.items],
  );

  /** Continuous material orchestrator — primary + shadowed assembly + logistics. */
  const estimate = useMemo(
    () =>
      estimateStudioDrawing({
        outdoorM2: outdoorRef.current,
        boundary: state.doc.boundary,
        items: toComplianceItems(state.doc.items),
        accessConstrained: outdoorRef.current > 400,
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
      }),
    [state.doc.boundary, state.doc.items],
  );

  const acceptHorizonCard = useCallback(
    (card: StudioHorizonCard) => {
      if (!card.suggestType || card.x == null || card.y == null) {
        setUi({ mitigated: { ...state.ui.mitigated, [card.id]: true } });
        return;
      }
      mutate((snap, idn) => {
        const id = crypto.randomUUID();
        const item: StudioItem = {
          id,
          t: card.suggestType!,
          x: card.x!,
          y: card.y!,
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
        coachOpen: true,
        utilityPanel: "bom",
      });
    },
    [mutate, setUi, state.ui.mitigated],
  );

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
      acceptAll: acceptAllGhosts,
      cycle: cycleGhost,
      ingestCanopy: ingestCanopyGhosts,
      ingestCanopyImage,
      openReview: () => setUi({ ghostReviewOpen: true, coachOpen: true }),
      openCoach: () => setUi({ coachOpen: true }),
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
      rejectGhost,
      scanGhosts,
      setUi,
      state.ui.aiBusy,
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
    canUndo: state.doc.hist.length > 0,
    canRedo: state.doc.redo.length > 0,
    ui: state.ui,
    siteAddress,
    siteMeta: STUDIO_SITES[state.ui.siteIdx]?.meta ?? STUDIO_SITES[0]!.meta,
    ghosts,
    ghostCount,
    curGhost,
    compliance,
    estimate,
    acceptHorizonCard,
    ai,
    mutate,
    setUi,
    setMode,
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
    switchSite,
    resetSite,
    bumpSaved,
    moveItem,
    transformItem,
    nudgeSelected,
    moveGroup,
    setSelection,
    deleteSelected,
    changeSelectedType,
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
        setUi({ tool: "pan", addOpen: false, drawPoly: null, drawCursor: null });
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
        });
        return;
      }
      setUi({
        tool,
        locked: false,
        addOpen: tool === "add",
        armed: tool === "add" ? state.ui.armed : null,
        drawPoly: tool === "trace" ? state.ui.drawPoly : null,
        drawCursor: tool === "trace" ? state.ui.drawCursor : null,
      });
    },
    setPaper: (paper: PaperSize) => setUi({ paper }),
  };
}

export type StudioController = ReturnType<typeof useStudioState>;
