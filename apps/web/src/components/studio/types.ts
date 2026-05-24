import type { StrokePointPct } from "@workstream/domain";

/** Client-side stroke payload (survey ink color applied at render). */
export type CanvasStrokeClient = {
  id: string;
  points: StrokePointPct[];
  color: string;
  width_px: number;
};
