import type { TraceTarget } from "./studioTypes";
import type { StudioTool } from "../studioCatalog";

export type ArmBuildingTracePatch = {
  tool: Extract<StudioTool, "trace">;
  traceTarget: Extract<TraceTarget, "building">;
  drawPoly: null;
  drawCursor: null;
  tiltDeg: 0;
  cmdOpen: false;
  cmdQuery: "";
};

/**
 * One-tap recovery when Vicmap returns no dwelling footprint:
 * arm Trace → Existing dwelling (flattens tilt so the ring is drawable).
 */
export function armBuildingTracePatch(): ArmBuildingTracePatch {
  return {
    tool: "trace",
    traceTarget: "building",
    drawPoly: null,
    drawCursor: null,
    tiltDeg: 0,
    cmdOpen: false,
    cmdQuery: "",
  };
}
