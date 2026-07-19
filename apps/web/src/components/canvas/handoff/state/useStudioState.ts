"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  buildableEnvelopeFromBoundary,
  evaluateStudioCompliance,
  shouldEnforceSetback,
  snapPointToBuildableEnvelope,
  type StudioComplianceItem,
} from "@workstream/domain";
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
};

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
  | { type: "resetSite" };

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
  };
}

function seedToSnap(seed: (typeof STUDIO_SITES)[number]["seed"]): StudioSnapshot {
  return {
    boundary: seed.boundary.map((p) => ({ ...p })),
    building: seed.building.map((p) => ({ ...p })),
    items: seed.items.map((i) => ({ ...i })),
    easements: [],
    strokes: [],
  };
}

function initialState(mode: StudioMode): State {
  const seed = WRIGHTS_SEED;
  const siteSnaps = STUDIO_SITES.map((s) => seedToSnap(s.seed));
  return {
    doc: {
      ...seedToSnap(seed),
      idn: 20,
      hist: [],
      redo: [],
    },
    siteSnaps,
    ui: {
      mode,
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
    },
  };
}

export type UseStudioStateOpts = {
  initialMode?: StudioMode;
  projectId: string;
  address: string;
  aerialUri?: string | null;
  outdoorM2?: number;
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
      const enteringSurvey = action.mode === "survey";
      const leavingSurvey = state.ui.mode === "survey" && action.mode !== "survey";
      let layerOpacity = state.ui.layerOpacity;
      if (enteringSurvey) layerOpacity = { ...SURVEY_LAYER_PRESET };
      if (leavingSurvey) layerOpacity = { ...DESIGN_LAYER_PRESET };
      return {
        ...state,
        ui: {
          ...state.ui,
          mode: action.mode,
          layerOpacity,
          drawPoly: null,
          drawCursor: null,
          tool:
            action.mode === "survey"
              ? "edit"
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
  } = opts;
  const [state, dispatch] = useReducer(reducer, initialMode, initialState);
  const bootstrapped = useRef(false);
  const addressRef = useRef(address);
  addressRef.current = address;
  const outdoorRef = useRef(outdoorM2);
  outdoorRef.current = outdoorM2;

  useEffect(() => {
    if (aerialProp && !state.ui.aerialUri) {
      dispatch({ type: "setUi", patch: { aerialUri: aerialProp } });
    }
  }, [aerialProp, state.ui.aerialUri]);

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

  const placeArmed = useCallback(
    (x: number, y: number) => {
      const armed = state.ui.armed;
      if (!armed) return;
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
        const id = `p${idn + 1}`;
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
        armed: null,
        addOpen: false,
        tool: "pan",
        ghostReviewOpen: true,
        coachOpen: true,
        setbackOn: tip ? true : state.ui.setbackOn,
        councilTip: tip,
      });
    },
    [mutate, setUi, state.ui.armed, state.ui.setbackOn],
  );

  const askAi = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
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
    [mutate, projectId, setUi],
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

  /** Bootstrap AI propose once when the studio mounts empty of proposals. */
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const pending = state.doc.items.filter((i) => i.ghost).length;
    if (pending === 0) {
      void scanGhosts();
    }
    // intentionally once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBoundary = useCallback(
    (boundary: PctPoint[]) => {
      if (state.ui.locked) return;
      mutate((snap) => ({ snap: { ...snap, boundary } }));
    },
    [mutate, state.ui.locked],
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
        let nextIdn = idn;
        const add = ghosts.map((g) => {
          nextIdn += 1;
          return {
            ...g,
            id: `ai-canopy-${nextIdn}`,
            ghost: true,
          };
        });
        return {
          snap: {
            ...snap,
            items: mergeAiProposals(snap, add, ["canopy"]),
          },
          idn: nextIdn,
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
      setUi({
        canopyScanning: false,
        aiBusy: "idle",
        ghostReviewOpen: true,
        coachOpen: true,
        ghostIdx: 0,
      });
    },
    [mutate, setUi],
  );

  const setStrokes = useCallback(
    (strokes: SketchStroke[]) => {
      mutate((snap) => ({ snap: { ...snap, strokes } }));
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
    setUi({ savedTick: Date.now() });
  }, [setUi]);

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
        drawPoly: null,
        drawCursor: null,
        tool: "edit",
        coachOpen: true,
        ghostReviewOpen: true,
      });
    },
    [mutate, setUi, state.ui.locked, state.ui.traceTarget],
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
    canUndo: state.doc.hist.length > 0,
    canRedo: state.doc.redo.length > 0,
    ui: state.ui,
    siteAddress,
    siteMeta: STUDIO_SITES[state.ui.siteIdx]?.meta ?? STUDIO_SITES[0]!.meta,
    ghosts,
    ghostCount,
    curGhost,
    compliance,
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
    askAi,
    scanGhosts,
    cycleGhost,
    ingestCanopyGhosts,
    ingestCanopyImage,
    setStrokes,
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
