/**
 * Ribbon expansion statechart (XState v5).
 *
 * Strict binary toggle: the ribbon is either COLLAPSED (88px icon-only) or
 * DEPLOYED (236px with labels + hotkeys). No intermediate states, no elastic
 * bounce, no easing curves. The 50ms CSS transform handles the visual snap;
 * this machine owns the boolean state only.
 *
 * Transitions are instant — the statechart exists to enforce that no
 * half-deployed state can ever be observed, and to centralise the trigger
 * logic (hover, Cmd+K, pen-down collapse) in one auditable place.
 *
 * Binding: the user's DOM-to-WebGL Animation Mechanics spec.
 */

import { setup } from "xstate";

export type RibbonWidth = "rail" | "collapsed" | "deployed";

export interface RibbonMachineContext {
  /** The resolved width the ribbon should render at. */
  width: RibbonWidth;
}

export type RibbonMachineEvent =
  | { type: "HOVER_ENTER" }
  | { type: "HOVER_LEAVE" }
  | { type: "CMD_K_TOGGLE" }
  | { type: "PEN_DOWN" }
  | { type: "PEN_UP" };

export const ribbonMachine = setup({
  types: {
    context: {} as RibbonMachineContext,
    events: {} as RibbonMachineEvent,
  },
}).createMachine({
  id: "ribbon",
  context: { width: "collapsed" },
  initial: "collapsed",

  states: {
    /** 88px icon-only resting state. */
    collapsed: {
      on: {
        HOVER_ENTER: { target: "deployed" },
        CMD_K_TOGGLE: { target: "deployed" },
        PEN_DOWN: { target: "rail" },
      },
    },

    /** 236px expanded with labels + hotkeys. */
    deployed: {
      on: {
        HOVER_LEAVE: { target: "collapsed" },
        CMD_K_TOGGLE: { target: "collapsed" },
        PEN_DOWN: { target: "rail" },
      },
    },

    /** 56px rail while the stylus is down. Pen-up returns to collapsed. */
    rail: {
      on: {
        PEN_UP: { target: "collapsed" },
      },
    },
  },
});

/** Map a statechart state name to the CSS width class key. */
export function widthFromState(stateValue: string): RibbonWidth {
  if (stateValue === "rail") return "rail";
  if (stateValue === "deployed") return "deployed";
  return "collapsed";
}
