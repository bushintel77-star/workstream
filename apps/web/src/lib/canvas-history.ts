/** Bounded undo/redo stack for canvas snapshots (default 40 steps). */

export type CanvasHistory<T> = {
  undoStack: T[];
  redoStack: T[];
};

export function createCanvasHistory<T>(): CanvasHistory<T> {
  return { undoStack: [], redoStack: [] };
}

export function pushHistory<T>(
  history: CanvasHistory<T>,
  snapshot: T,
  limit = 40,
): CanvasHistory<T> {
  return {
    undoStack: [...history.undoStack, snapshot].slice(-limit),
    redoStack: [],
  };
}

export function undoHistory<T>(
  history: CanvasHistory<T>,
  current: T,
): { history: CanvasHistory<T>; snapshot: T } | null {
  if (history.undoStack.length === 0) return null;
  const prev = history.undoStack[history.undoStack.length - 1]!;
  return {
    snapshot: prev,
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, current],
    },
  };
}

export function redoHistory<T>(
  history: CanvasHistory<T>,
  current: T,
): { history: CanvasHistory<T>; snapshot: T } | null {
  if (history.redoStack.length === 0) return null;
  const next = history.redoStack[history.redoStack.length - 1]!;
  return {
    snapshot: next,
    history: {
      undoStack: [...history.undoStack, current],
      redoStack: history.redoStack.slice(0, -1),
    },
  };
}
