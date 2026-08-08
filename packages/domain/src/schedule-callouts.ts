/**
 * Ghost-until-accept plan callouts from ops schedule rows.
 * Workflow 1 — indicative notes; operator Accept writes DesignCanvas.annotations.
 */

import type { CanvasAnnotation, DesignCanvas } from "@workstream/contracts";
import {
  buildPlantingSchedule,
  buildTrenchSchedule,
  boardWidthScale,
} from "./ops-schedules";

export type ScheduleCalloutGhost = {
  id: string;
  text: string;
  x: number;
  y: number;
  kind: "planting" | "trench";
};

/** Propose planting + trench callouts as ghosts (never auto-written). */
export function proposeScheduleCalloutGhosts(
  canvas: Pick<
    DesignCanvas,
    "placements" | "construction_trenches" | "annotations"
  >,
  scaleM = 20,
): ScheduleCalloutGhost[] {
  const planting = buildPlantingSchedule(canvas);
  const trench = buildTrenchSchedule(canvas, boardWidthScale(scaleM));
  const out: ScheduleCalloutGhost[] = [];

  for (const row of planting.rows) {
    const pin = (canvas.placements ?? []).find(
      (p) => p.symbol_id === row.symbol_id,
    );
    if (!pin) continue;
    out.push({
      id: crypto.randomUUID(),
      kind: "planting",
      text: `${row.common_name} ×${row.count}${
        row.spacing_m != null ? ` · ${row.spacing_m} m` : ""
      }`,
      x: pin.x_pct,
      y: Math.min(96, pin.y_pct + 3),
    });
  }

  for (const row of trench.rows) {
    const t = (canvas.construction_trenches ?? []).find((c) => c.id === row.id);
    const mid = t?.points?.[Math.floor((t.points.length - 1) / 2)];
    if (!mid) continue;
    out.push({
      id: crypto.randomUUID(),
      kind: "trench",
      text: `${row.name}: ${row.length_m} m · ${row.depth_band}`,
      x: mid.x_pct,
      y: Math.max(4, mid.y_pct - 2),
    });
  }

  return out.slice(0, 24);
}

/** Accept ghosts → durable canvas annotations. */
export function acceptScheduleCalloutGhosts(
  ghosts: ScheduleCalloutGhost[],
  now = new Date().toISOString(),
): CanvasAnnotation[] {
  return ghosts.map((g) => ({
    id: g.id,
    text: g.text.slice(0, 140),
    anchor: { kind: "point" as const, x: g.x, y: g.y },
    notePos: {
      x: Math.min(92, g.x + 4),
      y: Math.max(4, g.y - 4),
    },
    createdAt: now,
  }));
}
