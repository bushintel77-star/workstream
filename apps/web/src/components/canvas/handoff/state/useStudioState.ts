"use client";

import { useCallback, useReducer } from "react";
import {
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
  DEFAULT_LAYER_OPACITY,
  DESIGN_LAYER_PRESET,
  SURVEY_LAYER_PRESET,
  type GrowthStage,
  type LayerKey,
  type LayerOpacity,
  type StudioSnapshot,
  type TraceTarget,
} from "./studioTypes";

const MAX_HIST = 40;

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
    },
  };
}

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

export function useStudioState(initialMode: StudioMode = "cad") {
  const [state, dispatch] = useReducer(reducer, initialMode, initialState);

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
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) =>
            i.id === id ? { ...i, ghost: false, stale: false } : i,
          ),
        },
      }));
    },
    [mutate],
  );

  const rejectGhost = useCallback(
    (id: string) => {
      mutate((snap) => ({
        snap: { ...snap, items: snap.items.filter((i) => i.id !== id) },
      }));
    },
    [mutate],
  );

  const acceptAllGhosts = useCallback(() => {
    mutate((snap) => ({
      snap: {
        ...snap,
        items: snap.items.map((i) =>
          i.ghost ? { ...i, ghost: false, stale: false } : i,
        ),
      },
    }));
  }, [mutate]);

  const placeArmed = useCallback(
    (x: number, y: number) => {
      const armed = state.ui.armed;
      if (!armed) return;
      mutate((snap, idn) => {
        const id = `p${idn + 1}`;
        const item: StudioItem = {
          id,
          t: armed,
          x,
          y,
          rot: 0,
          scale: 0.7,
          ghost: false,
        };
        return {
          snap: { ...snap, items: [...snap.items, item] },
          idn: idn + 1,
        };
      });
      setUi({ armed: null, addOpen: false, tool: "pan" });
    },
    [mutate, setUi, state.ui.armed],
  );

  const askAi = useCallback(
    (query: string) => {
      mutate((snap, idn) => {
        const ys = snap.boundary.map((p) => p.y);
        const xs = snap.boundary.map((p) => p.x);
        const y0 = Math.max(...ys) - 8;
        const x0 = (Math.min(...xs) + Math.max(...xs)) / 2;
        let nextIdn = idn;
        const add: StudioItem[] = [];
        for (const [dx, dy] of [
          [-2, 0],
          [2.5, -3],
        ] as const) {
          nextIdn += 1;
          add.push({
            id: `p${nextIdn}`,
            t: "canopy",
            x: x0 + dx,
            y: y0 + dy,
            rot: 0,
            scale: 0.75,
            ghost: true,
            why: `You asked: “${query}”`,
            conf: 0.84,
          });
        }
        return {
          snap: { ...snap, items: [...snap.items, ...add] },
          idn: nextIdn,
        };
      });
      setUi({ cmdOpen: false, cmdQuery: "", ghostIdx: 0 });
    },
    [mutate, setUi],
  );

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
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) =>
            i.id === id && !i.ghost ? { ...i, x, y } : i,
          ),
        },
      }));
    },
    [mutate, state.ui.locked],
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
      const id = state.ui.selectedId;
      if (!id || state.ui.locked) return;
      mutate((snap) => ({
        snap: {
          ...snap,
          items: snap.items.map((i) =>
            i.id === id && !i.ghost
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
    [mutate, state.ui.locked, state.ui.selectedId],
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

  /** Re-seed pending AI ghosts from the Wrights handoff catalog when empty. */
  const scanGhosts = useCallback(() => {
    mutate((snap, idn) => {
      const pending = snap.items.filter((i) => i.ghost);
      if (pending.length > 0) {
        return { snap };
      }
      const seeds = WRIGHTS_SEED.items.filter((i) => i.ghost);
      let nextIdn = idn;
      const add: StudioItem[] = seeds.map((s) => {
        nextIdn += 1;
        return { ...s, id: `p${nextIdn}`, stale: false };
      });
      return {
        snap: { ...snap, items: [...snap.items, ...add] },
        idn: nextIdn,
      };
    });
    setUi({ ghostReviewOpen: true, ghostIdx: 0 });
  }, [mutate, setUi]);

  const cycleGhost = useCallback(
    (dir: 1 | -1 = 1) => {
      if (ghostCount === 0) return;
      setUi({
        ghostIdx: state.ui.ghostIdx + dir,
        ghostReviewOpen: true,
      });
    },
    [ghostCount, setUi, state.ui.ghostIdx],
  );

  const ingestCanopyGhosts = useCallback(
    (ghosts: StudioItem[]) => {
      mutate((snap, idn) => {
        const withoutAerial = snap.items.filter(
          (i) => !i.id.startsWith("canopy-aerial-"),
        );
        let nextIdn = idn;
        const add = ghosts.map((g) => {
          nextIdn += 1;
          return { ...g, id: `canopy-aerial-${nextIdn}` };
        });
        return {
          snap: { ...snap, items: [...withoutAerial, ...add] },
          idn: nextIdn,
        };
      });
      setUi({ ghostIdx: 0, ghostReviewOpen: true });
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
      mutate((snap) => ({
        snap: {
          ...snap,
          [target]: pts.map((p) => ({ ...p })),
        },
      }));
      setUi({ drawPoly: null, drawCursor: null, tool: "edit" });
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

  return {
    boundary: state.doc.boundary,
    building: state.doc.building,
    items: state.doc.items,
    easements: state.doc.easements,
    strokes: state.doc.strokes,
    canUndo: state.doc.hist.length > 0,
    canRedo: state.doc.redo.length > 0,
    ui: state.ui,
    siteAddress: STUDIO_SITES[state.ui.siteIdx]?.addr ?? STUDIO_SITES[0]!.addr,
    siteMeta: STUDIO_SITES[state.ui.siteIdx]?.meta ?? STUDIO_SITES[0]!.meta,
    ghosts,
    ghostCount,
    curGhost,
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
    setStrokes,
    switchSite,
    resetSite,
    bumpSaved,
    moveItem,
    transformItem,
    nudgeSelected,
    deleteSelected,
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
