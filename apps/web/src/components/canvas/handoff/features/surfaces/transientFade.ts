/**
 * Transient-surface fade machine — the lifecycle every summoned surface
 * (cursor palette, FILL popup, orbit hints) shares.
 *
 * Rules (the forgiving fade):
 * - Summon → visible.
 * - After `idleMs` with NO hover and NO focus → prefade (60% opacity) for
 *   `prefadeMs`, then hidden. A returning pointer/focus during prefade
 *   cancels it — UI must never vanish as the hand reaches for it.
 * - Hover or focus-within completely blocks the idle clock.
 * - Escape / choosing an action hides immediately.
 * - Pure reducer over explicit events + monotonic `now` — deterministic,
 *   fully unit-testable, no timers inside.
 *
 * Reduced motion is a RENDER concern (no dissolve animation); the machine
 * is identical either way.
 */

export type FadePhase = "hidden" | "visible" | "prefade";

export type FadeState = {
  phase: FadePhase;
  /** Timestamp (ms) when the current phase began. */
  since: number;
  hovered: boolean;
  focused: boolean;
};

export type FadeEvent =
  | { kind: "summon"; now: number }
  | { kind: "pointer-enter"; now: number }
  | { kind: "pointer-leave"; now: number }
  | { kind: "focus-in"; now: number }
  | { kind: "focus-out"; now: number }
  | { kind: "escape"; now: number }
  | { kind: "choose"; now: number }
  | { kind: "tick"; now: number };

export type FadeConfig = {
  idleMs: number;
  prefadeMs: number;
};

export const DEFAULT_FADE: FadeConfig = { idleMs: 4000, prefadeMs: 1000 };

export const HIDDEN_FADE: FadeState = {
  phase: "hidden",
  since: 0,
  hovered: false,
  focused: false,
};

function engaged(s: FadeState): boolean {
  return s.hovered || s.focused;
}

export function fadeReduce(
  state: FadeState,
  event: FadeEvent,
  config: FadeConfig = DEFAULT_FADE,
): FadeState {
  const { now } = event;
  switch (event.kind) {
    case "summon":
      return { phase: "visible", since: now, hovered: false, focused: false };

    case "pointer-enter": {
      if (state.phase === "hidden") return { ...state, hovered: true };
      // Catching it mid-prefade revives it fully.
      return { ...state, phase: "visible", since: now, hovered: true };
    }

    case "pointer-leave": {
      if (state.phase === "hidden") return { ...state, hovered: false };
      // Leaving restarts the idle clock from now.
      return { ...state, hovered: false, since: engaged({ ...state, hovered: false }) ? state.since : now };
    }

    case "focus-in": {
      if (state.phase === "hidden") return { ...state, focused: true };
      return { ...state, phase: "visible", since: now, focused: true };
    }

    case "focus-out": {
      if (state.phase === "hidden") return { ...state, focused: false };
      return { ...state, focused: false, since: engaged({ ...state, focused: false }) ? state.since : now };
    }

    case "escape":
    case "choose":
      return { ...HIDDEN_FADE, since: now };

    case "tick": {
      if (state.phase === "visible" && !engaged(state) && now - state.since >= config.idleMs) {
        return { ...state, phase: "prefade", since: now };
      }
      if (state.phase === "prefade") {
        if (engaged(state)) return { ...state, phase: "visible", since: now };
        if (now - state.since >= config.prefadeMs) {
          return { ...HIDDEN_FADE, since: now };
        }
      }
      return state;
    }
  }
}

/** Render opacity for the current phase. */
export function fadeOpacity(state: FadeState): number {
  switch (state.phase) {
    case "visible":
      return 1;
    case "prefade":
      return 0.6;
    case "hidden":
      return 0;
  }
}

/** Is the surface interactive (pointer events on)? Hidden = inert. */
export function fadeInteractive(state: FadeState): boolean {
  return state.phase !== "hidden";
}
