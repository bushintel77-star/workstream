import type {
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
