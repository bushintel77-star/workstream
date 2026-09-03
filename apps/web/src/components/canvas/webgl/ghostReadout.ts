/**
 * Phase M.7 — Ghost readout for drag-to-plane raycast.
 *
 * Spec §7.2: "ghost carries its own readout
 * (`GRD · spread 9.0m · E 74.2 N 51.8`), a dashed mature-spread ring shows
 * on the ground".
 *
 * This module formats the readout string from the placement ghost's
 * world-space position, the active plane label, and the catalog dimensions.
 * The dashed ring is rendered in AssetPlaceLayer via a THREE.LineDashedMaterial
 * — this module only owns the text.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase M.7.
 * Reference: design_handoff §7.2, BUILD_CHECKLIST 8.7.
 */

import type { BentoTile } from "./assetBento";
import { formatDimensions } from "./assetBento";

/** Active plane label for the readout prefix. */
export type GhostPlane = "GRD" | "MAS" | "PLT" | "SUB" | "SEC";

/**
 * Format the ghost readout string.
 *
 * @param plane    Active plane label (GRD / MAS / PLT / SUB / SEC).
 * @param worldX   World X (metres, lot-centred).
 * @param worldZ   World Z (metres, lot-centred).
 * @param tile     The bento tile being placed (for dimensions).
 * @returns        e.g. "GRD · spread 9.0m · E 74.2 N 51.8"
 */
export function ghostReadout(
  plane: GhostPlane,
  worldX: number,
  worldZ: number,
  tile: BentoTile | undefined,
): string {
  const dims = tile ? formatDimensions(tile) : "";
  const en = `E ${worldX.toFixed(1)} N ${worldZ.toFixed(1)}`;
  const parts: string[] = [plane];
  if (dims) parts.push(dims);
  parts.push(en);
  return parts.join(" \u00b7 ");
}

/**
 * Format just the E/N coordinate portion (for the crosshair label).
 */
export function ghostCoordinate(worldX: number, worldZ: number): string {
  return `E ${worldX.toFixed(1)} N ${worldZ.toFixed(1)}`;
}

/**
 * Determine if a placement would conflict with an existing placement
 * (overlapping mature-spread rings). Used to colour the ghost ring.
 */
export function ghostWouldConflict(
  ghostX: number,
  ghostZ: number,
  ghostRadiusM: number,
  existing: ReadonlyArray<{ x: number; z: number; radiusM: number }>,
  clearanceM = 0.4,
): boolean {
  return existing.some((p) => {
    const dist = Math.hypot(p.x - ghostX, p.z - ghostZ);
    return dist < ghostRadiusM + p.radiusM + clearanceM;
  });
}
