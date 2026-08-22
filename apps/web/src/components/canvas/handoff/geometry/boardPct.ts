import { clampBoardPct } from "@workstream/contracts";
import type { PctPoint } from "./types";

/**
 * `PctPoint` is the handoff geometry's `{ x, y }` spelling of a board percent
 * coordinate; the contract's is `{ x_pct, y_pct }`. Same board, same 0-100
 * bound — so the bound is not re-declared here, only re-shaped. This is the
 * single adapter for the whole handoff geometry module.
 */
export function toBoardPctPoint(p: PctPoint): PctPoint {
  return { x: clampBoardPct(p.x), y: clampBoardPct(p.y) };
}
