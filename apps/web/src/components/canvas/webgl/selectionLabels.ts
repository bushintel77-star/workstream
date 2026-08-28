import { getCatalogSymbol } from "@workstream/domain";
import type {
  CatalogPlacement,
  LandscapeFeature,
  PhotoElevation,
} from "@workstream/contracts";
import type { SelectionRef } from "./selectionPick";

/**
 * Shared selection-ref labels — ONE derivation for the inspector history
 * rail, the multi-select summary, and any future surface that names a
 * selected entity. Extracted when the UnifiedPanel absorbed the retired
 * InspectorCard (which carried a second, driftier variant).
 */
export function refLabel(
  ref: SelectionRef,
  placements: CatalogPlacement[],
  features: LandscapeFeature[],
  photoElevations: PhotoElevation[] = [],
): string {
  if (ref.kind === "boundary") return "Boundary";
  if (ref.kind === "building") return "Building";
  if (ref.kind === "placement") {
    const p = placements.find((x) => x.id === ref.id);
    if (!p) return "Placement";
    const sym = getCatalogSymbol(p.symbol_id);
    return p.label?.split("·")[0]?.trim() || sym?.label || p.symbol_id;
  }
  if (ref.kind === "feature") {
    const f = features.find((x) => x.id === ref.id);
    return f?.metadata?.friendly_name || f?.metadata?.layer || "Feature";
  }
  const elev = photoElevations.find((e) => e.id === ref.elevationId);
  return elev ? `trace on ${elev.name}` : "Photo stroke";
}

/** Provenance line for placements that came from a scan, not the operator. */
export function placementSourceLabel(
  source: CatalogPlacement["source"],
): string | null {
  if (source === "vicmap_tree") return "Vicmap urban tree";
  if (source === "canopy") return "Vision-detected canopy";
  return null;
}
