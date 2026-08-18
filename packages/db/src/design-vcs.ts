/**
 * Async design VCS helpers — migrate legacy DesignCanvas → main tip.
 * Used by the memory store; keeps tip resolution out of route handlers.
 */

import type {
  DesignBranch,
  DesignCanvas,
  DesignRevision,
  UpsertDesignCanvasInput,
} from "@workstream/contracts";
import { MAIN_DESIGN_BRANCH_NAME } from "@workstream/contracts";

export type DesignVcsArrays = {
  branches: DesignBranch[];
  revisions: DesignRevision[];
  canvases: DesignCanvas[];
};

function normalizeCanvas(canvas: DesignCanvas): DesignCanvas {
  return {
    ...canvas,
    irrigation_zones: canvas.irrigation_zones ?? [],
    construction_trenches: canvas.construction_trenches ?? [],
    annotations: canvas.annotations ?? [],
    image_layers: canvas.image_layers ?? [],
    photo_elevations: canvas.photo_elevations ?? [],
    features: canvas.features ?? [],
  };
}

function applyUpsert(
  existing: DesignCanvas,
  input: UpsertDesignCanvasInput,
  now: string,
): DesignCanvas {
  return {
    ...existing,
    placements: input.placements,
    strokes: input.strokes !== undefined ? input.strokes : existing.strokes,
    irrigation_zones:
      input.irrigation_zones !== undefined
        ? input.irrigation_zones
        : (existing.irrigation_zones ?? []),
    construction_trenches:
      input.construction_trenches !== undefined
        ? input.construction_trenches
        : (existing.construction_trenches ?? []),
    annotations:
      input.annotations !== undefined
        ? input.annotations
        : (existing.annotations ?? []),
    image_layers:
      input.image_layers !== undefined
        ? input.image_layers
        : (existing.image_layers ?? []),
    photo_elevations:
      input.photo_elevations !== undefined
        ? input.photo_elevations
        : (existing.photo_elevations ?? []),
    features:
      input.features !== undefined ? input.features : (existing.features ?? []),
    site_frame:
      input.site_frame !== undefined ? input.site_frame : existing.site_frame,
    presentation_pack:
      input.presentation_pack !== undefined
        ? input.presentation_pack
        : existing.presentation_pack,
    lifecycle_phase:
      input.lifecycle_phase !== undefined
        ? input.lifecycle_phase
        : existing.lifecycle_phase,
    artboard_ids:
      input.artboard_ids !== undefined
        ? input.artboard_ids
        : existing.artboard_ids,
    updated_at: now,
  };
}

/** Sync legacy `_designCanvases` row from main tip (jobs still read it). */
export function syncLegacyCanvasMirror(
  arrays: DesignVcsArrays,
  projectId: string,
  tipCanvas: DesignCanvas,
): void {
  const idx = arrays.canvases.findIndex((c) => c.project_id === projectId);
  const mirror = { ...tipCanvas, project_id: projectId };
  if (idx >= 0) arrays.canvases[idx] = mirror;
  else arrays.canvases.push(mirror);
}

/**
 * Ensure `main` exists for a project. Migrates a legacy canvas row into a
 * genesis revision when present.
 */
export function ensureMainBranch(
  arrays: DesignVcsArrays,
  ownerId: string,
  projectId: string,
  authorId: string,
): DesignBranch {
  const existing = arrays.branches.find(
    (b) =>
      b.project_id === projectId &&
      b.owner_id === ownerId &&
      b.name === MAIN_DESIGN_BRANCH_NAME,
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const legacy = arrays.canvases.find((c) => c.project_id === projectId);
  const canvas: DesignCanvas = legacy
    ? normalizeCanvas(legacy)
    : {
        id: crypto.randomUUID(),
        project_id: projectId,
        placements: [],
        strokes: [],
        irrigation_zones: [],
        construction_trenches: [],
        annotations: [],
        image_layers: [],
        photo_elevations: [],
        features: [],
        updated_at: now,
      };

  const branchId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const revision: DesignRevision = {
    id: revisionId,
    project_id: projectId,
    owner_id: ownerId,
    branch_id: branchId,
    parent_id: null,
    message: legacy ? "Migrated from design canvas" : "Initial main tip",
    canvas: { ...canvas, project_id: projectId },
    created_at: now,
    author_id: authorId,
  };
  const branch: DesignBranch = {
    id: branchId,
    project_id: projectId,
    owner_id: ownerId,
    name: MAIN_DESIGN_BRANCH_NAME,
    base_revision_id: null,
    tip_revision_id: revisionId,
    status: "open",
    created_at: now,
    updated_at: now,
  };
  arrays.revisions.push(revision);
  arrays.branches.push(branch);
  syncLegacyCanvasMirror(arrays, projectId, revision.canvas);
  return branch;
}

export function getRevision(
  arrays: DesignVcsArrays,
  revisionId: string,
): DesignRevision | null {
  return arrays.revisions.find((r) => r.id === revisionId) ?? null;
}

export function getBranch(
  arrays: DesignVcsArrays,
  ownerId: string,
  projectId: string,
  branchId: string,
): DesignBranch | null {
  return (
    arrays.branches.find(
      (b) =>
        b.id === branchId &&
        b.owner_id === ownerId &&
        b.project_id === projectId,
    ) ?? null
  );
}

export function getTipCanvas(
  arrays: DesignVcsArrays,
  branch: DesignBranch,
): DesignCanvas | null {
  const rev = getRevision(arrays, branch.tip_revision_id);
  return rev ? normalizeCanvas(rev.canvas) : null;
}

/** Update tip revision canvas in place (autosave). */
export function writeTipCanvas(
  arrays: DesignVcsArrays,
  branch: DesignBranch,
  input: UpsertDesignCanvasInput,
): DesignCanvas {
  const tip = getRevision(arrays, branch.tip_revision_id);
  const now = new Date().toISOString();
  if (!tip) {
    throw new Error(`Missing tip revision for branch ${branch.id}`);
  }
  tip.canvas = applyUpsert(normalizeCanvas(tip.canvas), input, now);
  tip.canvas.project_id = branch.project_id;
  branch.updated_at = now;
  if (branch.name === MAIN_DESIGN_BRANCH_NAME) {
    syncLegacyCanvasMirror(arrays, branch.project_id, tip.canvas);
  }
  return normalizeCanvas(tip.canvas);
}

/** Append a named commit revision and advance tip. */
export function commitRevision(
  arrays: DesignVcsArrays,
  branch: DesignBranch,
  authorId: string,
  message: string,
  input: UpsertDesignCanvasInput,
): DesignRevision {
  const now = new Date().toISOString();
  const parent = getRevision(arrays, branch.tip_revision_id);
  const baseCanvas = parent
    ? normalizeCanvas(parent.canvas)
    : {
        id: crypto.randomUUID(),
        project_id: branch.project_id,
        placements: [],
        strokes: [],
        irrigation_zones: [],
        construction_trenches: [],
        annotations: [],
        image_layers: [],
        photo_elevations: [],
        features: [],
        updated_at: now,
      };
  const canvas = applyUpsert(baseCanvas, input, now);
  canvas.project_id = branch.project_id;
  const revision: DesignRevision = {
    id: crypto.randomUUID(),
    project_id: branch.project_id,
    owner_id: branch.owner_id,
    branch_id: branch.id,
    parent_id: parent?.id ?? null,
    message: message || "Checkpoint",
    canvas,
    created_at: now,
    author_id: authorId,
  };
  arrays.revisions.push(revision);
  branch.tip_revision_id = revision.id;
  branch.updated_at = now;
  if (branch.name === MAIN_DESIGN_BRANCH_NAME) {
    syncLegacyCanvasMirror(arrays, branch.project_id, canvas);
  }
  return revision;
}

export function createBranchFromRevision(
  arrays: DesignVcsArrays,
  ownerId: string,
  projectId: string,
  name: string,
  fromRevision: DesignRevision,
  authorId: string,
): { branch: DesignBranch; revision: DesignRevision } {
  const now = new Date().toISOString();
  const branchId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const revision: DesignRevision = {
    id: revisionId,
    project_id: projectId,
    owner_id: ownerId,
    branch_id: branchId,
    parent_id: fromRevision.id,
    message: `Forked from ${fromRevision.id.slice(0, 8)}`,
    canvas: structuredClone(normalizeCanvas(fromRevision.canvas)),
    created_at: now,
    author_id: authorId,
  };
  revision.canvas.project_id = projectId;
  const branch: DesignBranch = {
    id: branchId,
    project_id: projectId,
    owner_id: ownerId,
    name,
    base_revision_id: fromRevision.id,
    tip_revision_id: revisionId,
    status: "open",
    created_at: now,
    updated_at: now,
  };
  arrays.revisions.push(revision);
  arrays.branches.push(branch);
  return { branch, revision };
}
