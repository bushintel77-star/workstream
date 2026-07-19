"use client";

import { useCallback, useReducer } from "react";
import {
  WRIGHTS_SEED,
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
  cmdOpen: boolean;
  cmdQuery: string;
  sitesOpen: boolean;
  addOpen: boolean;
  armed: StudioItemType | null;
  mitigated: Record<string, boolean>;
  coachStep: number;
};

type State = { doc: Doc; ui: Ui };

type Action =
  | { type: "mutate"; fn: (snap: StudioSnapshot, idn: number) => { snap: StudioSnapshot; idn?: number } }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "setUi"; patch: Partial<Ui> }
  | { type: "setMode"; mode: StudioMode }
  | { type: "setLayerOpacity"; key: LayerKey; value: number };

function cloneSnap(s: StudioSnapshot): StudioSnapshot {
  return JSON.parse(JSON.stringify(s)) as StudioSnapshot;
}

function snapOf(doc: Doc): StudioSnapshot {
  return {
    boundary: doc.boundary,
    building: doc.building,
    items: doc.items,
    easements: doc.easements,
  };
}

function initialState(mode: StudioMode): State {
  const seed = WRIGHTS_SEED;
  return {
    doc: {
      boundary: seed.boundary.map((p) => ({ ...p })),
      building: seed.building.map((p) => ({ ...p })),
      items: seed.items.map((i) => ({ ...i })),
      easements: [],
      idn: 20,
      hist: [],
      redo: [],
    },
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
      cmdOpen: false,
      cmdQuery: "",
      sitesOpen: false,
      addOpen: false,
      armed: null,
      mitigated: {},
      coachStep: -1,
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
        ui: { ...state.ui, mode: action.mode, layerOpacity },
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
    setUi({ factorsOpen: true, ghostIdx: 0 });
  }, [mutate, setUi]);

  const cycleGhost = useCallback(() => {
    if (ghostCount === 0) return;
    setUi({ ghostIdx: state.ui.ghostIdx + 1, factorsOpen: true });
  }, [ghostCount, setUi, state.ui.ghostIdx]);

  return {
    boundary: state.doc.boundary,
    building: state.doc.building,
    items: state.doc.items,
    easements: state.doc.easements,
    canUndo: state.doc.hist.length > 0,
    canRedo: state.doc.redo.length > 0,
    ui: state.ui,
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
    moveItem,
    updateBoundary,
    updateBuilding,
    setTool: (tool: StudioTool) => {
      if (tool === "lock") {
        const nextLocked = !state.ui.locked;
        setUi({
          tool: nextLocked ? "lock" : "pan",
          locked: nextLocked,
          addOpen: false,
        });
        return;
      }
      setUi({
        tool,
        locked: false,
        addOpen: tool === "add",
        armed: tool === "add" ? state.ui.armed : null,
      });
    },
    setPaper: (paper: PaperSize) => setUi({ paper }),
  };
}

export type StudioController = ReturnType<typeof useStudioState>;
