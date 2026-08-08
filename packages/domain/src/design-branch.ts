import type {
  DesignBranchCanvasSnapshot,
  DesignBranchSnapshot,
  FreezeDesignBranchInput,
} from "@workstream/contracts";

export function createFrozenBranch(args: {
  projectId: string;
  input: FreezeDesignBranchInput;
  idFactory?: () => string;
  now?: string;
}): DesignBranchSnapshot {
  const id = (args.idFactory ?? (() => crypto.randomUUID()))();
  const canvas = args.input.canvas
    ? structuredClone(args.input.canvas)
    : undefined;
  return {
    id,
    project_id: args.projectId,
    name: args.input.name,
    parent_id: args.input.parent_id ?? null,
    created_at: args.now ?? new Date().toISOString(),
    bom_total: args.input.bom_total ?? 0,
    labour_hours: args.input.labour_hours ?? 0,
    thumbnail_note: args.input.thumbnail_note,
    canvas_fingerprint: args.input.canvas_fingerprint ?? "",
    canvas,
    is_frozen: true,
    active: true,
  };
}

/** Mark one branch active; others inactive. */
export function activateBranch(
  branches: DesignBranchSnapshot[],
  branchId: string,
): DesignBranchSnapshot[] {
  return branches.map((b) => ({
    ...b,
    active: b.id === branchId,
  }));
}

export function canvasSnapshotFromDesignCanvas(canvas: {
  placements: DesignBranchCanvasSnapshot["placements"];
  strokes?: DesignBranchCanvasSnapshot["strokes"];
  irrigation_zones?: DesignBranchCanvasSnapshot["irrigation_zones"];
  annotations?: DesignBranchCanvasSnapshot["annotations"];
  features?: DesignBranchCanvasSnapshot["features"];
}): DesignBranchCanvasSnapshot {
  return {
    placements: structuredClone(canvas.placements),
    strokes: structuredClone(canvas.strokes ?? []),
    irrigation_zones: structuredClone(canvas.irrigation_zones ?? []),
    annotations: structuredClone(canvas.annotations ?? []),
    features: structuredClone(canvas.features ?? []),
  };
}
