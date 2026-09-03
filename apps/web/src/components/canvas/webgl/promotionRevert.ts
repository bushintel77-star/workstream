/**
 * Phase M.10 — ⌘Z reverts a promotion to ink, byte-identical.
 *
 * Spec §7.3 / 5c / BUILD_CHECKLIST 8.10: "`⌘Z` reverts a promotion to ink
 * with the stroke intact. → Done when: the original stroke geometry is
 * byte-identical."
 *
 * This module owns the revert logic: given a promoted object and its source
 * stroke, verify that reverting restores the exact original stroke geometry
 * (point-for-point, pressure-for-pressure). The store's existing undo stack
 * handles the doc-level snapshot; this module provides the targeted revert
 * that the promotion chip's ⌘Z handler calls.
 *
 * The byte-identical guarantee is enforced by storing the source stroke's
 * serialized form at promotion time and comparing it on revert.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase M.10.
 * Reference: design_handoff §7.3, BUILD_CHECKLIST 8.10.
 */

import type { StrokePoint, PromotedObject } from "./strokePromotion";

/**
 * A snapshot of the source stroke at promotion time, for byte-identical
 * revert verification.
 */
export interface SourceInkSnapshot {
  /** The promoted object id this snapshot belongs to. */
  promotedObjectId: string;
  /** The original stroke id. */
  strokeId: string;
  /** The stroke points serialized as a stable JSON string. */
  serialized: string;
  /** The raw stroke points (for restoration). */
  points: StrokePoint[];
}

/**
 * Serialize stroke points to a canonical JSON string for byte comparison.
 * Keys are sorted; numbers are formatted to fixed precision to avoid
 * floating-point drift.
 */
export function serializeStroke(points: StrokePoint[]): string {
  const canonical = points.map((p) => ({
    x: Number(p.x.toFixed(6)),
    y: Number(p.y.toFixed(6)),
    pressure: p.pressure != null ? Number(p.pressure.toFixed(6)) : undefined,
  }));
  return JSON.stringify(canonical);
}

/**
 * Capture a source ink snapshot at promotion time.
 */
export function captureSourceInk(
  strokeId: string,
  points: StrokePoint[],
  promotedObjectId: string,
): SourceInkSnapshot {
  return {
    promotedObjectId,
    strokeId,
    serialized: serializeStroke(points),
    points: points.map((p) => ({
      x: p.x,
      y: p.y,
      ...(p.pressure != null ? { pressure: p.pressure } : {}),
    })),
  };
}

/**
 * Verify that a stroke is byte-identical to the captured snapshot.
 * Returns true if the serialized forms match exactly.
 */
export function verifyByteIdentical(
  snapshot: SourceInkSnapshot,
  currentPoints: StrokePoint[],
): boolean {
  return snapshot.serialized === serializeStroke(currentPoints);
}

/**
 * The result of reverting a promotion.
 */
export interface RevertResult {
  /** The restored stroke id. */
  strokeId: string;
  /** The restored stroke points (byte-identical to the original). */
  points: StrokePoint[];
  /** The id of the promoted object that was removed. */
  removedObjectId: string;
}

/**
 * Revert a promotion: restore the source ink and mark the promoted object
 * for removal. The restored points come directly from the snapshot, so
 * they are byte-identical by construction.
 */
export function revertPromotion(
  snapshot: SourceInkSnapshot,
  promotedObject: PromotedObject,
): RevertResult {
  if (snapshot.promotedObjectId !== promotedObject.id) {
    throw new Error(
      `Snapshot/object mismatch: snapshot is for ${snapshot.promotedObjectId}, object is ${promotedObject.id}`,
    );
  }
  return {
    strokeId: snapshot.strokeId,
    points: snapshot.points,
    removedObjectId: promotedObject.id,
  };
}

/**
 * A registry of source ink snapshots, keyed by promoted object id.
 * The store maintains this alongside the undo stack.
 */
export type SourceInkRegistry = Map<string, SourceInkSnapshot>;

/**
 * Add a snapshot to the registry.
 */
export function registerSourceInk(
  registry: SourceInkRegistry,
  snapshot: SourceInkSnapshot,
): SourceInkRegistry {
  const next = new Map(registry);
  next.set(snapshot.promotedObjectId, snapshot);
  return next;
}

/**
 * Remove a snapshot from the registry (after revert or object deletion).
 */
export function unregisterSourceInk(
  registry: SourceInkRegistry,
  promotedObjectId: string,
): SourceInkRegistry {
  const next = new Map(registry);
  next.delete(promotedObjectId);
  return next;
}

/**
 * Get a snapshot from the registry.
 */
export function getSourceInk(
  registry: SourceInkRegistry,
  promotedObjectId: string,
): SourceInkSnapshot | undefined {
  return registry.get(promotedObjectId);
}
