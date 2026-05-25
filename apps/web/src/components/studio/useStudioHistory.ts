import { useCallback, useRef, useState } from "react";
import type { CatalogPlacement, CatalogSymbol, IrrigationZone } from "@workstream/contracts";
import type { CanvasStrokeClient } from "./types";

export type StudioSnapshot = {
  placements: CatalogPlacement[];
  strokes: CanvasStrokeClient[];
  irrigationZones: IrrigationZone[];
};

const HISTORY_CAP = 50;

function cloneSnapshot(s: StudioSnapshot): StudioSnapshot {
  return {
    placements: s.placements.map((p) => ({ ...p })),
    strokes: s.strokes.map((st) => ({
      ...st,
      points: st.points.map((pt) => ({ ...pt })),
    })),
    irrigationZones: s.irrigationZones.map((z) => ({
      ...z,
      points: z.points.map((pt) => ({ ...pt })),
    })),
  };
}

export function useStudioHistory(initial: StudioSnapshot) {
  const [state, setState] = useState(initial);
  const pastRef = useRef<StudioSnapshot[]>([]);
  const futureRef = useRef<StudioSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushPast = useCallback(
    (prev: StudioSnapshot) => {
      pastRef.current = [...pastRef.current.slice(-(HISTORY_CAP - 1)), cloneSnapshot(prev)];
      futureRef.current = [];
      syncHistoryFlags();
    },
    [syncHistoryFlags],
  );

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return false;
    const current = cloneSnapshot(state);
    futureRef.current = [current, ...futureRef.current];
    const prev = past[past.length - 1]!;
    pastRef.current = past.slice(0, -1);
    setState(cloneSnapshot(prev));
    syncHistoryFlags();
    return true;
  }, [state, syncHistoryFlags]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return false;
    pastRef.current = [...pastRef.current, cloneSnapshot(state)];
    const next = future[0]!;
    futureRef.current = future.slice(1);
    setState(cloneSnapshot(next));
    syncHistoryFlags();
    return true;
  }, [state, syncHistoryFlags]);

  const setPlacements = useCallback(
    (
      updater: CatalogPlacement[] | ((prev: CatalogPlacement[]) => CatalogPlacement[]),
      recordHistory = true,
    ) => {
      setState((prev) => {
        const nextPlacements =
          typeof updater === "function" ? updater(prev.placements) : updater;
        if (recordHistory) pushPast(prev);
        return { ...prev, placements: nextPlacements };
      });
    },
    [pushPast],
  );

  const setStrokes = useCallback(
    (
      updater: CanvasStrokeClient[] | ((prev: CanvasStrokeClient[]) => CanvasStrokeClient[]),
      recordHistory = true,
    ) => {
      setState((prev) => {
        const nextStrokes =
          typeof updater === "function" ? updater(prev.strokes) : updater;
        if (recordHistory) pushPast(prev);
        return { ...prev, strokes: nextStrokes };
      });
    },
    [pushPast],
  );

  const setIrrigationZones = useCallback(
    (
      updater: IrrigationZone[] | ((prev: IrrigationZone[]) => IrrigationZone[]),
      recordHistory = true,
    ) => {
      setState((prev) => {
        const nextZones =
          typeof updater === "function" ? updater(prev.irrigationZones) : updater;
        if (recordHistory) pushPast(prev);
        return { ...prev, irrigationZones: nextZones };
      });
    },
    [pushPast],
  );

  const replaceAll = useCallback(
    (next: StudioSnapshot, recordHistory = true) => {
      if (recordHistory) pushPast(state);
      setState(cloneSnapshot(next));
      syncHistoryFlags();
    },
    [pushPast, state, syncHistoryFlags],
  );

  return {
    placements: state.placements,
    strokes: state.strokes,
    irrigationZones: state.irrigationZones,
    setPlacements,
    setStrokes,
    setIrrigationZones,
    replaceAll,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
