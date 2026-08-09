export const CANVAS_HISTORY_MAX = 40;

export type HistoryStacks<T> = {
  past: T[];
  future: T[];
};

export function emptyHistoryStacks<T>(): HistoryStacks<T> {
  return { past: [], future: [] };
}

export function pushHistorySnapshot<T>(
  stacks: HistoryStacks<T>,
  snapshot: T,
): HistoryStacks<T> {
  return {
    past: [...stacks.past, snapshot].slice(-CANVAS_HISTORY_MAX),
    future: [],
  };
}

export function undoHistory<T>(
  stacks: HistoryStacks<T>,
  current: T,
): { stacks: HistoryStacks<T>; state: T | null } {
  if (!stacks.past.length) return { stacks, state: null };
  const prev = stacks.past[stacks.past.length - 1]!;
  return {
    stacks: {
      past: stacks.past.slice(0, -1),
      future: [current, ...stacks.future].slice(0, CANVAS_HISTORY_MAX),
    },
    state: prev,
  };
}

export function redoHistory<T>(
  stacks: HistoryStacks<T>,
  current: T,
): { stacks: HistoryStacks<T>; state: T | null } {
  if (!stacks.future.length) return { stacks, state: null };
  const next = stacks.future[0]!;
  return {
    stacks: {
      past: [...stacks.past, current].slice(-CANVAS_HISTORY_MAX),
      future: stacks.future.slice(1),
    },
    state: next,
  };
}
