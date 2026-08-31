import type { DesignCanvas } from "@workstream/contracts";
import { diffDesignCanvas } from "./design-canvas-diff";

export type MergeResolution = "ours" | "theirs" | "both";

export type MergeConflict = {
  kind: string;
  id: string;
  label: string;
};

export type MergeResult =
  | {
    ok: true;
    canvas: DesignCanvas;
    autoMerged: number;
    conflictsResolved: number;
  }
  | {
    ok: false;
    conflicts: MergeConflict[];
  };

type IdRow = { id: string };

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Three-way merge of one entity collection.
 * `ours` = into-branch tip (usually main), `theirs` = feature tip.
 */
export function mergeEntityArray<T extends IdRow>(
  base: T[],
  ours: T[],
  theirs: T[],
  resolutions: Record<string, MergeResolution>,
  conflicts: MergeConflict[],
  kind: string,
  labelOf: (row: T) => string,
  newId: () => string,
): T[] {
  const baseMap = new Map(base.map((r) => [r.id, r]));
  const oursMap = new Map(ours.map((r) => [r.id, r]));
  const theirsMap = new Map(theirs.map((r) => [r.id, r]));
  const ids = new Set([
    ...baseMap.keys(),
    ...oursMap.keys(),
    ...theirsMap.keys(),
  ]);
  const out: T[] = [];

  for (const id of ids) {
    const b = baseMap.get(id);
    const o = oursMap.get(id);
    const t = theirsMap.get(id);

    if (o && t) {
      if (sameJson(o, t)) {
        out.push(o);
        continue;
      }
      const oVsBase = !b || !sameJson(o, b);
      const tVsBase = !b || !sameJson(t, b);
      if (oVsBase && !tVsBase) {
        out.push(o);
        continue;
      }
      if (!oVsBase && tVsBase) {
        out.push(t);
        continue;
      }
      if (!oVsBase && !tVsBase) {
        out.push(o);
        continue;
      }
      const res = resolutions[id];
      if (!res) {
        conflicts.push({ kind, id, label: labelOf(o) });
        continue;
      }
      if (res === "ours") out.push(o);
      else if (res === "theirs") out.push(t);
      else {
        out.push(o);
        out.push({ ...t, id: newId() });
      }
      continue;
    }

    if (o && !t) {
      /* Deleted on theirs (or never on theirs). */
      if (b && sameJson(o, b)) {
        /* Unchanged on ours — accept delete. */
        continue;
      }
      if (!b) {
        out.push(o);
        continue;
      }
      /* Changed on ours, deleted on theirs → conflict. */
      const res = resolutions[id];
      if (!res) {
        conflicts.push({ kind, id, label: labelOf(o) });
        continue;
      }
      if (res === "ours" || res === "both") out.push(o);
      continue;
    }

    if (!o && t) {
      if (b && sameJson(t, b)) {
        /* Unchanged on theirs — accept delete from ours. */
        continue;
      }
      if (!b) {
        out.push(t);
        continue;
      }
      const res = resolutions[id];
      if (!res) {
        conflicts.push({ kind, id, label: labelOf(t) });
        continue;
      }
      if (res === "theirs" || res === "both") out.push(t);
    }
  }

  return out;
}

/**
 * Three-way merge of DesignCanvas tips.
 * `ours` = into-branch tip (usually main), `theirs` = feature tip, `base` = fork point.
 */
export function mergeDesignCanvas(args: {
  base: DesignCanvas;
  ours: DesignCanvas;
  theirs: DesignCanvas;
  resolutions?: Record<string, MergeResolution>;
  now?: string;
}): MergeResult {
  const resolutions = args.resolutions ?? {};
  const conflicts: MergeConflict[] = [];
  const newId = () => crypto.randomUUID();

  const placements = mergeEntityArray(
    args.base.placements ?? [],
    args.ours.placements ?? [],
    args.theirs.placements ?? [],
    resolutions,
    conflicts,
    "placement",
    (p) => p.label || p.symbol_id,
    newId,
  );
  const strokes = mergeEntityArray(
    args.base.strokes ?? [],
    args.ours.strokes ?? [],
    args.theirs.strokes ?? [],
    resolutions,
    conflicts,
    "stroke",
    (s) => s.id.slice(0, 8),
    newId,
  );
  const irrigation_zones = mergeEntityArray(
    args.base.irrigation_zones ?? [],
    args.ours.irrigation_zones ?? [],
    args.theirs.irrigation_zones ?? [],
    resolutions,
    conflicts,
    "irrigation_zone",
    (z) => z.name || z.kind || z.id.slice(0, 8),
    newId,
  );
  const construction_trenches = mergeEntityArray(
    args.base.construction_trenches ?? [],
    args.ours.construction_trenches ?? [],
    args.theirs.construction_trenches ?? [],
    resolutions,
    conflicts,
    "construction_trench",
    (t) => t.name || t.kind || t.id.slice(0, 8),
    newId,
  );
  const annotations = mergeEntityArray(
    args.base.annotations ?? [],
    args.ours.annotations ?? [],
    args.theirs.annotations ?? [],
    resolutions,
    conflicts,
    "annotation",
    (n) => n.text?.slice(0, 40) || n.id.slice(0, 8),
    newId,
  );
  const image_layers = mergeEntityArray(
    args.base.image_layers ?? [],
    args.ours.image_layers ?? [],
    args.theirs.image_layers ?? [],
    resolutions,
    conflicts,
    "image_layer",
    (l) => l.name || l.id.slice(0, 8),
    newId,
  );
  const features = mergeEntityArray(
    args.base.features ?? [],
    args.ours.features ?? [],
    args.theirs.features ?? [],
    resolutions,
    conflicts,
    "feature",
    (f) => f.metadata?.layer || f.id.slice(0, 8),
    newId,
  );
  const photo_elevations = mergeEntityArray(
    args.base.photo_elevations ?? [],
    args.ours.photo_elevations ?? [],
    args.theirs.photo_elevations ?? [],
    resolutions,
    conflicts,
    "photo_elevation",
    (e) => e.name || e.photo_id || e.id.slice(0, 8),
    newId,
  );
  const canvases = mergeEntityArray(
    args.base.canvases ?? [],
    args.ours.canvases ?? [],
    args.theirs.canvases ?? [],
    resolutions,
    conflicts,
    "canvas",
    (c) => c.label || c.id.slice(0, 8),
    newId,
  );

  if (conflicts.length > 0) {
    return { ok: false, conflicts };
  }

  const now = args.now ?? new Date().toISOString();
  const canvas: DesignCanvas = {
    id: args.ours.id,
    project_id: args.ours.project_id,
    placements,
    strokes,
    irrigation_zones,
    construction_trenches,
    annotations,
    image_layers,
    photo_elevations,
    features,
    canvases,
    site_frame: args.theirs.site_frame ?? args.ours.site_frame ?? args.base.site_frame,
    presentation_pack:
      args.theirs.presentation_pack ??
      args.ours.presentation_pack ??
      args.base.presentation_pack,
    lifecycle_phase:
      args.theirs.lifecycle_phase ??
      args.ours.lifecycle_phase ??
      args.base.lifecycle_phase,
    artboard_ids:
      args.theirs.artboard_ids ??
      args.ours.artboard_ids ??
      args.base.artboard_ids,
    updated_at: now,
  };

  const vsBase = diffDesignCanvas(args.base, canvas);
  return {
    ok: true,
    canvas,
    autoMerged: vsBase.changes.length,
    conflictsResolved: Object.keys(resolutions).length,
  };
}
