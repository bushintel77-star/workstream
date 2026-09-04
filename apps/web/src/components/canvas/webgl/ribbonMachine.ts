/**
 * Ribbon expansion statechart (XState v5).
 *
 * TWO states, not three: the ribbon is an icon rail at rest (88px) and
 * recedes (56px, subdued) while the stylus is down. It no longer expands
 * into a labelled panel on hover — the 2026-09-04 vision pass judged the
 * full-panel expansion poor UX (the operator's target jumps as the row
 * under the cursor reflows). Tool names live in the tile tooltips and the
 * tool flyouts; the rail never reflows under the hand.
 *
 * Transitions are instant — the statechart exists to enforce that no
 * intermediate state can ever be observed. The 50ms CSS opacity handles
 * the visual snap; this machine owns the boolean state only.
 */

import { setup } from "xstate";

export type RibbonWidth = "rail" | "collapsed";

export interface RibbonMachineContext {
  /** The resolved width the ribbon should render at. */
  width: RibbonWidth;
}

export type RibbonMachineEvent =
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
    /** 88px icon rail at rest. */
    collapsed: {
      on: {
        PEN_DOWN: { target: "rail" },
      },
    },

    /** 56px subdued rail while the stylus is down. Pen-up returns to rest. */
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
  return "collapsed";
}
