/**
 * Tree provenance — first-class source field for existing-tree placements.
 *
 * A Vicmap urban tree (council dataset, LiDAR height) and a vision-detected
 * canopy (colour heuristic on an aerial) are both useful, both require
 * accept, and both are indicative. But they are NOT the same thing, and a
 * drawing that renders them identically after acceptance is lying to the
 * architect, the council, and the client. This module owns the wording and
 * the indicative flag so every render surface (plan tooltip, elevation
 * callout, fit sheet, client share) reads from one place.
 *
 * Same honesty discipline as "Vicmap building footprint" vs
 * "operator-traced envelope" — the source survives acceptance.
 */

/** Where an existing-tree placement came from. */
export type TreeSource = "vicmap_tree" | "canopy" | "operator";

/**
 * Full honest label for client-facing surfaces (plan tooltip, share, fit
 * sheet). Never shortened — the second must never collapse to just "tree".
 */
export function treeSourceLabel(
  source: TreeSource | null | undefined,
  opts?: { captureDate?: string | null },
): string {
  if (source === "vicmap_tree") {
    return "Vicmap urban tree · approximate · confirm on site";
  }
  if (source === "canopy") {
    const date = opts?.captureDate?.trim();
    if (date) {
      return `Indicative canopy · detected from ${date} imagery · not survey or council data · confirm on site`;
    }
    return "Indicative canopy · detected from aerial imagery · not survey or council data · confirm on site";
  }
  return "";
}

/**
 * Short tag for the elevation callout (the strip that already joins "· 8.0 m").
 * "Existing" is the operator/survey default; a sourced tree names its source so
 * the elevation cannot silently drop the provenance the plan carries.
 */
export function treeSourceShortTag(
  source: TreeSource | null | undefined,
): string | null {
  if (source === "vicmap_tree") return "Vicmap urban tree";
  if (source === "canopy") return "Indicative canopy";
  return null;
}

/**
 * True for a vision-detected canopy — never the same line weight as a surveyed
 * or council-recorded tree. Vicmap is approximate (council dataset) but is a
 * real record, so it keeps the surveyed weight and only the canopy source
 * reads as indicative ink.
 */
export function isIndicativeCanopySource(
  source: TreeSource | null | undefined,
): boolean {
  return source === "canopy";
}

/**
 * AS 4970 TPZ requires trunk position and DBH measured on site. A
 * vision-detected canopy has neither — only a colour centroid — so a TPZ
 * derived from it would be a fabricated protection zone. Vicmap trees carry a
 * real trunk point and the tooltip already says "measure DBH on site for TPZ",
 * so an indicative (default-DBH) TPZ ring is acceptable there with that caveat.
 * The canopy path must never produce a TPZ ring.
 */
export function canDeriveTpz(
  source: TreeSource | null | undefined,
): boolean {
  return source !== "canopy";
}
