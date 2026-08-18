/**
 * Gold Standard 2026 — inspector edit policy (pure, unit-tested).
 *
 * Locks the field classification signed off in the scoping pass
 * (docs/agent-prompts/inspector-scope-output.md §4): geometry-affecting
 * placement edits re-clamp via constrainAssetCentre before persist —
 * persistent, per the title-boundary reconciliation rule. The alert
 * surface is dismissible and re-arms per edit. Attribute-only edits
 * persist directly. Build against this table; do not re-derive it during
 * panel wiring.
 */

import type { CatalogPlacement } from "@workstream/contracts";
import { constrainAssetCentre } from "../handoff/geometry/outdoorClamp";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";
import type { PctPoint } from "./coordTransform";

/** Placement fields the inspector can edit (v1 — position is the gizmo phase). */
export type PlacementFieldKey =
  | "symbol_id"
  | "scale"
  | "rotation_deg"
  | "label"
  | "height_m"
  | "canopy_radius_m";

/** Fields whose edits change the plan footprint → boundary clamp fires. */
export const CLAMPED_PLACEMENT_FIELDS: ReadonlySet<PlacementFieldKey> =
  new Set<PlacementFieldKey>(["scale", "canopy_radius_m"]);

/**
 * Attribute-only fields (direct persist). height_m is locked here on
 * sign-off: it changes the 3D mass but not the plan footprint, and
 * constrainAssetCentre is board-% plan math.
 */
export const DIRECT_PLACEMENT_FIELDS: ReadonlySet<PlacementFieldKey> =
  new Set<PlacementFieldKey>(["symbol_id", "rotation_deg", "label", "height_m"]);

export function placementEditClamps(field: PlacementFieldKey): boolean {
  return CLAMPED_PLACEMENT_FIELDS.has(field);
}

/** Does the patch contain any clamp-triggering field? */
export function patchClamps(
  patch: Partial<Record<PlacementFieldKey, unknown>>,
): boolean {
  return (Object.keys(patch) as PlacementFieldKey[]).some(placementEditClamps);
}

export interface ClampResult {
  x: number;
  y: number;
  snapped: boolean;
  reason: string | null;
}

/**
 * Re-clamp a placement centre after a geometry-affecting edit. Passes
 * through when the site has no boundary ring yet.
 */
export function clampPlacementEdit(
  placement: CatalogPlacement,
  boundary: PctPoint[],
  building: PctPoint[],
): ClampResult {
  if (boundary.length < 3) {
    return {
      x: placement.x_pct,
      y: placement.y_pct,
      snapped: false,
      reason: null,
    };
  }
  const r = constrainAssetCentre(
    placement.x_pct,
    placement.y_pct,
    mapSymbolToStudioType(placement.symbol_id),
    boundary,
    building,
  );
  return { x: r.x, y: r.y, snapped: r.snapped, reason: r.reason };
}
